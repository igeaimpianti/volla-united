const table = 'vu_training_sessions';
const equipment = {
  player: 'Giocatore', opponent: 'Avversario', ball: 'Pallone',
  disc: 'Cinesino', cone: 'Cono', hurdle: 'Ostacolo', ladder: 'Scaletta',
  goal: 'Porticina', pole: 'Paletto', run: 'Corsa', pass: 'Passaggio'
};
const heights = [15, 23, 30, 40, 50, 60];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[character]);

export function canUseTraining(profile) {
  return profile?.id === '8cabd9a2-8f72-4c0c-8853-5f923836f3f0'
    && profile.active && profile.role === 'coach' && profile.username === 'misterigea';
}

function newExercise() {
  return {title: '', minutes: 10, notes: '', objects: []};
}

function newSession() {
  const date = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Rome'}).format(new Date());
  return {id: crypto.randomUUID(), title: '', training_date: date, category: '', exercises: [newExercise()]};
}

const icons = {
  field:'M3 4h18v16H3zM12 4v16M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  archive:'M3 5h18v4H3zM5 9v11h14V9m-9 4h4',
  new:'M12 5v14M5 12h14', save:'M4 3h13l3 3v15H4zM8 3v5h8V3M8 21v-8h8v8',
  pdf:'M13 3H5v18h14V9l-6-6zm0 0v6h6m-7 2v6m-3-3 3 3 3-3',
  copy:'M8 8h12v12H8zM16 8V4H4v12h4', trash:'M4 6h16M9 6V3h6v3m3 0-1 15H7L6 6m4 4v7m4-7v7',
  select:'M4 3l15 10-7 1-3 7z', pan:'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3',
  player:'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5 21v-3a7 7 0 0 1 14 0v3', opponent:'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5 21v-3a7 7 0 0 1 14 0v3',
  ball:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5 4 3-2 5h-4l-2-5 4-3zm0 0V3m8 6-4 2m-2 5 3 4m-7-4-3 4m1-9L4 9',
  disc:'M3 17h18l-4-7H7zM10 10h4', cone:'M3 20h18M7 20l4-16h2l4 16M9 12h6',
  hurdle:'M4 20V7h16v13M2 20h5m10 0h5', ladder:'M7 3v18M17 3v18M7 5h10M7 10h10M7 15h10M7 20h10',
  goal:'M3 19V6h18v13M3 9h18M7 9v10m5-10v10m5-10v10M3 14h18',
  pole:'M12 3v17M6 21h12', run:'M3 18 17 6m-7 0h7v7', pass:'M4 18l2-2m3-3 2-2m3-3 3-3m-7 0h7v7',
  left:'M4 5v6h6M4 11a8 8 0 1 1 3 7', right:'M20 5v6h-6m6 0a8 8 0 1 0-3 7',
  minus:'M5 12h14', fit:'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5',
  cube:'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 2',
  play:'M8 4l12 8-12 8z', stop:'M6 6h12v12H6z',
  more:'M5 12h.01m6.99 0h.01m6.99 0h.01'
};
const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[name]}"/></svg>`;
const iconButton = (action, label, image, attributes = '') =>
  `<button type="button" class="vut-icon" data-action="${action}" aria-label="${label}" title="${label}" ${attributes}>${icon(image)}</button>`;

const styles = `
<style>
.vut {--line:#323037;--panel:#18191e;--muted:#aaaab7;--accent:#ff566f;color:#f8f7fa;margin:14px 0;min-width:0}
.vut * {box-sizing:border-box}
.vut [hidden] {display:none!important}
.vut h1,.vut h2 {margin:0;letter-spacing:-.035em}
.vut h1 {font-size:clamp(23px,5vw,33px);line-height:1.1}
.vut h2 {font-size:17px}
.vut svg {width:20px;height:20px;flex:none}
.vut-card {background:var(--panel);border:1px solid var(--line);border-radius:15px;padding:clamp(11px,2.4vw,18px);margin-bottom:10px;min-width:0}
.vut-head,.vut-between,.vut-row {display:flex;gap:8px;align-items:center}
.vut-head,.vut-between {justify-content:space-between}
.vut-row {flex-wrap:wrap}
.vut-brand {display:flex;align-items:center;gap:10px;min-width:0}
.vut-brand>span {display:grid;place-items:center;width:42px;height:42px;background:#3e2029;color:var(--accent);border-radius:11px;flex:none}
.vut-brand svg {width:24px;height:24px}
.vut button,.vut input,.vut select,.vut textarea,.vut summary {font:inherit;color:inherit;background:#222329;border:1px solid var(--line);border-radius:9px;min-width:0;max-width:100%}
.vut button,.vut summary {cursor:pointer;min-height:42px;padding:7px 11px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:650;line-height:1.15}
.vut button:focus-visible,.vut summary:focus-visible,.vut input:focus-visible,.vut select:focus-visible,.vut textarea:focus-visible {outline:2px solid var(--accent);outline-offset:2px}
.vut button[aria-pressed=true] {background:#40222c;border-color:#b7455b;color:#ffdbe2}
.vut button[data-action=save] {background:#bc2441;border-color:#ed5a71;color:#fff}
.vut button:disabled {opacity:.42;cursor:default}
.vut button.vut-icon,.vut summary.vut-icon {width:42px;padding:0;flex:none}
.vut-heading-actions {display:flex;align-items:center;gap:6px;flex:none}
.vut-menu {position:relative}
.vut-menu summary::-webkit-details-marker {display:none}
.vut-menu>div {position:absolute;right:0;top:calc(100% + 6px);z-index:5;background:#1e1e25;border:1px solid #47434c;border-radius:10px;padding:5px;display:grid;min-width:170px;box-shadow:0 12px 25px #0008}
.vut-menu button {justify-content:flex-start;background:none;border-color:transparent;white-space:nowrap}
.vut label {display:grid;gap:4px;font-size:12px;font-weight:650;color:#ccccd6;min-width:0}
.vut input,.vut select,.vut textarea {display:block;width:100%;min-height:42px;margin:0;padding:8px 10px;font-size:16px;font-weight:450;color-scheme:dark}
.vut input[type=date] {min-inline-size:0;-webkit-appearance:none;appearance:none}
.vut input[type=date]::-webkit-date-and-time-value {text-align:left;min-height:20px}
.vut-grid {display:grid;grid-template-columns:minmax(0,2fr) repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
.vut-archive {display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:8px;margin-top:12px}
.vut-archive select {text-overflow:ellipsis}
.vut small,.vut-meta {color:var(--muted);font-size:12px;font-weight:600}
.vut-exercises {display:flex;overflow:auto;gap:6px;margin-top:8px;padding:2px 2px 5px}
.vut-exercises button {flex:none;max-width:210px}
.vut-exercises button span {overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vut-exercises small {white-space:nowrap}
.vut-stage {padding:0;overflow:hidden}
.vut-stage-header,.vut-inspector {display:flex;gap:6px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:8px 10px}
.vut-controls {display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.vut-controls button {background:#22272a}
.vut-board {background:#10201a;border-block:1px solid #37463f;overflow:hidden;position:relative}
.vut canvas {display:block;width:100%;height:auto;touch-action:none;cursor:crosshair}
.vut canvas[data-preview] {position:absolute;inset:0;pointer-events:none}
.vut [data-action=preview] {color:#b4f5c7}
.vut canvas[data-mode=select] {cursor:grab}
.vut canvas[data-mode=pan] {cursor:move}
.vut-hint {padding:0 10px 9px;margin:0;color:var(--muted);font-size:12px;line-height:1.35}
.vut-palette {display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;padding:9px 10px;border-top:1px solid var(--line)}
.vut-palette button {display:grid;justify-items:center;gap:3px;padding:6px 1px;font-size:clamp(9px,2.4vw,11px);min-height:49px;letter-spacing:-.02em}
.vut-palette svg {color:#b4b9c9}
.vut-palette [data-tool=player] svg,.vut-palette [data-tool=disc] svg {color:#ff6b91}
.vut-palette [data-tool=opponent] svg,.vut-palette [data-tool=pass] svg {color:#72d5ff}
.vut-palette [data-tool=hurdle] svg,.vut-palette [data-tool=ladder] svg,.vut-palette [data-tool=run] svg {color:#eeef74}
.vut-palette [data-tool=cone] svg,.vut-palette [data-tool=pole] svg {color:#ffb46b}
.vut-inspector {border-top:1px solid var(--line)}
.vut-inspector strong {font-size:13px}
.vut-inspector label {display:flex;align-items:center;gap:5px}
.vut-inspector select {width:auto}
.vut-inspector input {width:78px}
.vut-exercise-details {display:grid;grid-template-columns:minmax(0,1fr) minmax(90px,120px);gap:8px}
.vut-exercise-details>label:last-child {grid-column:1/-1}
.vut textarea {resize:vertical}
.vut-status {color:#ffc0cf;font-size:13px;margin:6px 0 0}
.vut-status:empty {display:none}
@media(max-width:560px){
  .vut-grid {grid-template-columns:repeat(2,minmax(0,1fr))}
  .vut-grid label:first-child {grid-column:1/-1}
  .vut-heading-actions>button span {display:none}
  .vut-heading-actions>button {width:42px;padding:0}
}
@media(max-width:370px) {.vut-brand>span {display:none}.vut h1 {font-size:22px}}
@media(min-width:720px) {.vut-palette {grid-template-columns:repeat(12,minmax(0,1fr))}}
</style>`;

