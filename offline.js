const storageKey = 'vu-offline-v1';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const bytes = size => crypto.getRandomValues(new Uint8Array(size));
const pack = data => btoa(Array.from(new Uint8Array(data), byte => String.fromCharCode(byte)).join(''));
const unpack = data => Uint8Array.from(atob(data), char => char.charCodeAt(0));
const read = () => JSON.parse(localStorage.getItem(storageKey));
const derive = async (secret, salt) => {
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2', hash:'SHA-256', salt, iterations:600000},
    material, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
};
async function persist(vault, expected = vault.raw) {
  const iv = bytes(12);
  const encrypted = await crypto.subtle.encrypt({name:'AES-GCM', iv}, vault.key, encoder.encode(JSON.stringify(vault.data)));
  if (localStorage.getItem(storageKey) !== expected) throw Error('Archivio modificato in un’altra finestra. Riaprilo e riprova.');
  const raw = JSON.stringify({salt:pack(vault.salt), iv:pack(iv), encrypted:pack(encrypted)});
  localStorage.setItem(storageKey, raw);
  vault.raw = raw;
}
async function unlock(secret) {
  const raw = localStorage.getItem(storageKey);
  const envelope = read();
  const salt = unpack(envelope.salt);
  const key = await derive(secret, salt);
  const clear = await crypto.subtle.decrypt({name:'AES-GCM', iv:unpack(envelope.iv)}, key, unpack(envelope.encrypted));
  return {raw, salt, key, data:JSON.parse(decoder.decode(clear))};
}
export function hasOffline() { return localStorage.getItem(storageKey) !== null; }
export function clearOffline() { localStorage.removeItem(storageKey); }
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));
const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date());

