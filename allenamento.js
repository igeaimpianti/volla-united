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

const styles = `
<style>
.vut {color:#f7f5f5;background:#151316;border:1px solid #382f35;border-radius:18px;padding:clamp(12px,3vw,24px);margin:16px 0}
.vut h1 {font-size:clamp(27px,5vw,42px);margin:0 0 10px}
.vut h2 {font-size:17px;margin:0 0 8px}
.vut button,.vut input,.vut select,.vut textarea {font:inherit;color:inherit;background:#221e23;border:1px solid #51464e;border-radius:8px;padding:8px 11px;min-width:0}
.vut button {cursor:pointer;min-height:42px}
.vut button[aria-pressed=true],.vut button[data-action=save] {background:#ac1935;border-color:#ec5572;color:#fff}
.vut button:disabled {opacity:.5;cursor:default}
.vut label {display:grid;gap:4px;font-size:13px}
.vut .vut-row {display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:9px 0}
.vut .vut-grid {display:grid;grid-template-columns:minmax(0,2fr) repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}
.vut .vut-board {background:#0c1413;border:1px solid #394642;border-radius:12px;overflow:hidden}
.vut canvas {display:block;width:100%;height:auto;touch-action:none}
.vut [role=status] {min-height:1.4em;color:#f2c2ce;font-size:14px}
.vut textarea {resize:vertical;width:100%;box-sizing:border-box}
.vut .vut-toolbar {gap:5px}
.vut .vut-toolbar button {font-size:13px}
@media(max-width:560px){.vut .vut-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.vut .vut-grid label:first-child{grid-column:1/-1}}
</style>`;