export async function mountTraining(host, client, profile, categoryNames, onDirty) {
  if (!canUseTraining(profile)) return;
  host.innerHTML = styles + `
  <section class="vut" aria-label="Modulo Allenamento">
    <div class="vut-card">
      <div class="vut-head">
        <div class="vut-brand"><span>${icon('field')}</span><h1>Allenamento</h1></div>
        <div class="vut-heading-actions">
          <button data-action="save" aria-label="Salva seduta" title="Salva seduta" type="button">${icon('save')}<span>Salva</span></button>
          <button data-action="pdf" aria-label="Scarica PDF" title="Scarica PDF" type="button">${icon('pdf')}<span>PDF</span></button>
          <details class="vut-menu"><summary class="vut-icon" aria-label="Azioni seduta" title="Azioni seduta">${icon('more')}</summary><div>
            <button data-action="copy" type="button" disabled>${icon('copy')} Duplica seduta</button>
            <button data-action="delete" type="button" disabled>${icon('trash')} Elimina seduta</button>
          </div></details>
        </div>
      </div>
      <div class="vut-archive">
        <label>Archivio sedute<select data-sessions><option value="">Nuova seduta</option></select></label>
        ${iconButton('new','Nuova seduta','new')}
      </div>
      <div class="vut-grid">
        <label>Titolo seduta<input name="title" maxlength="120" placeholder="Es. Coordinazione e conduzione"></label>
        <label>Data<input name="training_date" type="date"></label>
        <label>Categoria<input name="category" maxlength="80" list="vut-categories" placeholder="Categoria"></label>
        <datalist id="vut-categories">${categoryNames.map(name => `<option value="${escapeHtml(name)}"></option>`).join('')}</datalist>
      </div>
      <p class="vut-status" role="status" aria-live="polite"></p>
    </div>
    <div class="vut-card">
      <div class="vut-between"><h2>Esercizi</h2><span class="vut-row vut-meta">${icon('clock')} <span data-total></span></span><div class="vut-controls" data-exercise-actions></div></div>
      <div class="vut-exercises" aria-label="Esercizi della seduta" data-exercises></div>
    </div>
    <div class="vut-card vut-stage">
      <div class="vut-stage-header">
        <div class="vut-controls" aria-label="Vista del campo">
          <button data-action="2d" type="button" aria-pressed="true">${icon('field')} 2D</button>
          <button data-action="3d" type="button" aria-pressed="false">${icon('cube')} 3D</button>
          ${iconButton('rotate-left','Ruota campo a sinistra','left','hidden')}
          ${iconButton('rotate-right','Ruota campo a destra','right','hidden')}
        </div>
        <div class="vut-controls" aria-label="Zoom e navigazione">
          ${iconButton('zoom-out','Riduci zoom','minus')}
          ${iconButton('zoom-in','Aumenta zoom','new')}
          ${iconButton('fit','Inquadra tutto il campo','fit')}
          <button class="vut-icon" type="button" data-tool="pan" aria-label="Sposta la visuale" title="Sposta la visuale" aria-pressed="false">${icon('pan')}</button>
        </div>
      </div>
      <p class="vut-hint" data-hint></p>
      <div class="vut-board">
        <canvas width="1500" height="1000" aria-label="Lavagna del campo"></canvas>
        <canvas width="1500" height="1000" data-preview aria-hidden="true" hidden></canvas>
      </div>
      <div class="vut-inspector" data-preview-controls hidden>
        <button type="button" data-action="preview">${icon('play')} Anteprima esercizio</button>
        <small data-preview-mode></small>
      </div>
      <div class="vut-palette" aria-label="Attrezzi e percorsi">
        <button data-tool="select" type="button" aria-pressed="true">${icon('select')} Seleziona</button>
        ${Object.entries(equipment).map(([type,label]) => `<button type="button" data-tool="${type}" aria-pressed="false">${icon(type)} ${label}</button>`).join('')}
      </div>
      <div class="vut-inspector">
        <strong data-selection>Attrezzo</strong>
        <label data-height hidden>Altezza <select name="height">${heights.map(height => `<option value="${height}">${height} cm</option>`).join('')}</select></label>
        <div class="vut-controls">
          ${iconButton('object-left','Ruota elemento a sinistra','left')}
          ${iconButton('rotate-object','Ruota elemento a destra','right')}
          <label data-rotation hidden>Angolo <input name="rotation" type="number" min="0" max="359" inputmode="numeric"></label>
          ${iconButton('remove-object','Rimuovi elemento','trash')}
          ${iconButton('undo','Annulla ultima modifica','left')}
        </div>
      </div>
    </div>
    <div class="vut-card vut-exercise-details">
      <label>Nome esercizio<input name="exercise-title" maxlength="120" placeholder="Es. Circuito a stazioni"></label>
      <label>Durata (min)<input name="minutes" type="number" min="1" max="180"></label>
      <label>Obiettivo e svolgimento<textarea name="notes" maxlength="3000" rows="3"></textarea></label>
    </div>
  </section>`;

  const find = selector => host.querySelector(selector);
  const action = name => find(`[data-action="${name}"]`);
  const field = name => find(`[name="${name}"]`);
  const list = find('[data-sessions]');
  const canvas = find('canvas');
  const status = find('[role=status]');
  const previewCanvas = find('[data-preview]');
  let session = newSession();
  let sessions = [];
  let index = 0;
  let dirty = false;
  let busy = false;
  let tool = 'select';
  let selected = -1;
  let routeStart = null;
  let drag = null;
  let view3d = false;
  let angle = -.15;
  let undo = [];
  let viewport = {zoom:1,x:0,y:0};
  const pointers = new Map();
  let gesture = null;
  let pointerEvents = null;
  let frame = null;
  let exporting = false;
  let loadingArchive = true;
  let playback = null;
  const exercise = () => session.exercises[index];

  function markDirty(value = true) {
    dirty = value;
    if (host.isConnected) onDirty(value);
  }

  function updateArchive() {
    list.replaceChildren(new Option('Nuova seduta', ''), ...sessions.map(row =>
      new Option(`${row.training_date.split('-').reverse().join('/')} · ${row.title}`, row.id)));
    list.value = sessions.some(row => row.id === session.id) ? session.id : '';
    action('delete').disabled = busy || loadingArchive || !list.value;
    action('copy').disabled = busy || loadingArchive || !list.value;
    list.disabled = busy || loadingArchive;
  }

  async function readSessions() {
    const {data, error} = await client.from(table).select('id,title,training_date').order('training_date', {ascending:false}).order('updated_at', {ascending:false});
    if (error) throw error;
    const entries = new Map(data.map(row => [row.id,row]));
    for (const row of sessions) entries.set(row.id,row);
    sessions = [...entries.values()].sort((a,b) => b.training_date.localeCompare(a.training_date));
  }

  function changeSession(value) {
    session = value;
    markDirty(false);
    for (const key of ['title', 'training_date', 'category']) field(key).value = session[key];
    openExercise(0);
    updateArchive();
  }

  function openExercise(next) {
    stopPreview();
    index = next;
    selected = -1;
    routeStart = null;
    resetPointers();
    undo = [];
    fit();
    setTool('select');
    field('exercise-title').value = exercise().title;
    field('minutes').value = exercise().minutes;
    field('notes').value = exercise().notes;
    updateExercises();
    paint();
  }

  function updateExercises() {
    const total = session.exercises.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
    find('[data-total]').textContent = total + ' min totali';
    const tabs = find('[data-exercises]');
    const scroll = tabs.scrollLeft;
    tabs.innerHTML = session.exercises.map((entry, position) =>
      `<button type="button" data-exercise="${position}" aria-pressed="${index === position}"><span>${escapeHtml(entry.title || `Esercizio ${position + 1}`)}</span><small>${Number(entry.minutes) || 0} min</small></button>`
    ).join('');
    tabs.scrollLeft = scroll;
    find('[data-exercise-actions]').innerHTML =
      iconButton('add-exercise','Aggiungi esercizio','new',session.exercises.length >= 30 ? 'disabled' : '') +
      iconButton('remove-exercise','Elimina esercizio','trash',session.exercises.length === 1 ? 'disabled' : '');
  }

  function snapshot() {
    undo.push(structuredClone(exercise().objects));
    if (undo.length > 30) undo.shift();
  }

  function selectionRotation(entry) {
    if (!entry) return null;
    if (entry.end) return (Math.round(Math.atan2(entry.end[1]-entry.y,entry.end[0]-entry.x)*180/Math.PI)+360)%360;
    return ['hurdle','goal','ladder','player','opponent'].includes(entry.type) ? entry.rotation || 0 : null;
  }

  function drawBoard() {
    const objects = exercise().objects;
    const entry = objects[selected];
    let grip = null;
    if (tool === 'select' && entry && !entry.end && selectionRotation(entry) !== null) {
      grip = rotationGrip(entry);
    }
    drawField(canvas,objects,view3d,angle,selected,routeStart,viewport,screenUnits(1),grip);
  }

  function queueBoard() {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (canvas.isConnected) drawBoard();
    });
  }

  function updatePreview() {
    const objects = exercise().objects;
    const hasRun = objects.some(object => object.type === 'run' && object.end);
    const hasCircuit = objects.filter(isCircuitEquipment).length >= 2;
    find('[data-preview-controls]').hidden = !(hasRun || hasCircuit);
    find('[data-preview-mode]').textContent = hasRun ? 'Segue la freccia di corsa' : 'Segue l’ordine degli attrezzi';
  }

  function stopPreview() {
    if (!playback) return;
    cancelAnimationFrame(playback.frame);
    playback = null;
    previewCanvas.hidden = true;
    action('preview').innerHTML = icon('play') + ' Anteprima esercizio';
  }

  function startPreview() {
    const objects = exercise().objects;
    const route = previewRoute(objects,selected);
    if (!route) return;
    const duration = clamp(route.length*115,2800,18000);
    const context = previewCanvas.getContext('2d');
    playback = {start:null,frame:null};
    previewCanvas.hidden = false;
    action('preview').innerHTML = icon('stop') + ' Ferma anteprima';
    function tick(time) {
      if (!playback || !canvas.isConnected) return stopPreview();
      playback.start ??= time;
      const progress = clamp((time-playback.start)/duration,0,1);
      renderPreview(context,route,progress);
      if (progress < 1) playback.frame = requestAnimationFrame(tick);
      else stopPreview();
    }
    playback.frame = requestAnimationFrame(tick);
  }

  function renderPreview(context,route,progress) {
    context.clearRect(0,0,previewCanvas.width,previewCanvas.height);
    const distance = route.length*progress;
    const step = route.segments.find(part => distance <= part.start+part.length) || route.segments.at(-1);
    const fraction = clamp((distance-step.start)/step.length,0,1);
    const x = step.a[0]+(step.b[0]-step.a[0])*fraction;
    const y = step.a[1]+(step.b[1]-step.a[1])*fraction;
    const rise = route.jumps.reduce((jump,d) => {
      const phase = Math.abs(d-distance)/2.8;
      return Math.max(jump,phase < 1 ? Math.cos(phase*Math.PI/2) : 0);
    },0);
    const [groundX,groundY] = at(x,y);
    const [px,py] = at(x,y,view3d ? rise*6 : 0);
    const unit = screenUnits(1);
    const bob = view3d ? py : py-rise*12*unit;
    const radius = 7*unit;
    context.beginPath();
    context.ellipse(groundX,groundY+2*unit,9*unit,3*unit,0,0,Math.PI*2);
    context.fillStyle = '#102218a0';
    context.fill();
    const [aheadX,aheadY] = at(step.b[0],step.b[1]);
    const [backX,backY] = at(step.a[0],step.a[1]);
    const direction = Math.atan2(aheadY-backY,aheadX-backX);
    context.beginPath();
    context.moveTo(px+Math.cos(direction)*12*unit,bob+Math.sin(direction)*12*unit);
    context.lineTo(px+Math.cos(direction+.6)*radius,bob+Math.sin(direction+.6)*radius);
    context.lineTo(px+Math.cos(direction-.6)*radius,bob+Math.sin(direction-.6)*radius);
    context.closePath();
    context.fillStyle = '#fff';
    context.fill();
    context.beginPath();
    context.arc(px,bob,radius,0,Math.PI*2);
    context.fillStyle = rise > .1 ? '#edbf42' : '#e24263';
    context.fill();
    context.lineWidth = 2*unit;
    context.strokeStyle = '#fff';
    context.stroke();
  }

  function paint() {
    const objects = exercise().objects;
    const entry = objects[selected];
    const rotation = selectionRotation(entry);
    queueBoard();
    updatePreview();
    canvas.dataset.mode = tool;
    action('remove-object').disabled = busy || !entry;
    action('rotate-object').disabled = action('object-left').disabled = busy || rotation === null;
    action('undo').disabled = busy || !undo.length;
    action('zoom-in').disabled = busy || viewport.zoom >= 4;
    action('zoom-out').disabled = busy || viewport.zoom <= 1;
    const height = field('height');
    find('[data-height]').hidden = entry?.type !== 'hurdle' && tool !== 'hurdle';
    if (entry?.type === 'hurdle') height.value = entry.height || 15;
    find('[data-rotation]').hidden = rotation === null;
    if (document.activeElement !== field('rotation')) field('rotation').value = rotation ?? '';
    const passNumber = entry?.type === 'pass' ? objects.slice(0,selected+1).filter(isPass).length : null;
    find('[data-selection]').textContent = entry
      ? equipment[entry.type] + (passNumber ? ' ' + passNumber : '') + ' selezionato'
      : 'Nessun elemento selezionato';
    find('[data-hint]').textContent = tool === 'pan' ? 'Trascina per spostare l’inquadratura.'
      : routeStart ? 'Tocca la destinazione della freccia.'
      : tool === 'select' && entry?.end ? 'Trascina i cerchi alle estremità per cambiare la lunghezza o il rombo centrale per curvare la freccia.'
      : tool === 'select' && rotation !== null ? 'Trascina l’elemento per spostarlo o la maniglia ↻ per ruotarlo.'
      : tool === 'select' ? 'Tocca per selezionare un elemento o trascinalo per spostarlo.'
      : tool === 'run' || tool === 'pass' ? 'Tocca il punto di partenza della freccia.'
      : 'Tocca più punti sul campo per aggiungere: ' + equipment[tool] + '.';
  }

  function setTool(next) {
    tool = next;
    routeStart = null;
    if (tool !== 'select' && tool !== 'pan') selected = -1;
    host.querySelectorAll('[data-tool]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.tool === tool)));
  }

  function cameraFor(zoom, screenPoint, worldPoint) {
    return {
      zoom,
      x:clamp(screenPoint[0]-worldPoint[0]*zoom,canvas.width*(1-zoom),0),
      y:clamp(screenPoint[1]-worldPoint[1]*zoom,canvas.height*(1-zoom),0)
    };
  }

  function zoomAt(zoom, point) {
    viewport = cameraFor(clamp(zoom,1,4), point, viewPoint(point, viewport));
    paint();
  }

  function screenPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return [(event.clientX-rect.left)*canvas.width/rect.width, (event.clientY-rect.top)*canvas.height/rect.height];
  }

  function pitchPoint(point) {
    return unproject(canvas,view3d,angle,viewPoint(point,viewport));
  }

  function fit() {
    viewport = {zoom:1,x:0,y:0};
  }

  const screenUnits = pixels => pixels*canvas.width/(canvas.getBoundingClientRect().width || canvas.width);
  const at = (x,y,z) => {
    const [px,py] = projectPoint(canvas,view3d,angle,x,y,z);
    return [px*viewport.zoom+viewport.x,py*viewport.zoom+viewport.y];
  };

  function rotationGrip(entry) {
    const center = at(entry.x,entry.y);
    if (center[0] < 0 || center[0] > canvas.width || center[1] < 0 || center[1] > canvas.height) return null;
    const radians = (entry.rotation || 0)*Math.PI/180;
    const tip = at(entry.x+Math.cos(radians),entry.y+Math.sin(radians));
    const dx = tip[0]-center[0];
    const dy = tip[1]-center[1];
    const length = Math.hypot(dx,dy) || 1;
    const reach = screenUnits(34)/length;
    const [gx,gy] = [center[0]+dx*reach,center[1]+dy*reach];
    const margin = screenUnits(13);
    return {center,point:[clamp(gx,margin,canvas.width-margin),clamp(gy,margin,canvas.height-margin)]};
  }

  function dragAngle(object,x,y) {
    return Math.atan2(y-object.y,x-object.x)*180/Math.PI;
  }

  function pickHandle(entry,point) {
    if (!entry) return null;
    if (!entry.end) {
      if (selectionRotation(entry) === null) return null;
      const grip = rotationGrip(entry);
      if (!grip) return null;
      const [x,y] = grip.point;
      return Math.hypot(point[0]-x,point[1]-y) <= screenUnits(16) ? 'rotation' : null;
    }
    let best = screenUnits(17);
    let picked = null;
    for (const [handle,position] of Object.entries(routeHandles(entry))) {
      const [x,y] = at(...position);
      const distance = Math.hypot(point[0]-x,point[1]-y);
      if (distance <= best) {
        best = distance;
        picked = handle;
      }
    }
    return picked;
  }

  function pickObject(point) {
    let best = screenUnits(21);
    let picked = -1;
    exercise().objects.forEach((entry,index) => {
      const base = at(entry.x,entry.y);
      let distance = Math.hypot(point[0]-base[0],point[1]-base[1]);
      if (entry.end) {
        const points = routePoints(entry).map(p => at(...p));
        distance = Math.min(...points.slice(1).map((p,i) => segmentDistance(point,points[i],p)));
      }
      const z = {hurdle:(entry.height || 15)/10,goal:3,player:3,opponent:3,pole:6,cone:2.9}[entry.type];
      if (view3d && z) distance = segmentDistance(point,base,at(entry.x,entry.y,z));
      if (distance <= best) {
        best = distance;
        picked = index;
      }
    });
    return picked;
  }

  function place(point) {
    const [x,y] = pitchPoint(point);
    if (x < 0 || x > 100 || y < 0 || y > 64) return;
    const objects = exercise().objects;
    if (objects.length >= 90) {
      find('[data-hint]').textContent = 'Massimo 90 elementi per esercizio.';
      return;
    }
    const entry = {type:tool,x,y};
    if (tool === 'run' || tool === 'pass') {
      if (!routeStart) {
        routeStart = [x,y];
        paint();
        return;
      }
      if (Math.hypot(x-routeStart[0],y-routeStart[1]) < 1) return;
      [entry.x,entry.y] = routeStart;
      entry.end = [x,y];
    } else if (tool === 'hurdle') {
      entry.height = Number(field('height').value);
    }
    snapshot();
    const placed = objects.push(entry)-1;
    if (entry.end) {
      selected = placed;
      setTool('select');
    }
    markDirty();
    paint();
  }

  function pinchState() {
    const [a,b] = pointers.values();
    return {center:[(a[0]+b[0])/2,(a[1]+b[1])/2], distance:Math.max(1,Math.hypot(a[0]-b[0],a[1]-b[1]))};
  }

  function resetPointers() {
    const activePointers = [...pointers.keys()];
    pointers.clear();
    drag = null;
    gesture = null;
    pointerEvents?.abort();
    pointerEvents = null;
    for (const id of activePointers) {
      if (canvas.hasPointerCapture?.(id)) {
        try { canvas.releasePointerCapture(id); } catch { /* Il puntatore è già terminato. */ }
      }
    }
  }

  function watchPointers() {
    pointerEvents = new AbortController();
    const options = {signal:pointerEvents.signal};
    window.addEventListener('pointerup',finishPointer,options);
    window.addEventListener('pointercancel',cancelPointer,options);
    window.addEventListener('blur',resetPointers,options);
    window.addEventListener('pagehide',resetPointers,options);
    document.addEventListener('visibilitychange',() => {
      if (document.hidden) resetPointers();
    },options);
  }

  canvas.onpointerdown = event => {
    if (busy || event.button !== 0) return;
    stopPreview();
    if (event.isPrimary && pointers.size) resetPointers();
    if (pointers.size >= 2) return;
    if (!pointers.size) watchPointers();
    const point = screenPoint(event);
    pointers.set(event.pointerId,point);
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Restano attivi gli eventi di fine gesto. */ }
    if (pointers.size === 2) {
      const state = pinchState();
      gesture = {...state, zoom:viewport.zoom, anchor:viewPoint(state.center,viewport)};
      drag = null;
      return;
    }
    const [x,y] = pitchPoint(point);
    let handle = null;
    if (tool === 'select') {
      handle = pickHandle(exercise().objects[selected],point);
      if (!handle) selected = pickObject(point);
    }
    drag = {
      id:event.pointerId, point, x, y, moved:false, viewport, handle,
      original:tool === 'select' && selected >= 0 ? structuredClone(exercise().objects[selected]) : null
    };
    paint();
  };

  canvas.onpointermove = event => {
    if (!pointers.has(event.pointerId) || busy) return;
    const point = screenPoint(event);
    pointers.set(event.pointerId,point);
    if (gesture) {
      const state = pinchState();
      viewport = cameraFor(clamp(gesture.zoom*state.distance/gesture.distance,1,4),state.center,gesture.anchor);
      queueBoard();
      return;
    }
    if (drag?.id !== event.pointerId) return;
    const [startX,startY] = drag.point;
    const threshold = 3*canvas.width/canvas.getBoundingClientRect().width;
    if (!drag.moved && Math.hypot(point[0]-startX,point[1]-startY) < threshold) return;
    if (tool === 'pan') {
      viewport = cameraFor(drag.viewport.zoom,point,viewPoint(drag.point,drag.viewport));
    } else if (drag.original) {
      const [x,y] = pitchPoint(point);
      if (!drag.moved) snapshot();
      const {original} = drag;
      if (drag.handle === 'rotation') {
        const rotation = Math.round((original.rotation || 0)+dragAngle(original,x,y)-dragAngle(original,drag.x,drag.y));
        exercise().objects[selected] = orientObject(original,(rotation%360+360)%360);
      } else {
        exercise().objects[selected] = drag.handle
          ? editRoute(original,drag.handle,x-drag.x,y-drag.y)
          : moveObject(original,x-drag.x,y-drag.y);
      }
      if (!drag.moved) markDirty();
    }
    drag.moved = true;
    queueBoard();
  };

  function endPointer(event, complete) {
    if (!pointers.delete(event.pointerId)) return;
    gesture = null;
    const active = drag;
    drag = null;
    if (!pointers.size) resetPointers();
    if (complete && !busy && active?.id === event.pointerId && !active.moved && tool !== 'select' && tool !== 'pan') {
      place(screenPoint(event));
    } else if (!pointers.size) paint();
  }

  function finishPointer(event) { endPointer(event,true); }
  function cancelPointer(event) { endPointer(event,false); }
  canvas.onpointerup = finishPointer;
  canvas.onpointercancel = canvas.onlostpointercapture = cancelPointer;
  canvas.addEventListener('wheel', event => {
    if (busy || (!event.ctrlKey && !event.metaKey && tool !== 'pan')) return;
    event.preventDefault();
    zoomAt(viewport.zoom*Math.exp(-event.deltaY*.002),screenPoint(event));
  },{passive:false});

  function rotateSelection(degrees) {
    const entry = exercise().objects[selected];
    const current = selectionRotation(entry);
    if (current === null) return;
    const rotation = (Math.round(degrees)%360+360)%360;
    if (current === rotation) return;
    snapshot();
    exercise().objects[selected] = orientObject(entry,rotation);
    markDirty();
    paint();
  }

  field('rotation').onchange = () => {
    if (field('rotation').value === '') return;
    rotateSelection(Number(field('rotation').value));
    field('rotation').value = selectionRotation(exercise().objects[selected]) ?? '';
  };

  field('height').onchange = () => {
    const entry = exercise().objects[selected];
    if (entry?.type !== 'hurdle') return;
    snapshot();
    entry.height = Number(field('height').value);
    markDirty();
    paint();
  };

  function setBusy(value) {
    busy = value;
    if (value) {
      resetPointers();
      stopPreview();
    }
    for (const control of host.querySelectorAll('button,input,select,textarea')) control.disabled = value;
    if (!value) {
      action('pdf').disabled = exporting;
      updateExercises();
      updateArchive();
      paint();
    }
  }

  async function perform(message, work) {
    setBusy(true);
    status.textContent = message;
    try {
      await work();
    } catch (error) {
      console.error(error);
      status.textContent = 'Operazione non riuscita. Riprova.';
    } finally {
      if (host.isConnected) setBusy(false);
    }
  }

  list.onchange = () => {
    const id = list.value;
    updateArchive();
    if (dirty && !confirm('Abbandonare le modifiche non salvate?')) return;
    if (!id) return changeSession(newSession());
    void perform('Apertura seduta…', async () => {
      const {data, error} = await client.from(table).select('id,title,training_date,category,exercises').eq('id',id).single();
      if (error) throw error;
      changeSession(data);
      status.textContent = 'Seduta aperta.';
    });
  };

  for (const key of ['title','training_date','category','exercise-title','minutes','notes']) {
    field(key).oninput = () => {
      const value = field(key).value;
      if (key === 'exercise-title') exercise().title = value;
      else if (key === 'minutes') exercise().minutes = Number(value);
      else if (key === 'notes') exercise().notes = value;
      else session[key] = value;
      markDirty();
      if (key === 'exercise-title' || key === 'minutes') updateExercises();
    };
  }

  function validSession() {
    if (!session.title.trim() || !session.training_date) {
      status.textContent = 'Inserisci titolo e data della seduta.';
      return false;
    }
    if (session.exercises.some(entry => !Number.isInteger(entry.minutes) || entry.minutes < 1 || entry.minutes > 180)) {
      status.textContent = 'Imposta una durata da 1 a 180 minuti per ogni esercizio.';
      return false;
    }
    return true;
  }

  async function exportPdf() {
    const copy = structuredClone(session);
    exporting = true;
    action('pdf').disabled = true;
    const pending = 'Preparazione del PDF…';
    status.textContent = pending;
    try {
      const {downloadTrainingPdf} = await import('./allenamento-pdf.js');
      const board = document.createElement('canvas');
      board.width = 1200;
      board.height = 800;
      await downloadTrainingPdf(copy,equipment,objects => {
        drawField(board,objects,false,0,-1,null);
        return board.toDataURL('image/png');
      });
      if (status.textContent === pending) status.textContent = 'PDF della seduta pronto.';
    } catch (error) {
      console.error(error);
      if (status.textContent === pending) status.textContent = 'Esportazione PDF non riuscita. Riprova.';
    } finally {
      exporting = false;
      action('pdf').disabled = busy;
    }
  }

  host.onclick = event => {
    const button = event.target.closest('button');
    if (!button || busy) return;
    if (button.dataset.exercise != null) return openExercise(Number(button.dataset.exercise));
    if (button.dataset.tool) {
      stopPreview();
      setTool(button.dataset.tool);
      return paint();
    }
    if (button.closest('.vut-menu')) button.closest('details').open = false;
    if (['remove-object','rotate-object','object-left','undo'].includes(button.dataset.action)) stopPreview();
    switch (button.dataset.action) {
      case 'preview':
        if (playback) stopPreview();
        else startPreview();
        break;
      case 'new':
        if (!dirty || confirm('Abbandonare le modifiche non salvate?')) {
          changeSession(newSession());
          status.textContent = '';
        }
        break;
      case 'copy': {
        const source = structuredClone(session);
        const draft = newSession();
        draft.title = source.title.slice(0, 112).trimEnd() + ' (copia)';
        draft.category = source.category;
        draft.exercises = source.exercises;
        changeSession(draft);
        markDirty();
        status.textContent = 'Copia pronta. Salvala per aggiungerla all’archivio.';
        break;
      }
      case 'pdf':
        if (exporting || !validSession()) return;
        void exportPdf();
        break;
      case 'save':
        if (!validSession()) return;
        void perform('Salvataggio…', async () => {
          const {error} = await client.from(table).upsert({...session, title:session.title.trim(), updated_at:new Date().toISOString()}).select('id').single();
          if (error) throw error;
          markDirty(false);
          sessions = [session, ...sessions.filter(row => row.id !== session.id)]
            .sort((a,b) => b.training_date.localeCompare(a.training_date));
          updateArchive();
          status.textContent = 'Seduta salvata.';
        });
        break;
      case 'delete':
        if (!list.value || !confirm('Eliminare definitivamente questa seduta?')) return;
        void perform('Eliminazione…', async () => {
          const {error} = await client.from(table).delete().eq('id',session.id).select('id').single();
          if (error) throw error;
          sessions = sessions.filter(row => row.id !== session.id);
          changeSession(newSession());
          status.textContent = 'Seduta eliminata.';
        });
        break;
      case 'add-exercise':
        if (session.exercises.length >= 30) return;
        session.exercises.push(newExercise());
        markDirty();
        openExercise(session.exercises.length - 1);
        break;
      case 'remove-exercise':
        if (session.exercises.length <= 1 || !confirm('Eliminare questo esercizio dalla seduta?')) return;
        session.exercises.splice(index, 1);
        markDirty();
        openExercise(Math.max(0,index-1));
        break;
      case '2d':
      case '3d':
        view3d = button.dataset.action === '3d';
        action('2d').setAttribute('aria-pressed', String(!view3d));
        action('3d').setAttribute('aria-pressed', String(view3d));
        action('rotate-left').hidden = action('rotate-right').hidden = !view3d;
        fit();
        routeStart = null;
        paint();
        break;
      case 'rotate-left':
      case 'rotate-right':
        angle += button.dataset.action === 'rotate-left' ? -.25 : .25;
        paint();
        break;
      case 'zoom-in':
      case 'zoom-out':
        zoomAt(viewport.zoom*(button.dataset.action === 'zoom-in' ? 1.35 : 1/1.35),[canvas.width/2,canvas.height/2]);
        break;
      case 'fit':
        fit();
        paint();
        break;
      case 'object-left':
      case 'rotate-object':
        rotateSelection((selectionRotation(exercise().objects[selected]) ?? 0) +
          (button.dataset.action === 'object-left' ? -15 : 15));
        break;
      case 'remove-object':
        if (selected < 0) return;
        snapshot();
        exercise().objects.splice(selected,1);
        selected = -1;
        markDirty();
        paint();
        break;
      case 'undo':
        if (!undo.length) return;
        exercise().objects = undo.pop();
        selected = -1;
        routeStart = null;
        markDirty();
        paint();
        break;
    }
  };

  changeSession(session);
  try {
    await readSessions();
  } catch (error) {
    console.error(error);
    if (!status.textContent) status.textContent = 'Archivio sedute temporaneamente non disponibile.';
  } finally {
    loadingArchive = false;
    if (host.isConnected) updateArchive();
  }
}