export function openOffline(root, online) {
  let vault;
  let busy = false;
  const exists = hasOffline();
  root.innerHTML = `<main class="shell"><section class="panel"><h2>Volla United · Offline</h2>
    <p>${exists?'Sblocca l’archivio di questo dispositivo.':'Crea una frase di sblocco di almeno 12 caratteri per cifrare i dati sul dispositivo.'}</p>
    <form class="stack"><input aria-label="Frase di sblocco" type="password" required minlength="12"
      autocomplete="${exists?'current-password':'new-password'}"><button class="btn">${exists?'Sblocca':'Attiva offline'}</button></form>
    <p role="status"></p><a href="./">Torna all’app</a></section></main>`;
  const form = root.querySelector('form');
  if (!exists && !online) {
    form.hidden = true;
    root.querySelector('[role=status]').textContent = 'Apri l’app con internet e attiva la modalità offline dal menu account.';
    return;
  }
  form.onsubmit = async event => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const input = form.querySelector('input');
    const status = root.querySelector('[role=status]');
    try {
      if (exists) {
        try { vault = await unlock(input.value); }
        catch { throw Error('Frase di sblocco non valida o archivio danneggiato.'); }
        if (online && vault.data.owner !== online.owner) throw Error('Archivio associato a un altro account.');
      } else {
        const salt = bytes(16);
        vault = {salt, key:await derive(input.value, salt), raw:null,
          data:{owner:online.owner, snapshot:online.snapshot, queue:[]}};
        await persist(vault);
      }
      input.value = '';
      display();
      if (online) await sync();
    } catch (error) { status.textContent = error.message; }
    finally { busy = false; }
  };

  let category;
  let date = today();
  function display(message = '') {
    const {snapshot, queue} = vault.data;
    category ??= snapshot.categories[0]?.id;
    const group = snapshot.players.filter(player => player.category === category);
    const session = snapshot.sessions.find(row => row.category === category && row.date === date);
    const queued = queue.find(row => row.category === category && row.date === date);
    const values = queued?.rows ?? session?.rows;
    root.innerHTML = `<main class="shell"><section class="panel"><h2>Volla United · Offline</h2>
      <p role="status">${escape(message)}</p><p>${queue.length} allenamenti in attesa di sincronizzazione</p>
      ${queue.map(row => `<p>${escape(snapshot.categories.find(c=>c.id===row.category)?.name)} · ${escape(row.date)}${row.conflict?' · Conflitto con il registro online':''} ${row.conflict?`<button type="button" class="btn alt sm" data-discard="${escape(row.category+'/'+row.date)}">Scarta modifica locale</button>`:''}</p>`).join('')}
      ${online?'<button class="btn alt" id="vu-offline-sync">Sincronizza</button>':'<p>Quando torna la rete, apri l’app e sblocca l’archivio dal menu account.</p>'}
      <a href="./">Torna all’app</a></section>
      <section class="panel"><h3>Convocazioni scaricate</h3>
      ${snapshot.matches.map(match => `<p>${escape(match.date)} · ${escape(match.opponent)} · ${escape(match.field)} · ${escape(match.time)}</p>`).join('') || '<p>Nessuna convocazione scaricata.</p>'}</section>
      ${snapshot.canEdit && snapshot.categories.length?`<section class="panel"><h3>Presenze allenamenti</h3>
      <label>Categoria <select id="vu-offline-category">${snapshot.categories.map(c => `<option value="${escape(c.id)}" ${c.id===category?'selected':''}>${escape(c.name)}</option>`).join('')}</select></label>
      <label>Data <input id="vu-offline-date" type="date" value="${escape(date)}"></label>
      <form id="vu-offline-attendance" class="stack">${group.map(p => `<label class="check"><input type="checkbox" name="${escape(p.id)}" ${(!values || values[p.id])?'checked':''}> ${escape(p.name)}</label>`).join('')}
      <button class="btn" ${group.length?'':'disabled'}>Salva sul dispositivo</button></form></section>`:''}</main>`;
    for (const button of root.querySelectorAll('[data-discard]')) {
      button.onclick = async () => {
        if (busy || !confirm('Scartare questa modifica e conservare il registro online?')) return;
        busy = true;
        const previous = vault.data.queue;
        vault.data.queue = previous.filter(row => row.category+'/'+row.date !== button.dataset.discard);
        try { await persist(vault); display('Modifica locale scartata.'); }
        catch (error) { vault.data.queue = previous; display(error.message); }
        finally { busy = false; }
      };
    }
    const select = root.querySelector('#vu-offline-category');
    if (select) select.onchange = () => { category = select.value; display(); };
    const dateInput = root.querySelector('#vu-offline-date');
    if (dateInput) dateInput.onchange = () => { if (dateInput.value) date = dateInput.value; display(); };
    const register = root.querySelector('#vu-offline-attendance');
    if (register) register.onsubmit = async event => {
      event.preventDefault();
      if (busy) return;
      busy = true;
      try {
        const rows = Object.fromEntries(group.map(p => [p.id, register.elements.namedItem(p.id).checked]));
        if (!Object.values(rows).some(Boolean)) throw Error('Seleziona almeno un presente.');
        const previous = vault.data.queue;
        vault.data.queue = [...previous.filter(row => row !== queued), {
          category, date, rows, session:queued?.session ?? session?.id ?? null, base:queued?.base ?? session?.rows ?? {}
        }];
        try { await persist(vault); }
        catch (error) { vault.data.queue = previous; throw error; }
        display('Salvato sul dispositivo.');
      } catch (error) { display(error.message); }
      finally { busy = false; }
      if (online) await sync();
    };
    root.querySelector('#vu-offline-sync')?.addEventListener('click', () => { if (!busy) sync(); });
  }

  async function sync() {
    busy = true;
    const previous = vault.data;
    try {
      const remaining = [];
      for (const row of vault.data.queue) {
        const result = await online.send(row);
        if (result === 'conflict') remaining.push({...row, conflict:true});
        else if (result !== 'saved') throw Error('Risposta di sincronizzazione inattesa.');
      }
      vault.data = {...previous, queue:remaining, snapshot:await online.refresh()};
      await persist(vault);
      display(remaining.length?'Controlla il registro online per gli allenamenti in conflitto.':'Archivio aggiornato.');
    } catch (error) { vault.data = previous; display('Sincronizzazione in sospeso. '+error.message); }
    finally { busy = false; }
  }
  window.addEventListener('online', () => { if (online && vault && !busy) sync(); });
}