export async function mountTraining(host, client, profile, categoryNames, onDirty) {
  if (!canUseTraining(profile)) return;
  host.innerHTML = styles + `
  <section class="vut" aria-label="Modulo Allenamento">
    <h1>Allenamento</h1>
    <div class="vut-row">
      <label>Archivio sedute<select data-sessions><option value="">Nuova seduta</option></select></label>
      <button data-action="new" type="button">Nuova seduta</button>
      <button data-action="save" type="button">Salva seduta</button>
      <button data-action="delete" type="button" disabled>Elimina seduta</button>
    </div>
    <div class="vut-grid">
      <label>Titolo seduta<input name="title" maxlength="120" placeholder="Es. Coordinazione e conduzione"></label>
      <label>Data<input name="training_date" type="date"></label>
      <label>Categoria<input name="category" maxlength="80" list="vut-categories"></label>
      <datalist id="vut-categories">${categoryNames.map(name => `<option value="${escapeHtml(name)}"></option>`).join('')}</datalist>
    </div>
    <h2>Esercizi</h2>
    <div class="vut-row" data-exercises></div>
    <div class="vut-grid">
      <label>Nome esercizio<input name="exercise-title" maxlength="120" placeholder="Es. Circuito a stazioni"></label>
      <label>Durata in minuti<input name="minutes" type="number" min="1" max="180"></label>
    </div>
    <label>Obiettivo e svolgimento<textarea name="notes" maxlength="3000" rows="3"></textarea></label>
    <div class="vut-row">
      <button data-action="2d" type="button" aria-pressed="true">Campo 2D</button>
      <button data-action="3d" type="button" aria-pressed="false">Vista 3D</button>
      <button data-action="rotate-left" aria-label="Ruota vista a sinistra" type="button" hidden>↶</button>
      <button data-action="rotate-right" aria-label="Ruota vista a destra" type="button" hidden>↷</button>
    </div>
    <div class="vut-row vut-toolbar" data-tools>
      <button data-tool="select" type="button" aria-pressed="true">Sposta</button>
      ${Object.entries(equipment).map(([type, label]) => `<button type="button" data-tool="${type}" aria-pressed="false">${label}</button>`).join('')}
      <label>Altezza ostacolo<select name="height">${heights.map(height => `<option value="${height}">${height} cm</option>`).join('')}</select></label>
      <button data-action="rotate-object" type="button" disabled>Ruota attrezzo</button>
      <button data-action="remove-object" type="button" disabled>Rimuovi elemento</button>
      <button data-action="undo" type="button" disabled>Annulla</button>
    </div>
    <p data-hint>Seleziona un attrezzo e tocca il campo per posizionarlo.</p>
    <div class="vut-board"><canvas width="1500" height="1000" aria-label="Lavagna del campo"></canvas></div>
    <p role="status" aria-live="polite"></p>
  </section>`;

  const find = selector => host.querySelector(selector);
  const action = name => find(`[data-action="${name}"]`);
  const field = name => find(`[name="${name}"]`);
  const list = find('[data-sessions]');
  const canvas = find('canvas');
  const status = find('[role=status]');
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
  const exercise = () => session.exercises[index];

  function markDirty(value = true) {
    dirty = value;
    if (host.isConnected) onDirty(value);
  }

  function updateArchive() {
    list.replaceChildren(new Option('Nuova seduta', ''), ...sessions.map(row =>
      new Option(`${row.training_date.split('-').reverse().join('/')} · ${row.title}`, row.id)));
    list.value = sessions.some(row => row.id === session.id) ? session.id : '';
    action('delete').disabled = busy || !list.value;
    list.disabled = busy;
  }

  async function readSessions() {
    const {data, error} = await client.from(table).select('id,title,training_date').order('training_date', {ascending:false}).order('updated_at', {ascending:false});
    if (error) throw error;
    sessions = data;
    updateArchive();
  }

  function changeSession(value) {
    session = value;
    markDirty(false);
    for (const key of ['title', 'training_date', 'category']) field(key).value = session[key];
    openExercise(0);
    updateArchive();
  }

  function openExercise(next) {
    index = next;
    selected = -1;
    routeStart = null;
    drag = null;
    undo = [];
    field('exercise-title').value = exercise().title;
    field('minutes').value = exercise().minutes;
    field('notes').value = exercise().notes;
    updateExercises();
    paint();
  }

  function updateExercises() {
    find('[data-exercises]').innerHTML = session.exercises.map((entry, position) =>
      `<button type="button" data-exercise="${position}" aria-pressed="${index === position}">${escapeHtml(entry.title || `Esercizio ${position + 1}`)} · ${Number(entry.minutes) || 0} min</button>`
    ).join('') + `<button type="button" data-action="add-exercise" ${session.exercises.length >= 30 ? 'disabled' : ''}>+ Esercizio</button>
      <button type="button" data-action="remove-exercise" ${session.exercises.length === 1 ? 'disabled' : ''}>Elimina esercizio</button>`;
  }

  function snapshot() {
    undo.push(structuredClone(exercise().objects));
    if (undo.length > 30) undo.shift();
  }

  function paint() {
    const objects = exercise().objects;
    drawField(canvas, objects, view3d, angle, selected, routeStart);
    action('remove-object').disabled = selected < 0 || view3d;
    action('rotate-object').disabled = view3d || !['hurdle','goal','ladder'].includes(objects[selected]?.type);
    action('undo').disabled = !undo.length || view3d;
    find('[data-hint]').textContent = view3d ? 'Ruota la visuale per osservare il campo da più lati.'
      : routeStart ? 'Tocca la destinazione del percorso.'
      : tool === 'select' ? 'Trascina gli elementi sul campo oppure scegli un attrezzo.'
      : 'Tocca il campo per posizionare: ' + equipment[tool] + '.';
  }

  function pointerLocation(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    return [Math.max(0, Math.min(100, (x - .06) / .88 * 100)), Math.max(0, Math.min(64, (y - .09) / .82 * 64))];
  }

  canvas.onpointerdown = event => {
    if (view3d || busy || !event.isPrimary || event.button !== 0) return;
    const [x, y] = pointerLocation(event);
    const objects = exercise().objects;
    if (tool === 'select') {
      selected = objects.findLastIndex(entry => Math.hypot(entry.x-x, entry.y-y) < 4
        || (entry.end && Math.hypot(entry.end[0]-x, entry.end[1]-y) < 4));
      if (selected >= 0) {
        const entry = objects[selected];
        drag = {id:event.pointerId, x, y, original:structuredClone(entry), moved:false};
        canvas.setPointerCapture(event.pointerId);
      }
    } else if (objects.length < 90) {
      if (['run','pass'].includes(tool)) {
        if (routeStart) {
          if (Math.hypot(x-routeStart[0], y-routeStart[1]) < 1) return;
          snapshot();
          selected = objects.push({type:tool, x:routeStart[0], y:routeStart[1], end:[x,y]}) - 1;
          routeStart = null;
          markDirty();
        } else {
          routeStart = [x,y];
        }
      } else {
        snapshot();
        selected = objects.push({type:tool, x, y, height:Number(field('height').value), rotation:0}) - 1;
        markDirty();
      }
    } else {
      status.textContent = 'Massimo 90 elementi per esercizio.';
    }
    paint();
  };

  canvas.onpointermove = event => {
    if (drag?.id !== event.pointerId) return;
    const [x,y] = pointerLocation(event);
    if (!drag.moved && Math.hypot(x-drag.x,y-drag.y) < .25) return;
    if (!drag.moved) snapshot();
    drag.moved = true;
    const {original} = drag;
    const points = original.end ? [[original.x,original.y],original.end] : [[original.x,original.y]];
    const dx = Math.max(-Math.min(...points.map(p => p[0])), Math.min(100-Math.max(...points.map(p => p[0])), x-drag.x));
    const dy = Math.max(-Math.min(...points.map(p => p[1])), Math.min(64-Math.max(...points.map(p => p[1])), y-drag.y));
    const moved = {...original, x:original.x+dx, y:original.y+dy};
    if (original.end) moved.end = [original.end[0]+dx,original.end[1]+dy];
    exercise().objects[selected] = moved;
    markDirty();
    paint();
  };
  canvas.onpointerup = canvas.onlostpointercapture = canvas.onpointercancel = event => {
    if (drag?.id === event.pointerId) drag = null;
  };

  function setBusy(value) {
    busy = value;
    for (const control of host.querySelectorAll('button,input,select,textarea')) control.disabled = value;
    if (!value) {
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

  host.onclick = event => {
    const button = event.target.closest('button');
    if (!button || busy) return;
    if (button.dataset.exercise != null) return openExercise(Number(button.dataset.exercise));
    if (button.dataset.tool) {
      tool = button.dataset.tool;
      routeStart = null;
      find('[data-tools]').querySelectorAll('[data-tool]').forEach(item =>
        item.setAttribute('aria-pressed', String(item.dataset.tool === tool)));
      return paint();
    }
    switch (button.dataset.action) {
      case 'new':
        if (!dirty || confirm('Abbandonare le modifiche non salvate?')) {
          changeSession(newSession());
          status.textContent = '';
        }
        break;
      case 'save':
        if (!session.title.trim() || !session.training_date) {
          status.textContent = 'Inserisci titolo e data della seduta.';
          return;
        }
        if (session.exercises.some(entry => !Number.isInteger(entry.minutes) || entry.minutes < 1 || entry.minutes > 180)) {
          status.textContent = 'Imposta una durata da 1 a 180 minuti per ogni esercizio.';
          return;
        }
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
        find('[data-tools]').hidden = view3d;
        find('[data-tools]').style.display = view3d ? 'none' : '';
        routeStart = null;
        paint();
        break;
      case 'rotate-left':
      case 'rotate-right':
        angle += button.dataset.action === 'rotate-left' ? -.25 : .25;
        paint();
        break;
      case 'rotate-object':
        if (selected < 0) return;
        snapshot();
        exercise().objects[selected].rotation = ((exercise().objects[selected].rotation || 0) + 45) % 360;
        markDirty();
        paint();
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
  await perform('Caricamento archivio…', async () => {
    await readSessions();
    status.textContent = '';
  });
}

function drawField(canvas, objects, perspective, angle, selected, routeStart) {
  const ctx = canvas.getContext('2d');
  const {width:w,height:h} = canvas;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  function project(x,y,z = 0) {
    if (!perspective) return [w*(.06 + .88*x/100),h*(.09 + .82*y/64)];
    const dx = x-50;
    const dy = y-32;
    const right = dx*cos-dy*sin;
    const depth = dx*sin+dy*cos;
    const scale = 1 / (1 - depth*.004);
    return [w/2+right*10*scale, h*.53+(depth*7-z*11)*scale];
  }

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

  ctx.fillStyle = '#111919';
  ctx.fillRect(0,0,w,h);
  path(rect(-2,-2,104,68),'#173e2a');
  for (let i=0;i<10;i++) path(rect(i*10,0,10,64),i%2 ? '#297247' : '#246941');
  const white = '#d6e7d8';
  path(rect(0,0,100,64),null,white);
  path([[50,0],[50,64]],null,white);
  path(ring(50,32,8),null,white);
  path(ring(50,32,.45),white);
  for (const [x,smallX] of [[0,0],[84,94]]) {
    path(rect(x,13,16,38),null,white);
    path(rect(smallX,23,6,18),null,white);
  }

  objects.forEach(({type,x,y,end},index) => {
    if (!end) return;
    const dx = end[0]-x;
    const dy = end[1]-y;
    const heading = Math.atan2(dy,dx);
    const color = index === selected ? '#fff' : type === 'run' ? '#ffdb6b' : '#6be1ff';
    path([[x,y],end],null,color,6,type === 'pass' ? [14,11] : []);
    path([end,[end[0]-2.9*Math.cos(heading-.46),end[1]-2.9*Math.sin(heading-.46)],
      [end[0]-2.9*Math.cos(heading+.46),end[1]-2.9*Math.sin(heading+.46)]],color);
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
  if (routeStart) path(ring(...routeStart,1),'#fff');
}