const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
const viewPoint = ([x,y], {zoom,x:left,y:top}) => [(x-left)/zoom,(y-top)/zoom];

function projectPoint({width:w,height:h}, perspective, angle, x, y, z = 0) {
  if (!perspective) return [w*(.06 + .88*x/100),h*(.09 + .82*y/64)];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x-50;
  const dy = y-32;
  const right = dx*cos-dy*sin;
  const depth = dx*sin+dy*cos;
  const scale = 1 / (1 - depth*.004);
  return [w/2+right*10*scale, h*.53+(depth*7-z*11)*scale];
}

function unproject({width:w,height:h}, perspective, angle, [x,y]) {
  if (!perspective) return [(x/w-.06)/.88*100,(y/h-.09)/.82*64];
  const vertical = y-h*.53;
  const depth = vertical/(7+.004*vertical);
  const right = (x-w/2)*(1-depth*.004)/10;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [50+right*cos+depth*sin,32-right*sin+depth*cos];
}

function segmentDistance([x,y],[ax,ay],[bx,by]) {
  const dx = bx-ax;
  const dy = by-ay;
  const fraction = clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy || 1),0,1);
  return Math.hypot(x-ax-fraction*dx,y-ay-fraction*dy);
}

const isPass = object => object.type === 'pass' && Boolean(object.end);

function routeHandles({x,y,end,control}) {
  const middle = [(x+end[0])/2,(y+end[1])/2];
  return {start:[x,y], bend:control ? [(middle[0]+control[0])/2,(middle[1]+control[1])/2] : middle, end};
}

function routePoints({x,y,end,control}) {
  if (!control) return [[x,y],end];
  return Array.from({length:25},(_,i) => {
    const t = i/24;
    const a = (1-t)**2;
    const b = 2*t*(1-t);
    const c = t**2;
    return [a*x+b*control[0]+c*end[0],a*y+b*control[1]+c*end[1]];
  });
}

const limitPoint = ([x,y]) => [clamp(x,0,100),clamp(y,0,64)];

function editRoute(object,handle,dx,dy) {
  const {x,y,end,control} = object;
  const handles = routeHandles(object);
  const [hx,hy] = handles[handle];
  if (handle === 'bend') {
    return {...object,control:limitPoint([2*(hx+dx)-(x+end[0])/2,2*(hy+dy)-(y+end[1])/2])};
  }
  const next = limitPoint([hx+dx,hy+dy]);
  const other = handle === 'start' ? end : [x,y];
  if (Math.hypot(next[0]-other[0],next[1]-other[1]) < 1) return object;
  const updated = handle === 'start' ? {...object,x:next[0],y:next[1]} : {...object,end:next};
  if (control) updated.control = limitPoint([control[0]+(next[0]-hx)/2,control[1]+(next[1]-hy)/2]);
  return updated;
}

function moveObject(object,dx,dy) {
  const {x,y,end,control} = object;
  const points = [[x,y], ...(end ? [end] : []), ...(control ? [control] : [])];
  dx = clamp(dx,-Math.min(...points.map(p=>p[0])),100-Math.max(...points.map(p=>p[0])));
  dy = clamp(dy,-Math.min(...points.map(p=>p[1])),64-Math.max(...points.map(p=>p[1])));
  const moved = {...object,x:x+dx,y:y+dy};
  if (end) moved.end = [end[0]+dx,end[1]+dy];
  if (control) moved.control = [control[0]+dx,control[1]+dy];
  return moved;
}

function orientObject(object,rotation) {
  if (!object.end) return {...object,rotation};
  const {x,y,end,control} = object;
  const radians = rotation*Math.PI/180-Math.atan2(end[1]-y,end[0]-x);
  const turn = ([px,py]) => [(px-x)*Math.cos(radians)-(py-y)*Math.sin(radians),(px-x)*Math.sin(radians)+(py-y)*Math.cos(radians)];
  const offsets = [[0,0],turn(end),...(control ? [turn(control)] : [])];
  const minX = Math.min(...offsets.map(p=>p[0]));
  const maxX = Math.max(...offsets.map(p=>p[0]));
  const minY = Math.min(...offsets.map(p=>p[1]));
  const maxY = Math.max(...offsets.map(p=>p[1]));
  const scale = Math.min(1,100/(maxX-minX || 1),64/(maxY-minY || 1));
  const nx = clamp(x,-minX*scale,100-maxX*scale);
  const ny = clamp(y,-minY*scale,64-maxY*scale);
  const absolute = ([dx,dy]) => limitPoint([nx+dx*scale,ny+dy*scale]);
  return {...object,x:nx,y:ny,end:absolute(offsets[1]),...(control ? {control:absolute(offsets[2])} : {})};
}

function isCircuitEquipment(object) {
  return ['disc','cone','hurdle','ladder','pole','goal'].includes(object.type);
}

function previewRoute(objects,selected) {
  const runs = objects.filter(object => object.type === 'run' && object.end);
  const active = objects[selected];
  const run = runs.includes(active) ? active : runs[0];
  const equipment = objects.filter(isCircuitEquipment);
  let points;
  if (run) {
    points = routePoints(run);
  } else {
    if (equipment.length < 2) return null;
    const stations = equipment.map(({x,y}) => [x,y]);
    let side = 1;
    points = stations.map(([x,y],i) => {
      if (!['disc','cone','pole'].includes(equipment[i].type)) return [x,y];
      const a = stations[Math.max(0,i-1)];
      const b = stations[Math.min(stations.length-1,i+1)];
      const dx = b[0]-a[0];
      const dy = b[1]-a[1];
      const length = Math.hypot(dx,dy) || 1;
      side *= -1;
      return limitPoint([x-dy/length*1.9*side,y+dx/length*1.9*side]);
    });
    const extend = (a,b) => {
      const dx = a[0]-b[0];
      const dy = a[1]-b[1];
      const length = Math.hypot(dx,dy) || 1;
      return limitPoint([a[0]+dx/length*4,a[1]+dy/length*4]);
    };
    points = [extend(points[0],points[1]),...points,extend(points.at(-1),points.at(-2))];
  }

  const segments = [];
  let length = 0;
  for (let i=1;i<points.length;i++) {
    const a = points[i-1];
    const b = points[i];
    const distance = Math.hypot(b[0]-a[0],b[1]-a[1]);
    if (distance < .01) continue;
    segments.push({a,b,start:length,length:distance});
    length += distance;
  }
  if (!segments.length) return null;
  const jumps = [];
  for (const {x,y} of equipment.filter(object => object.type === 'hurdle')) {
    let closest = 2.4;
    let crossing = null;
    for (const {a,b,start,length:segmentLength} of segments) {
      const dx = b[0]-a[0];
      const dy = b[1]-a[1];
      const t = clamp(((x-a[0])*dx+(y-a[1])*dy)/segmentLength**2,0,1);
      const distance = Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);
      if (distance < closest) {
        closest = distance;
        crossing = start+t*segmentLength;
      }
    }
    if (crossing !== null) jumps.push(crossing);
  }
  return {segments,length,jumps};
}

function drawField(canvas, objects, perspective, angle, selected, routeStart, viewport = {zoom:1,x:0,y:0}, units = 1, grip = null) {
  const ctx = canvas.getContext('2d');
  const {width:w,height:h} = canvas;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const project = (x,y,z) => projectPoint(canvas,perspective,angle,x,y,z);

  function path(points, fill, stroke, weight = 3, dash = []) {
    ctx.beginPath();
    points.forEach((point,index) => {
      const [x,y] = project(...point);
      if (index) ctx.lineTo(x,y);
      else ctx.moveTo(x,y);
    });
    if (fill) {
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = weight;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash(dash);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function rect(x,y,width,height) {
    return [[x,y],[x+width,y],[x+width,y+height],[x,y+height],[x,y]];
  }

  function ring(x,y,radius,z = 0) {
    return Array.from({length:33}, (_,i) => {
      const theta = i*Math.PI/16;
      return [x+radius*Math.cos(theta),y+radius*Math.sin(theta),z];
    });
  }

  ctx.fillStyle = '#101c18';
  ctx.fillRect(0,0,w,h);
  ctx.save();
  ctx.translate(viewport.x,viewport.y);
  ctx.scale(viewport.zoom,viewport.zoom);
  if (perspective) path(rect(-3,0,106,68),'#0a1411');
  path(rect(-2,-2,104,68),'#1c4933', '#39624e',2);
  for (let i=0;i<10;i++) path(rect(i*10,0,10,64),i%2 ? '#307951' : '#286d48');
  const white = '#d6e7d8';
  path(rect(0,0,100,64),null,white);
  path([[50,0],[50,64]],null,white);
  path(ring(50,32,8),null,white);
  path(ring(50,32,.45),white);
  for (const [x,smallX] of [[0,0],[84,94]]) {
    path(rect(x,13,16,38),null,white);
    path(rect(smallX,23,6,18),null,white);
    const left = x === 0;
    const spot = left ? 11 : 89;
    path(ring(spot,32,.35),white);
    const arc = Array.from({length:17},(_,i) => {
      const theta = -.87+i*1.74/16;
      return [spot+(left ? 1 : -1)*8*Math.cos(theta),32+8*Math.sin(theta)];
    });
    path(arc,null,white);
    const goalX = left ? 0 : 100;
    path([[goalX,28.4],[goalX+(left ? -2 : 2),28.4],[goalX+(left ? -2 : 2),35.6],[goalX,35.6]],'#d6e7d842',white,2);
  }

  const passLabels = [];
  objects.forEach((entry,index) => {
    const {type,end} = entry;
    if (!end) return;
    const points = routePoints(entry);
    const previous = points.at(-2);
    const heading = Math.atan2(end[1]-previous[1],end[0]-previous[0]);
    const color = type === 'run' ? '#ffdb6b' : '#6be1ff';
    const size = Math.min(2.9,Math.hypot(end[0]-entry.x,end[1]-entry.y)*.65);
    const dash = type === 'pass' ? [14,11] : [];
    if (index === selected) path(points,null,'#10231b',11,dash);
    path(points,null,color,6,dash);
    path([end,[end[0]-size*Math.cos(heading-.46),end[1]-size*Math.sin(heading-.46)],
      [end[0]-size*Math.cos(heading+.46),end[1]-size*Math.sin(heading+.46)]],color);
    if (isPass(entry)) {
      const middle = Math.floor((points.length-1)/2);
      const a = project(...points[middle]);
      const b = project(...points[middle+1]);
      const center = project(...routeHandles(entry).bend);
      const direction = Math.atan2(b[1]-a[1],b[0]-a[0]);
      passLabels.push({center,direction});
    }
  });

  const props = objects.map((entry,index) => ({entry,index})).filter(({entry}) => !entry.end);
  if (perspective) props.sort((a,b) =>
    (a.entry.x-b.entry.x)*sin+(a.entry.y-b.entry.y)*cos);
  for (const {entry,index} of props) {
    const {type,x,y} = entry;
    const rotation = (entry.rotation || 0)*Math.PI/180;
    const local = ([a,b,z]) => [x+a*Math.cos(rotation)-b*Math.sin(rotation),y+a*Math.sin(rotation)+b*Math.cos(rotation),z];
    const prop = (points,fill,stroke,weight) => path(points.map(local),fill,stroke,weight);
    if (index === selected) path(ring(x,y,3.1),null,'#fff',4,[9,6]);
    if (perspective) path(ring(x+.4,y+.6,1.6),'#132e2390');

    if (type === 'hurdle') {
      const z = (entry.height || 15)/10;
      const yellow = '#ecff39';
      for (const side of [-2.1,2.1]) {
        prop([[side,-1.1,0],[side,1.1,0]],null,'#233222',12);
        prop([[side,-1.1,0],[side,1.1,0]],null,yellow,7);
      }
      const barY = perspective ? 0 : -.6;
      const frame = [[-2.1,barY,0],[-2.1,barY,z],[2.1,barY,z],[2.1,barY,0]];
      prop(frame,null,'#293024',14);
      prop(frame,null,yellow,8);
      prop([[-1.72,barY,z],[1.72,barY,z]],null,'#f7ff9a',3);
      if (!perspective) {
        const [px,py] = project(x,y);
        ctx.font = 'bold 17px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#14271c';
        ctx.strokeText(String(entry.height || 15),px,py-13);
        ctx.fillStyle = '#f7ff9a';
        ctx.fillText(String(entry.height || 15),px,py-13);
      }
    } else if (type === 'ladder') {
      for (const side of [-1.2,1.2]) prop([[side,-4,0],[side,4,0]],null,'#ffbc45',5);
      for (const rung of [-4,-2,0,2,4]) prop([[-1.2,rung,0],[1.2,rung,0]],null,'#ffdc80',5);
    } else if (type === 'goal') {
      const z = perspective ? 3 : 0;
      prop([[-2.5,1.3,0],[-2.5,-1.3,z],[2.5,-1.3,z],[2.5,1.3,0]],'#c1d8d765','#a4bbbb',4);
      prop([[-2.5,-1.3,0],[-2.5,-1.3,z],[2.5,-1.3,z],[2.5,-1.3,0]],null,'#fff',7);
    } else if (type === 'cone' || type === 'disc') {
      const color = type === 'disc' ? '#ff50a2' : '#ff9c3c';
      path(ring(x,y,1.5),color,'#502946',3);
      if (perspective && type === 'cone') prop([[-1.4,0,0],[0,0,2.9],[1.4,0,0]],'#ff9c3c','#a84a21',3);
      else path(ring(x,y,.55,type==='disc' ? .4 : 0),'#ffe0ac');
    } else if (type === 'pole') {
      path(ring(x,y,1.2),'#ffc95a','#4e3320',4);
      if (perspective) prop([[0,0,0],[0,0,6]],null,'#ffc95a',7);
    } else {
      const ball = type === 'ball';
      const z = perspective && !ball ? 3 : 0;
      const color = ball ? '#fafafa' : type === 'player' ? '#f14967' : '#6bc6ff';
      if (z) prop([[0,0,0],[0,0,z]],null,'#172027',14);
      if (!ball && entry.rotation != null) {
        prop([[3,0,z],[1.35,-.9,z],[1.35,.9,z]],color,'#172027',2);
      }
      const [px,py] = project(x,y,z);
      const radius = ball ? 11 : 17;
      const shading = ctx.createRadialGradient(px-radius*.3,py-radius*.35,1,px,py,radius);
      shading.addColorStop(0,color);
      shading.addColorStop(.73,color);
      shading.addColorStop(1,ball ? '#919ca4' : '#263546');
      ctx.beginPath();
      ctx.arc(px,py,radius,0,2*Math.PI);
      ctx.fillStyle = shading;
      ctx.fill();
      if (ball) {
        ctx.beginPath();
        ctx.arc(px,py,4,0,2*Math.PI);
        ctx.fillStyle = '#252932';
        ctx.fill();
      }
    }
  }
  const badgeUnit = Math.max(units,2.6)/viewport.zoom;
  const badgeCenters = [];
  passLabels.forEach(({center:[x,y],direction},index) => {
    const offset = 17*badgeUnit;
    const margin = 12*badgeUnit;
    const positions = [[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1],[2.3,0],[-2.3,0]];
    const candidates = positions.map(([side,along]) => [
      clamp(x+offset*(Math.sin(direction)*side+Math.cos(direction)*along*1.25),margin,w-margin),
      clamp(y+offset*(-Math.cos(direction)*side+Math.sin(direction)*along*1.25),margin,h-margin)
    ]);
    const [labelX,labelY] = candidates.find(([px,py]) => badgeCenters.every(([bx,by]) =>
      Math.hypot(px-bx,py-by) >= 20*badgeUnit)) || candidates[0];
    badgeCenters.push([labelX,labelY]);
    ctx.beginPath();
    ctx.arc(labelX,labelY,9*badgeUnit,0,Math.PI*2);
    ctx.fillStyle = '#123b49';
    ctx.fill();
    ctx.lineWidth = 1.5*badgeUnit;
    ctx.strokeStyle = '#89e9ff';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + 11*badgeUnit + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index+1),labelX,labelY);
  });

  if (routeStart) path(ring(...routeStart,1),'#fff');
  const activeRoute = objects[selected];
  if (activeRoute?.end) {
    for (const [name,point] of Object.entries(routeHandles(activeRoute))) {
      const [x,y] = project(...point);
      const radius = (name === 'bend' ? 6 : 5.5)*units/viewport.zoom;
      ctx.beginPath();
      if (name === 'bend') {
        ctx.moveTo(x,y-radius);
        ctx.lineTo(x+radius,y);
        ctx.lineTo(x,y+radius);
        ctx.lineTo(x-radius,y);
        ctx.closePath();
      } else {
        ctx.arc(x,y,radius,0,2*Math.PI);
      }
      ctx.fillStyle = name === 'bend' ? '#ffdb6b' : '#fff';
      ctx.strokeStyle = '#172b22';
      ctx.lineWidth = 1.5*units/viewport.zoom;
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
  if (grip) {
    const [x,y] = grip.point;
    ctx.beginPath();
    ctx.moveTo(...grip.center);
    ctx.lineTo(x,y);
    ctx.lineWidth = 1.5*units;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x,y,11*units,0,2*Math.PI);
    ctx.fillStyle = '#172b22';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + 15*units + 'px system-ui, sans-serif';
    ctx.fillText('↻',x,y);
  }
}
