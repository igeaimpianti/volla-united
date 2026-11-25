const table = 'vu_training_sessions';
const equipment = {
  player: 'Giocatore', opponent: 'Avversario', ball: 'Pallone',
  disc: 'Cinesino', cone: 'Cono', hurdle: 'Ostacolo', ladder: 'Scaletta',
  goal: 'Porticina', pole: 'Paletto', run: 'Corsa', pass: 'Passaggio', dribble: 'Guida palla', shot: 'Tiro', zone: 'Area'
};
const discColors = {
  pink:['Rosa','#ff50a2'], red:['Rosso','#ff394f'], blue:['Blu','#449aff'],
  yellow:['Giallo','#ffe04d'], orange:['Arancione','#ff9c3c'],
  green:['Verde','#90f35a'], white:['Bianco','#f8f8fb']
};
const zoneColors = {blue:discColors.blue,red:discColors.red};
const zoneShapes = {free:'Quattro cinesini',square:'Quadrato',rectangle:'Rettangolo',diamond:'Rombo'};
const isDisc = object => object?.type === 'disc';
const isZone = object => object?.type === 'zone';
const isGoalMarker = object => ['goal','cone','disc','pole'].includes(object?.type);
const progressionNames = ['Tiro iniziale','1 contro 1','2 contro 1','2 contro 2'];
const colorKey = (palette,key,fallback) => Object.hasOwn(palette,key) ? key : fallback;
const colorOptions = palette => Object.entries(palette).map(([key,[label]]) =>
  `<option value="${key}">${label}</option>`).join('');

const bibs = {
  red:['Rossa','#f14967'], blue:['Azzurra','#61c9ff'], yellow:['Gialla','#fce34c'],
  green:['Verde','#83ed62'], orange:['Arancione','#ff9b48'], purple:['Viola','#c294ff'],
  white:['Bianca','#f8f8fb'], none:['Senza casacca',null]
};
const isPlayer = object => object?.type === 'player' || object?.type === 'opponent';
const defaultBib = type => type === 'opponent' ? 'blue' : 'red';
const playerBib = object => Object.hasOwn(bibs,object?.bib ?? '') ? object.bib : defaultBib(object?.type);
const runSpeeds = new Map([[0.65,'Lenta'],[1,'Normale'],[1.5,'Veloce'],[2,'Scatto']]);
const pressureSpeeds = new Map([[0.65,'Lenta'],[1,'Normale'],[1.5,'Veloce']]);
const isPressing = object => isPlayer(object) && pressureSpeeds.has(object.pressureSpeed);
const passSpeeds = new Map([[0.65,'Lento'],[1,'Normale'],[1.5,'Veloce'],[2,'Molto veloce']]);
const arrowSpeed = (arrow,speeds) => speeds.has(arrow?.speed) ? arrow.speed : 1;
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
  zone:'M12 3 22 12 12 21 2 12z', disc:'M3 17h18l-4-7H7zM10 10h4', cone:'M3 20h18M7 20l4-16h2l4 16M9 12h6',
  hurdle:'M4 20V7h16v13M2 20h5m10 0h5', ladder:'M7 3v18M17 3v18M7 5h10M7 10h10M7 15h10M7 20h10',
  goal:'M3 19V6h18v13M3 9h18M7 9v10m5-10v10m5-10v10M3 14h18',
  pole:'M12 3v17M6 21h12', run:'M3 18 17 6m-7 0h7v7', pass:'M4 18l2-2m3-3 2-2m3-3 3-3m-7 0h7v7',
  pressing:'M12 2v4m0 12v4M2 12h4m12 0h4M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z',
  dribble:'M3 19c10 0 1-14 13-14m-4-3h5v5M19 18a3 3 0 1 0 0 .1', shot:'M3 18 19 4m-7 0h7v7M3 10l4-3M9 21l4-3',
  left:'M4 5v6h6M4 11a8 8 0 1 1 3 7', right:'M20 5v6h-6m6 0a8 8 0 1 0-3 7',
  minus:'M5 12h14', fit:'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5',
  cube:'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 2',
  video:'M3 6h13v12H3zM16 10l5-3v10l-5-3z',
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
.vut [data-video-download] {color:#b4f5c7;padding:8px}
.vut [data-action=preview] {color:#b4f5c7}
.vut canvas[data-mode=select] {cursor:grab}
.vut canvas[data-mode=pan] {cursor:move}
.vut-hint {padding:0 10px 9px;margin:0;color:var(--muted);font-size:12px;line-height:1.35}
.vut-palette {display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;padding:9px 10px;border-top:1px solid var(--line)}
.vut-palette button {display:grid;justify-items:center;gap:3px;padding:6px 1px;font-size:clamp(9px,2.4vw,11px);min-height:49px;letter-spacing:-.02em}
.vut-palette svg {color:#b4b9c9}
.vut-palette [data-tool=player] svg,.vut-palette [data-tool=disc] svg {color:#ff6b91}
.vut-palette [data-tool=pressing] svg {color:#ff91a6}
.vut-palette [data-tool=opponent] svg,.vut-palette [data-tool=pass] svg {color:#72d5ff}
.vut-palette [data-tool=hurdle] svg,.vut-palette [data-tool=ladder] svg,.vut-palette [data-tool=run] svg {color:#eeef74}
.vut-palette [data-tool=cone] svg,.vut-palette [data-tool=pole] svg {color:#ffb46b}
.vut-inspector {border-top:1px solid var(--line)}
.vut-inspector strong {font-size:13px}
.vut-inspector label {display:flex;align-items:center;gap:5px}
.vut-inspector select {width:auto}
.vut-inspector input[type=number] {width:78px}
.vut-inspector input[type=checkbox] {width:auto}
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
        <div class="vut-controls" role="group" aria-label="Esporta animazione">
          <button type="button" data-action="video-arrows">${icon('video')} Esporta con frecce</button>
          <button type="button" data-action="video-clean">${icon('video')} Esporta senza frecce</button>
        </div>
        <a data-video-download hidden>Scarica video</a>
        <small data-preview-mode></small>
        <small data-video-status role="status" aria-live="polite"></small>
      </div>
      <div class="vut-palette" aria-label="Attrezzi e percorsi">
        <button data-tool="select" type="button" aria-pressed="true">${icon('select')} Seleziona</button>
        ${Object.entries(equipment).map(([type,label]) => `<button type="button" data-tool="${type}" aria-pressed="false">${icon(type)} ${type === 'zone' ? 'Delimita area' : label}</button>`).join('')}
        <button type="button" data-tool="pressing" aria-pressed="false">${icon('pressing')} Pressing</button>
      </div>
      <div class="vut-inspector">
        <strong data-selection>Attrezzo</strong>
        <label data-show-zones hidden><input type="checkbox" name="show-zones" checked> Mostra aree</label>
        <label data-align-discs hidden><input type="checkbox" name="align-discs" checked> Allinea cinesini</label>
        <label data-disc-color hidden>Colore cinesino <select name="disc-color">${colorOptions(discColors)}</select></label>
        <label data-zone-shape hidden>Forma area <select name="zone-shape">
          ${Object.entries(zoneShapes).map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}
        </select></label>
        <label data-zone-color hidden>Colore area <select name="zone-color">${colorOptions(zoneColors)}</select></label>
        <label data-bib hidden>Casacca <select name="bib">
          ${Object.entries(bibs).map(([value,[name]]) => `<option value="${value}">${name}</option>`).join('')}
        </select></label>
        <label data-player-number hidden>Numero calciatore <input name="player-number" type="number" min="1" max="99" inputmode="numeric"></label>
        <label data-actor hidden>Calciatore dell’azione <select name="actor"></select></label>
        <div class="vut-controls" data-sequence hidden>
          <button type="button" data-action="action-earlier">Sposta prima</button>
          <button type="button" data-action="action-later">Sposta dopo</button>
        </div>
        <label data-run-start hidden>Partenza corsa <select name="run-start"></select></label>
        <label data-run-speed hidden>Velocità corsa <select name="run-speed">
          ${Array.from(runSpeeds,([speed,label]) => `<option value="${speed}">${label}</option>`).join('')}
        </select></label>
        <label data-pass-speed hidden><span data-ball-speed-label>Velocità passaggio</span> <select name="pass-speed">
          ${Array.from(passSpeeds,([speed,label]) => `<option value="${speed}">${label}</option>`).join('')}
        </select></label>
        <label data-pressure-speed hidden>Velocità pressing <select name="pressure-speed">
          <option value="0">Disattivata</option>
          ${Array.from(pressureSpeeds,([speed,label]) => `<option value="${speed}">${label}</option>`).join('')}
        </select></label>
        <label data-pressure-target hidden>Bersaglio del pressing <select name="pressure-target"></select></label>
        <label data-pressure-after hidden>Inizia il pressing <select name="pressure-after"></select></label>
        <label data-pressure-start hidden>Reazione al passaggio <select name="pressure-start">
          <option value="departure">Alla partenza del passaggio</option>
          <option value="arrival">Alla ricezione</option>
        </select></label>
        <button type="button" data-action="test-pressing" hidden>Prova pressing</button>
        <small data-pressing-status role="status" hidden></small>
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
  const videoStatus = find('[data-video-status]');
  const videoDownload = find('[data-video-download]');
  let session = newSession();
  let sessions = [];
  let index = 0;
  let dirty = false;
  let busy = false;
  let tool = 'select';
  let selected = -1;
  let discColor = 'pink';
  let zoneColor = 'blue';
  const zoneShape = field('zone-shape');
  const zoneCorners = [];
  let alignment = null;
  const showZones = field('show-zones');
  const alignDiscs = field('align-discs');
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
  const bibPreferences = {player:'red',opponent:'blue'};
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
    clearVideo();
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
    const {objects,progression} = exercise();
    undo.push(structuredClone({objects,progression}));
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
    const boardObjects = playback?.plan.phases ? objects.filter(object => !object.end) : objects;
    drawField(canvas,boardObjects,view3d,angle,selected,routeStart,viewport,screenUnits(1),grip,playback?.hiddenObjects,zoneCorners,showZones.checked,alignment);
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
    const progression = exercise().progression;
    if (progression?.active && progressionLayout(objects,progression)) {
      find('[data-preview-controls]').hidden = false;
      find('[data-preview-mode]').textContent = 'Tiro · 1 contro 1 · 2 contro 1 · 2 contro 2';
      return;
    }
    const hasPass = objects.some(isPass);
    const hasRun = objects.some(isRun);
    const hasCircuit = objects.filter(isCircuitEquipment).length >= 2;
    const hasPressing = objects.some(player => isPressing(player) &&
      (pressingTarget(player,objects) || hasPass || objects.some(object => object.type === 'ball')));
    find('[data-preview-controls]').hidden = !(hasPass || hasRun || hasCircuit || hasPressing);
    find('[data-preview-mode]').textContent = [
      hasPass && 'Azioni con palla in ordine numerico',
      hasPressing && 'Pressing',
      hasRun ? 'Corse lungo le frecce' : hasCircuit && 'Percorso tra gli attrezzi'
    ].filter(Boolean).join(' · ');
  }

  function stopPreview() {
    if (!playback) return;
    cancelAnimationFrame(playback.frame);
    playback = null;
    previewCanvas.hidden = true;
    action('preview').innerHTML = icon('play') + ' Anteprima esercizio';
    queueBoard();
  }

  function startPreview(plan = exercisePlan()) {
    if (!plan.duration) return;
    const context = previewCanvas.getContext('2d');
    playback = {frame:null,hiddenObjects:plan.hiddenObjects,plan};
    context.clearRect(0,0,previewCanvas.width,previewCanvas.height);
    previewCanvas.hidden = false;
    action('preview').innerHTML = icon('stop') + ' Ferma anteprima';
    queueBoard();

    let start;
    function tick(time) {
      if (!playback || !canvas.isConnected) return stopPreview();
      start ??= time;
      const elapsed = time-start;
      if (elapsed >= plan.duration+650) return stopPreview();
      context.clearRect(0,0,previewCanvas.width,previewCanvas.height);
      renderPreview(context,plan,elapsed,viewport);
      playback.frame = requestAnimationFrame(tick);
    }
    playback.frame = requestAnimationFrame(tick);
  }

  function renderPreview(context,plan,elapsed,{zoom,x:offsetX,y:offsetY},projection = context.canvas,showArrows = true) {
    const unit = projection.width/1500*zoom;
    const at = (x,y,z) => {
      const [px,py] = projectPoint(projection,view3d,angle,x,y,z);
      return [px*zoom+offsetX,py*zoom+offsetY];
    };
    if (plan.phases && showArrows) drawProgressionArrows(context,plan,elapsed,at,unit);
    for (const {player,bib,steps} of plan.runners) {
      if (player && (!steps.length || elapsed < steps[0].start)) {
        const rotation = (player.rotation || 0)*Math.PI/180;
        const [x,y] = at(player.x,player.y);
        const [tx,ty] = at(player.x+Math.cos(rotation),player.y+Math.sin(rotation));
        drawFootballer(context,x,y,unit*1.25,view3d,Math.atan2(ty-y,tx-x),bib,0,player.number);
        continue;
      }
      const {step,progress} = runnerPosition(steps,elapsed);
      const {x,y,segment,distance} = pointAlongRoute(step.route,progress);
      const rise = step.route.jumps.reduce((jump,d) => {
        const phase = Math.abs(d-distance)/2.8;
        return Math.max(jump,phase < 1 ? Math.cos(phase*Math.PI/2) : 0);
      },0);
      const [groundX,groundY] = at(x,y);
      const [px,py] = at(x,y,view3d ? rise*6 : 0);
      context.beginPath();
      context.ellipse(groundX,groundY+2*unit,9*unit,3*unit,0,0,Math.PI*2);
      context.fillStyle = '#102218a0';
      context.fill();
      const [aheadX,aheadY] = at(...segment.b);
      const [backX,backY] = at(...segment.a);
      const direction = Math.atan2(aheadY-backY,aheadX-backX);
      const stride = progress > 0 && progress < 1 ? Math.sin(distance*2) : 0;
      drawFootballer(context,px,view3d ? py : py-rise*12*unit,unit*1.25,view3d,direction,bib,stride,player?.number);
    }

    if (plan.passes.length) {
      const {step,progress} = trackPosition(plan.passes,elapsed);
      const {x,y,segment} = pointAlongRoute(step.route,progress);
      const [px,py] = at(x,y);
      if (step.kind === 'conduzione') {
        const [ax,ay] = at(...segment.a);
        const [bx,by] = at(...segment.b);
        const length = Math.hypot(bx-ax,by-ay) || 1;
        const lead = Math.min(1,progress*9,(1-progress)*9)*12*unit;
        drawBall(context,px+(bx-ax)/length*lead,py+(by-ay)/length*lead,unit);
      } else drawBall(context,px,py,unit);
    }
    if (plan.phases) {
      const phase = plan.phases.findLast(phase => elapsed >= phase.start);
      const size = Math.round(Math.min(context.canvas.width,context.canvas.height)*.045);
      context.font = `bold ${size}px system-ui, sans-serif`;
      context.textAlign = 'center';
      context.lineWidth = 5;
      context.strokeStyle = '#102218';
      context.strokeText(phase.label,context.canvas.width/2,size*1.4);
      context.fillStyle = '#fff';
      context.fillText(phase.label,context.canvas.width/2,size*1.4);
    }
  }

  function exercisePlan() {
    const {objects,progression} = exercise();
    const layout = progression?.active && progressionLayout(objects,progression);
    return layout ? buildProgression(objects,layout,progression) : previewPlan(objects);
  }

  function clearVideo() {
    if (!videoDownload.hidden) URL.revokeObjectURL(videoDownload.href);
    videoDownload.hidden = true;
    videoDownload.removeAttribute('href');
    videoStatus.textContent = '';
  }

  async function exportAnimation(showArrows) {
    const objects = exercise().objects;
    const plan = exercisePlan();
    clearVideo();
    if (!plan.duration) {
      videoStatus.textContent = 'Aggiungi un percorso o un passaggio per esportare il video.';
      return;
    }

    const board = document.createElement('canvas');
    if (!board.captureStream || !window.MediaRecorder) {
      videoStatus.textContent = 'Esportazione video non disponibile in questo browser.';
      return;
    }
    setBusy(true);
    videoStatus.textContent = 'Preparazione video…';
    const projection = {width:1200,height:800};
    const framingObjects = plan.phases ? objects.filter(object => !object.end) : objects;
    const frame = videoFrame(projection,framingObjects,plan,view3d,angle);
    board.width = frame.width;
    board.height = frame.height;
    const camera = {zoom:1,x:-frame.x,y:-frame.y};
    const recording = document.createElement('canvas');
    recording.width = frame.width;
    recording.height = frame.height;
    const context = recording.getContext('2d');
    const title = exercise().title.trim() || session.title.trim() || 'Esercizio';
    let stream;
    try {
      const boardObjects = showArrows && !plan.phases ? objects : objects.filter(object => !object.end);
      drawField(board,boardObjects,view3d,angle,-1,null,camera,1,null,plan.hiddenObjects,[],true,null,frame,projection);
      const draw = elapsed => {
        context.drawImage(board,0,0);
        renderPreview(context,plan,elapsed,camera,projection,showArrows);
      };
      draw(0);
      stream = recording.captureStream(30);
      const mimeType = ['video/mp4','video/webm;codecs=vp8','video/webm']
        .find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream,mimeType ? {mimeType} : undefined);
      const duration = plan.duration + 450;
      const video = await recordTrainingVideo(recorder,duration,time => {
        if (!host.isConnected) return false;
        draw(time);
        return true;
      });
      if (!host.isConnected) return;
      const extension = video.type.startsWith('video/mp4') ? 'mp4' : 'webm';
      const filename = title.replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,80) || 'Esercizio';
      videoDownload.href = URL.createObjectURL(video);
      videoDownload.download = `${filename}-${showArrows ? "con-frecce" : "senza-frecce"}.${extension}`;
      videoDownload.hidden = false;
      videoStatus.textContent = 'Video pronto.';
    } catch (error) {
      console.error(error);
      videoStatus.textContent = 'Esportazione video non riuscita. Riprova.';
    } finally {
      stream?.getTracks().forEach(track => track.stop());
      if (host.isConnected) setBusy(false);
    }
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
    find('[data-show-zones]').hidden = !objects.some(isZone);
    find('[data-align-discs]').hidden = !isDisc(entry) && tool !== 'disc';
    find('[data-disc-color]').hidden = !isDisc(entry) && tool !== 'disc';
    field('disc-color').value = isDisc(entry) ? colorKey(discColors,entry.color,'pink') : discColor;
    find('[data-zone-shape]').hidden = tool !== 'zone';
    find('[data-zone-color]').hidden = !isZone(entry) && tool !== 'zone';
    field('zone-color').value = isZone(entry) ? colorKey(zoneColors,entry.color,'blue') : zoneColor;
    const bibTarget = isPlayer(entry) ? entry : null;
    const bibTool = isPlayer({type:tool}) ? tool : null;
    find('[data-bib]').hidden = !bibTarget && !bibTool;
    field('bib').value = bibTarget ? playerBib(bibTarget) : bibPreferences[bibTool] ?? 'red';
    find('[data-player-number]').hidden = !isPlayer(entry);
    field('player-number').value = entry?.number ?? '';
    const actionIndexes = objects.flatMap((object,i) => object.end ? [i] : []);
    const sequenceIndex = actionIndexes.indexOf(selected);
    find('[data-sequence]').hidden = sequenceIndex < 0;
    action('action-earlier').disabled = busy || sequenceIndex <= 0;
    action('action-later').disabled = busy || sequenceIndex < 0 || sequenceIndex === actionIndexes.length-1;
    find('[data-actor]').hidden = !entry?.end;
    if (entry?.end) showPlayerOptions('actor','Automatico',entry.actorId);
    find('[data-pressure-speed]').hidden = !isPlayer(entry);
    find('[data-pressure-target]').hidden = !isPressing(entry);
    action('test-pressing').hidden = !isPressing(entry);
    find('[data-pressure-after]').hidden = !isPressing(entry);
    if (isPressing(entry)) {
      const choices = [];
      let ballNumber = 0;
      let runNumber = 0;
      objects.forEach((object,index) => {
        if (isPass(object)) choices.push(new Option(`Dopo ${equipment[object.type]} ${++ballNumber}`,String(index)));
        else if (isRun(object)) choices.push(new Option(`Dopo corsa ${++runNumber}`,String(index)));
      });
      const after = field('pressure-after');
      after.replaceChildren(new Option('Subito',''),...choices);
      const trigger = pressingTrigger(entry,objects);
      after.value = trigger ? String(objects.indexOf(trigger)) : '';
    }
    const pressingStatus = find('[data-pressing-status]');
    pressingStatus.hidden = true;
    pressingStatus.textContent = '';
    if (isPressing(entry)) showPlayerOptions('pressure-target','Palla',entry.pressureTargetId,entry);
    field('pressure-speed').value = String(isPressing(entry) ? entry.pressureSpeed : 0);
    find('[data-pressure-start]').hidden = !isPressing(entry) || Boolean(pressingTarget(entry,objects)) || !objects.some(isPass);
    field('pressure-start').value = entry?.pressureStart === 'arrival' ? 'arrival' : 'departure';
    const runStart = field('run-start');
    find('[data-run-speed]').hidden = !isRun(entry);
    field('run-speed').value = String(arrowSpeed(entry,runSpeeds));
    find('[data-pass-speed]').hidden = !isPass(entry);
    find('[data-ball-speed-label]').textContent = entry?.type === 'dribble' ? 'Velocità guida palla' : entry?.type === 'shot' ? 'Velocità tiro' : 'Velocità passaggio';
    field('pass-speed').value = String(arrowSpeed(entry,passSpeeds));
    find('[data-run-start]').hidden = !isRun(entry);
    if (entry && isRun(entry)) {
      const ballActions = objects.filter(isPass);
      const passCount = ballActions.length;
      runStart.replaceChildren(new Option(entry.actorId ? 'In sequenza' : 'Subito', ''),new Option('Subito', '0'), ...Array.from({length:passCount},(_,index) =>
        new Option(`Dopo ${equipment[ballActions[index].type]} ${index+1}`, String(index+1))));
      runStart.value = entry.afterPass == null && entry.actorId ? '' : String(runStartPass(entry,passCount));
      runStart.disabled = busy || !passCount;
    }
    const height = field('height');
    find('[data-height]').hidden = entry?.type !== 'hurdle' && tool !== 'hurdle';
    if (entry?.type === 'hurdle') height.value = entry.height || 15;
    find('[data-rotation]').hidden = rotation === null;
    if (document.activeElement !== field('rotation')) field('rotation').value = rotation ?? '';
    find('[data-selection]').textContent = entry
      ? equipment[entry.type] + (entry.number ? ' ' + entry.number : '') + (sequenceIndex >= 0 ? ' · Sequenza ' + (sequenceIndex+1) : '')
      : 'Nessun elemento selezionato';
    find('[data-hint]').textContent = tool === 'pan' ? 'Trascina per spostare l’inquadratura.'
      : tool === 'pressing' ? 'Tocca il calciatore che deve fare pressing.'
      : tool === 'zone' ? (zoneShape.value === 'free'
        ? `Tocca quattro cinesini sul campo. ${zoneCorners.length}/4 selezionati.`
        : `Tocca due cinesini allineati in orizzontale o in verticale. ${zoneCorners.length}/2 selezionati.`)
      : tool === 'disc' && alignDiscs.checked ? 'Tocca per posizionare o trascina prima di rilasciare per vedere le guide.'
      : isZone(entry) ? 'Per modificare il perimetro, sposta i cinesini ai vertici.'
      : routeStart ? 'Tocca la destinazione della freccia.'
      : tool === 'select' && entry?.end ? 'Trascina i cerchi alle estremità per cambiare la lunghezza o il rombo centrale per curvare la freccia.'
      : tool === 'select' && rotation !== null ? 'Trascina l’elemento per spostarlo o la maniglia ↻ per ruotarlo.'
      : tool === 'select' ? 'Tocca per selezionare un elemento o trascinalo per spostarlo.'
      : tool === 'run' || isBallAction({type:tool}) ? 'Tocca il punto di partenza della freccia.'
      : 'Tocca più punti sul campo per aggiungere: ' + equipment[tool] + '.';
  }

  function setTool(next) {
    tool = next;
    zoneCorners.length = 0;
    alignment = null;
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

  function pickObject(point, accepts = object => !isZone(object)) {
    let best = screenUnits(21);
    let picked = -1;
    exercise().objects.forEach((entry,index) => {
      if (!accepts(entry)) return;
      const base = at(entry.x,entry.y);
      let distance = Math.hypot(point[0]-base[0],point[1]-base[1]);
      if (entry.end) {
        const points = routePoints(entry).map(p => at(...p));
        distance = Math.min(...points.slice(1).map((p,i) => segmentDistance(point,points[i],p)));
      }
      const z = {hurdle:(entry.height || 15)/10,goal:3,player:4.5,opponent:4.5,pole:6,cone:2.9}[entry.type];
      if (view3d && z) distance = segmentDistance(point,base,at(entry.x,entry.y,z));
      if (distance <= best) {
        best = distance;
        picked = index;
      }
    });
    return picked;
  }

  function placeZone(point) {
    const objects = exercise().objects;
    const index = pickObject(point,isDisc);
    if (index < 0) return;
    const existing = zoneCorners.indexOf(index);
    if (existing >= 0) {
      zoneCorners.splice(existing,1);
      return paint();
    }

    const corners = [...zoneCorners,index];
    const shape = zoneShape.value;
    if (corners.length < (shape === 'free' ? 4 : 2)) {
      zoneCorners.push(index);
      return paint();
    }
    const discs = corners.map(index => objects[index]);
    const points = discs.map(({x,y}) => [x,y]);
    let side = 1;
    if (shape !== 'free') {
      const [[ax,ay],[bx,by]] = points;
      if (Math.hypot(bx-ax,by-ay) < 0.5 || (ax !== bx && ay !== by)) {
        find('[data-hint]').textContent = 'Scegli un secondo cinesino sulla stessa riga o colonna.';
        return;
      }
      const fits = direction => presetZonePoints(points,shape,direction).every(([x,y]) =>
        x >= 0 && x <= 100 && y >= 0 && y <= 64);
      if (!fits(side)) side = -1;
      if (!fits(side)) {
        find('[data-hint]').textContent = 'La forma supera i bordi del campo. Scegli due cinesini più vicini o più centrati.';
        return;
      }
    } else if (!sortZonePoints(points).length) {
      find('[data-hint]').textContent = 'Scegli un altro cinesino per ottenere un’area con quattro vertici distinti.';
      return;
    }
    snapshot();
    showZones.checked = true;
    const discIds = discs.map(disc => disc.id ??= crypto.randomUUID());
    const zone = {type:'zone',discIds,color:zoneColor};
    if (shape !== 'free') Object.assign(zone,{shape,side});
    selected = objects.push(zone)-1;
    setTool('select');
    markDirty();
    paint();
  }

  function configurePressing(playerIndex) {
    const player = exercise().objects[playerIndex];
    if (!isPlayer(player)) return;
    const current = exercise();
    if (!isPressing(player) || current.progression?.active) {
      snapshot();
      if (!isPressing(player)) player.pressureSpeed = 1;
      if (current.progression?.active) current.progression.active = false;
      clearVideo();
      markDirty();
    }
    selected = playerIndex;
    setTool('select');
    paint();
    field('pressure-target').scrollIntoView({block:'nearest'});
  }

  function place(point) {
    if (tool === 'pressing') return configurePressing(pickObject(point,isPlayer));
    const [x,y] = pitchPoint(point);
    if (x < 0 || x > 100 || y < 0 || y > 64) return;
    const objects = exercise().objects;
    if (objects.length >= 90) {
      find('[data-hint]').textContent = 'Massimo 90 elementi per esercizio.';
      return;
    }
    if (tool === 'zone') return placeZone(point);
    const entry = {type:tool,x,y};
    if (isDisc(entry)) {
      [entry.x,entry.y] = alignDisc([x,y]).point;
      entry.color = discColor;
    }
    if (tool === 'run' || isBallAction({type:tool})) {
      if (!routeStart) {
        routeStart = [x,y];
        paint();
        return;
      }
      if (Math.hypot(x-routeStart[0],y-routeStart[1]) < 1) return;
      [entry.x,entry.y] = routeStart;
      entry.end = [x,y];
    } else if (tool === 'hurdle') {
      stopPreview();
    entry.height = Number(field('height').value);
    } else if (isPlayer(entry)) {
      entry.bib = bibPreferences[tool];
    }
    snapshot();
    const placed = objects.push(entry)-1;
    if (entry.end && exercise().progression?.active) exercise().progression.active = false;
    if (entry.end) {
      selected = placed;
      setTool('select');
    }
    markDirty();
    paint();
  }

  function alignDisc(point, omitted = -1) {
    return snapDisc(point,exercise().objects,omitted,at,alignDiscs.checked ? screenUnits(8) : 0);
  }

  function previewDisc(point) {
    const [x,y] = pitchPoint(point);
    alignment = x >= 0 && x <= 100 && y >= 0 && y <= 64
      ? {...alignDisc([x,y]),color:discColors[discColor][1]} : null;
    queueBoard();
  }

  function clearAlignment() {
    if (!alignment) return;
    alignment = null;
    queueBoard();
  }

  showZones.onchange = () => {
    if (!showZones.checked && isZone(exercise().objects[selected])) selected = -1;
    clearVideo();
    paint();
  };

  alignDiscs.onchange = () => {
    clearAlignment();
    paint();
  };

  function pinchState() {
    const [a,b] = pointers.values();
    return {center:[(a[0]+b[0])/2,(a[1]+b[1])/2], distance:Math.max(1,Math.hypot(a[0]-b[0],a[1]-b[1]))};
  }

  function resetPointers() {
    const activePointers = [...pointers.keys()];
    pointers.clear();
    clearAlignment();
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
      clearAlignment();
      gesture = {...state, zoom:viewport.zoom, anchor:viewPoint(state.center,viewport)};
      drag = null;
      return;
    }
    const [x,y] = pitchPoint(point);
    let handle = null;
    if (tool === 'select') {
      handle = pickHandle(exercise().objects[selected],point);
      if (!handle) {
        selected = pickObject(point);
        const objects = exercise().objects;
        if (selected < 0 && showZones.checked) selected = objects.findLastIndex(entry =>
          isZone(entry) && pointInZone(point,zonePoints(entry,objects).map(vertex => at(...vertex))));
      }
    }
    drag = {
      id:event.pointerId, point, x, y, moved:false, viewport, handle,
      original:tool === 'select' && selected >= 0 && !isZone(exercise().objects[selected]) ? structuredClone(exercise().objects[selected]) : null
    };
    if (tool === 'disc' && alignDiscs.checked) previewDisc(point);
    paint();
  };

  canvas.onpointermove = event => {
    if (busy) return;
    const point = screenPoint(event);
    if (!pointers.has(event.pointerId)) {
      if (!pointers.size && !playback && event.pointerType === 'mouse' && tool === 'disc' && alignDiscs.checked) previewDisc(point);
      return;
    }
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
    if (tool === 'disc' && alignDiscs.checked) {
      previewDisc(point);
    } else if (tool === 'pan') {
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
        if (isDisc(original) && alignDiscs.checked) {
          const entry = exercise().objects[selected];
          alignment = alignDisc([entry.x,entry.y],selected);
          [entry.x,entry.y] = alignment.point;
        }
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
    if (complete && !busy && active?.id === event.pointerId && (!active.moved || (tool === 'disc' && alignDiscs.checked)) && tool !== 'select' && tool !== 'pan') {
      place(screenPoint(event));
    } else if (!pointers.size) paint();
  }

  function finishPointer(event) { endPointer(event,true); }
  function cancelPointer(event) { endPointer(event,false); }
  canvas.onpointerup = finishPointer;
  canvas.onpointerleave = () => {
    if (!pointers.size) clearAlignment();
  };
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

  field('disc-color').onchange = () => {
    discColor = colorKey(discColors,field('disc-color').value,'pink');
    changeSelectedColor(isDisc,discColor);
  };

  zoneShape.onchange = () => {
    zoneCorners.length = 0;
    paint();
  };

  field('zone-color').onchange = () => {
    zoneColor = colorKey(zoneColors,field('zone-color').value,'blue');
    changeSelectedColor(isZone,zoneColor);
  };

  function changeSelectedColor(matches,color) {
    const entry = exercise().objects[selected];
    if (!matches(entry)) return;
    snapshot();
    entry.color = color;
    stopPreview();
    markDirty();
    paint();
  }

  field('bib').onchange = () => {
    const bib = field('bib').value;
    if (!Object.hasOwn(bibs,bib)) return;
    const entry = exercise().objects[selected];
    if (isPlayer(entry)) {
      snapshot();
      entry.bib = bib;
      markDirty();
    } else if (isPlayer({type:tool})) {
      bibPreferences[tool] = bib;
    }
    stopPreview();
    paint();
  };

  function showPlayerOptions(name,empty,value,excluded) {
    const choices = exercise().objects.flatMap((player,index) => {
      if (!isPlayer(player) || player === excluded) return [];
      const num = player.number ? `N. ${player.number}` : `Giocatore ${exercise().objects.slice(0,index+1).filter(isPlayer).length}`;
      return [new Option(`${num} · ${bibs[playerBib(player)][0]}`,String(index))];
    });
    const input = field(name);
    input.replaceChildren(new Option(empty,''),...choices);
    const index = value ? exercise().objects.findIndex(object => object.id === value) : -1;
    input.value = index < 0 ? '' : String(index);
  }

  field('player-number').onchange = () => {
    const player = exercise().objects[selected];
    if (!isPlayer(player)) return;
    const number = field('player-number').valueAsNumber;
    if (!Number.isNaN(number) && (!Number.isInteger(number) || number < 1 || number > 99)) return paint();
    stopPreview();
    snapshot();
    if (Number.isNaN(number)) delete player.number;
    else player.number = number;
    markDirty();
    paint();
  };

  for (const [name,key] of [['actor','actorId'],['pressure-target','pressureTargetId']]) {
    field(name).onchange = () => {
      const objects = exercise().objects;
      const entry = objects[selected];
      if (!entry) return;
      const index = field(name).value;
      stopPreview();
      snapshot();
      if (index === '') delete entry[key];
      else {
        const player = objects[Number(index)];
        entry[key] = player.id ??= crypto.randomUUID();
      }
      markDirty();
      paint();
    };
  }

  field('run-start').onchange = () => {
    const entry = exercise().objects[selected];
    if (!entry || !isRun(entry)) return;
    stopPreview();
    snapshot();
    const afterPass = Number(field('run-start').value);
    if (field('run-start').value !== '') entry.afterPass = afterPass;
    else delete entry.afterPass;
    markDirty();
    paint();
  };

  for (const [name,matches,speeds] of [
    ['run-speed',isRun,runSpeeds],
    ['pass-speed',isPass,passSpeeds]
  ]) {
    field(name).onchange = () => {
      const entry = exercise().objects[selected];
      if (!matches(entry)) return;
      const speed = Number(field(name).value);
      if (!speeds.has(speed) || speed === arrowSpeed(entry,speeds)) return;
      stopPreview();
      snapshot();
      if (speed === 1) delete entry.speed;
      else entry.speed = speed;
      markDirty();
      paint();
    };
  }

  field('pressure-after').onchange = () => {
    const objects = exercise().objects;
    const entry = objects[selected];
    if (!isPressing(entry)) return;
    const value = field('pressure-after').value;
    stopPreview();
    snapshot();
    if (value === '') delete entry.pressureAfterId;
    else {
      const trigger = objects[Number(value)];
      entry.pressureAfterId = trigger.id ??= crypto.randomUUID();
    }
    clearVideo();
    markDirty();
    paint();
  };

  for (const name of ['pressure-speed','pressure-start']) {
    field(name).onchange = () => {
      const entry = exercise().objects[selected];
      if (!isPlayer(entry)) return;
      stopPreview();
      snapshot();
      if (name === 'pressure-speed') {
        const speed = Number(field(name).value);
        if (pressureSpeeds.has(speed)) entry.pressureSpeed = speed;
        else delete entry.pressureSpeed;
      } else {
        entry.pressureStart = field(name).value;
      }
      markDirty();
      paint();
    };
  }

  field('height').onchange = () => {
    const entry = exercise().objects[selected];
    if (entry?.type !== 'hurdle') return;
    snapshot();
    stopPreview();
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
    if (!showZones.checked) {
      for (const entry of copy.exercises) entry.objects = entry.objects.filter(object => !isZone(object));
    }
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
      if (button.dataset.tool === 'pressing' && isPlayer(exercise().objects[selected])) {
        return configurePressing(selected);
      }
      const next = button.dataset.tool;
      setTool(tool === next && (next === 'zone' || next === 'pressing') ? 'select' : next);
      return paint();
    }
    if (button.closest('.vut-menu')) button.closest('details').open = false;
    if (['remove-object','rotate-object','object-left','undo'].includes(button.dataset.action)) stopPreview();
    switch (button.dataset.action) {
      case 'test-pressing': {
        stopPreview();
        const player = exercise().objects[selected];
        const plan = exercisePlan();
        if (plan.runners.some(runner => runner.player === player && runner.pressing)) {
          canvas.scrollIntoView({block:'center'});
          startPreview(plan);
        } else {
          const status = find('[data-pressing-status]');
          const objects = exercise().objects;
          const hasTarget = pressingTarget(player,objects) || objects.some(object => object.type === 'ball' || isPass(object));
          status.textContent = hasTarget
            ? 'Il calciatore è già a distanza di pressing. Allontanalo dal bersaglio per provare la corsa.'
            : 'Aggiungi un pallone sul campo oppure scegli un calciatore come bersaglio.';
          status.hidden = false;
        }
        break;
      }
      case 'action-earlier':
      case 'action-later': {
        const objects = exercise().objects;
        const entry = objects[selected];
        const direction = button.dataset.action === 'action-earlier' ? -1 : 1;
        const indexes = objects.flatMap((object,i) => object.end ? [i] : []);
        const other = indexes[indexes.indexOf(selected)+direction];
        if (!entry?.end || other == null) return;
        stopPreview();
        snapshot();
        const oldActions = objects.filter(isPass);
        [objects[selected],objects[other]] = [objects[other],objects[selected]];
        const ordered = objects.filter(isPass);
        for (const run of objects.filter(isRun)) {
          if (run.afterPass > 0 && oldActions[run.afterPass-1]) {
            run.afterPass = ordered.indexOf(oldActions[run.afterPass-1])+1;
          }
        }
        selected = other;
        markDirty();
        paint();
        break;
      }
      case 'video-arrows':
      case 'video-clean':
        if (!exporting) void exportAnimation(button.dataset.action === 'video-arrows');
        break;
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
        {
          const objects = exercise().objects;
          const [removed] = objects.splice(selected,1);
          if (isDisc(removed) && removed.id) {
            exercise().objects = objects.filter(entry => !isZone(entry) || !entry.discIds.includes(removed.id));
          }
        }
        selected = -1;
        markDirty();
        paint();
        break;
      case 'undo':
        if (!undo.length) return;
        Object.assign(exercise(),undo.pop());
        setTool('select');
        zoneCorners.length = 0;
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

function recordTrainingVideo(recorder,duration,draw) {
  return new Promise((resolve,reject) => {
    const chunks = [];
    let frame;
    let stopTimer;
    const fail = error => {
      cancelAnimationFrame(frame);
      clearTimeout(stopTimer);
      reject(error);
      if (recorder.state !== 'inactive') recorder.stop();
    };
    recorder.ondataavailable = event => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = event => fail(event.error);
    recorder.onstop = () => {
      cancelAnimationFrame(frame);
      clearTimeout(stopTimer);
      if (chunks.length) resolve(new Blob(chunks,{type:recorder.mimeType || chunks[0].type}));
      else reject(new Error('Empty video recording'));
    };
    const stop = () => {
      if (recorder.state !== 'inactive') recorder.stop();
    };
    const start = performance.now();
    const tick = time => {
      try {
        const elapsed = Math.max(0,time-start);
        if (elapsed >= duration || !draw(elapsed)) stop();
        else frame = requestAnimationFrame(tick);
      } catch (error) {
        fail(error);
      }
    };
    recorder.start();
    stopTimer = setTimeout(stop,duration);
    frame = requestAnimationFrame(tick);
  });
}

const isBallAction = object => ['pass','dribble','shot'].includes(object?.type);
const isPass = object => isBallAction(object) && Boolean(object.end);
const isRun = object => object?.type === 'run' && Boolean(object.end);

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

function previewRoute(equipment,run) {
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

  return routeFromPoints(points,equipment);
}

function routeFromPoints(points,equipment = []) {
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

function runStartPass(arrow,passCount) {
  const number = arrow?.afterPass;
  return Number.isInteger(number) && number > 0 ? Math.min(number,passCount) : 0;
}

function assignRunPlayers(runs,players) {
  const candidates = runs.flatMap((arrow,index) => {
    const fromEarlierRun = runs.slice(0,index).some(({end}) => Math.hypot(end[0]-arrow.x,end[1]-arrow.y) < 2);
    const radius = fromEarlierRun ? 2 : 12;
    return players.map(player => ({arrow,player,distance:Math.hypot(player.x-arrow.x,player.y-arrow.y)}))
      .filter(({distance}) => distance <= radius);
  }).sort((a,b) => a.distance-b.distance);

  const assignments = new Map();
  const assignedPlayers = new Set();
  for (const {arrow,player} of candidates) {
    if (assignments.has(arrow) || assignedPlayers.has(player)) continue;
    assignments.set(arrow,player);
    assignedPlayers.add(player);
  }
  return assignments;
}

function progressionLayout(objects,progression) {
  if (progression?.players?.length !== 4 || progression?.goals?.length !== 4) return null;
  const byId = new Map(objects.filter(object => object.id).map(object => [object.id,object]));
  const players = progression.players.map(id => byId.get(id));
  const goals = progression.goals.map(ids => ids.map(id => byId.get(id)));
  if (!players.every(isPlayer) || goals.some(posts => !posts.every(isGoalMarker))) return null;
  const lines = goals.map(([a,b]) => {
    if (b) return [[a.x,a.y],[b.x,b.y]];
    const angle = (a.rotation || 0)*Math.PI/180;
    return [-2.5,2.5].map(side => [
      a.x+side*Math.cos(angle)+1.3*Math.sin(angle),a.y+side*Math.sin(angle)-1.3*Math.cos(angle)
    ]);
  });
  return lines.every(([a,b]) => Math.hypot(b[0]-a[0],b[1]-a[1]) >= 1) ? {players,lines} : null;
}

function buildProgression(objects,{players,lines},{team,order}) {
  const membership = [0,1,team === 1 ? 0 : 1,team === 1 ? 1 : 0];
  const runners = players.map(player => ({player,bib:playerBib(player),steps:[]}));
  const positions = players.map(({x,y}) => [x,y]);
  const passes = [];
  const phases = [];
  const hiddenObjects = new Set([...players,...objects.filter(object => object.type === 'ball')]);
  const durationFor = (from,to,unitsPerSecond,minimum = 0) =>
    Math.max(minimum,Math.hypot(to[0]-from[0],to[1]-from[1])/unitsPerSecond*1000);
  const pointBetween = (a,b,fraction) => [
    a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction
  ];
  const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
  const add = (steps,from,to,start,duration,kind) => {
    let route = routeFromPoints([from,to]);
    if (!route && steps === passes) {
      route = {segments:[{a:from,b:from,start:0,length:1}],length:0,jumps:[]};
    }
    if (route) steps.push({route,start,end:start+duration,duration,kind,receipts:[]});
  };
  const move = (i,to,start,duration,kind) => {
    add(runners[i].steps,positions[i],to,start,duration,kind);
    positions[i] = to;
  };
  const carryBall = (i,to,start,duration) => {
    add(passes,positions[i],to,start,duration,'conduzione');
    move(i,to,start,duration,'conduzione');
  };
  const defend = (defenders,ball,support,goal,start,duration) => {
    if (!defenders.length) return;
    // The nearest defender pressures the ball. The other stays goal-side of the runner.
    const [first,second] = [...defenders].sort((a,b) => distance(positions[a],ball)-distance(positions[b],ball));
    const recover = (i,target) => {
      const from = positions[i];
      const remaining = distance(from,target);
      if (remaining < .2) return;
      move(i,pointBetween(from,target,Math.min(1,duration*.0075/remaining)),start,duration,'difesa');
    };
    const goalSide = (point,space) => pointBetween(point,goal,Math.min(1,space/(distance(point,goal) || 1)));
    recover(first,goalSide(ball,4));
    if (second !== undefined) recover(second,goalSide(support,3));
  };
  const opening = (from,to,defenders) => {
    const crowding = defenders.reduce((sum,i) =>
      sum+Math.max(0,8-segmentDistance(positions[i],from,to)),0);
    return crowding;
  };
  let start = 0;
  order.forEach((choices,i) => {
    const startWithBall = positions[i];
    const defenders = membership.slice(0,i).flatMap((group,j) => group !== membership[i] ? [j] : []);
    const goals = Array.isArray(choices) ? choices : [choices];
    const midpoint = ([a,b]) => [(a[0]+b[0])/2,(a[1]+b[1])/2];
    const cost = goal => {
      const center = midpoint(lines[goal]);
      const distance = Math.hypot(startWithBall[0]-center[0],startWithBall[1]-center[1]);
      const congestion = defenders.reduce((total,index) =>
        total+Math.max(0,10-segmentDistance(positions[index],startWithBall,center))*3,0);
      return distance+congestion;
    };
    const goalIndex = goals.reduce((best,choice) => cost(choice) < cost(best) ? choice : best);
    const [a,b] = lines[goalIndex];
    const center = midpoint(lines[goalIndex]);
    const lineLength = Math.hypot(b[0]-a[0],b[1]-a[1]);
    let nx = (b[1]-a[1])/lineLength;
    let ny = (a[0]-b[0])/lineLength;
    const teamMate = membership.slice(0,i).indexOf(membership[i]);
    if ((startWithBall[0]-center[0])*nx+(startWithBall[1]-center[1])*ny < 0) {
      nx = -nx; ny = -ny;
    }
    if (center[0]+nx*7 < 0 || center[0]+nx*7 > 100 || center[1]+ny*7 < 0 || center[1]+ny*7 > 64) {
      nx = -nx; ny = -ny;
    }
    const shoot = limitPoint([center[0]+nx*8,center[1]+ny*8]);
    const inGoal = [center[0]-nx*1.7,center[1]-ny*1.7];
    phases.push({start,label:`${progressionNames[i]} · Porta ${goalIndex+1}`});
    let at = start;
    let shooter = i;
    const inside = (depth,side) => limitPoint([
      center[0]+nx*depth-ny*side,center[1]+ny*depth+nx*side
    ]);
    const dribble = (target,support = target) => {
      const duration = durationFor(positions[shooter],target,8,460);
      carryBall(shooter,target,at,duration);
      defend(defenders,target,support,center,at,duration);
      at += duration;
    };
    const exchange = (receiver,carry,lanes) => {
      // Keep the first touch and the passing lane clear, then time the pass to meet the run.
      const score = lane => opening(carry,lane,defenders)*4+distance(positions[receiver],lane)*.18;
      const available = lanes.filter(lane => distance(carry,lane) >= 5);
      const receive = (available.length ? available : lanes)
        .reduce((best,lane) => score(lane) < score(best) ? lane : best);
      const runnerFrom = positions[receiver];
      const passTime = durationFor(carry,receive,22,420);
      const launch = Math.max(durationFor(positions[shooter],carry,8,600),
        durationFor(runnerFrom,receive,9,740)-passTime);
      carryBall(shooter,carry,at,launch);
      move(receiver,receive,at,launch+passTime,'smarcamento');
      defend(defenders,carry,pointBetween(runnerFrom,receive,launch/(launch+passTime)),center,at,launch);
      add(passes,carry,receive,at+launch,passTime,'passaggio');
      defend(defenders,receive,carry,center,at+launch,passTime);
      at += launch+passTime;
      shooter = receiver;
    };
    if (teamMate >= 0) {
      const left = inside(22,-9);
      const right = inside(22,9);
      const sign = opening(startWithBall,left,defenders) <= opening(startWithBall,right,defenders) ? -1 : 1;
      const carry = inside(22,9*sign);
      exchange(teamMate,carry,[inside(17,-10*sign),inside(23,-13*sign),inside(15,10*sign)]);
      // The player who passed now attacks the space and receives the return ball.
      const returnCarry = pointBetween(positions[shooter],inside(15,-8*sign),.36);
      exchange(i,returnCarry,[inside(10,8*sign),inside(12,13*sign),inside(9,-10*sign)]);
    } else if (defenders.length) {
      const left = inside(16,-11);
      const right = inside(16,11);
      const cost = lane => opening(startWithBall,lane,defenders)*4+distance(startWithBall,lane)*.3;
      dribble(cost(left) <= cost(right) ? left : right);
    }
    dribble(shoot,teamMate >= 0 ? positions[teamMate] : shoot);
    const shotTime = durationFor(shoot,inGoal,29,300);
    add(passes,shoot,inGoal,at,shotTime,'tiro');
    start = at+shotTime+570;
  });
  return {runners,passes,hiddenObjects,phases,duration:start};
}

function drawProgressionArrows(context,plan,elapsed,at,unit) {
  const styles = {smarcamento:'#ffdb6b',difesa:'#ff91a6',passaggio:'#6be1ff',tiro:'#fff'};
  const active = step => styles[step.kind] && step.start <= elapsed && elapsed <= step.end;
  const steps = [...plan.runners.flatMap(runner => runner.steps),...plan.passes];
  context.save();
  context.lineWidth = 4*unit;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  for (const step of steps.filter(active)) {
    const [x,y] = at(...step.route.segments[0].a);
    const [tx,ty] = at(...step.route.segments.at(-1).b);
    const angle = Math.atan2(ty-y,tx-x);
    const size = Math.min(13*unit,Math.hypot(tx-x,ty-y)*.5);
    context.strokeStyle = styles[step.kind];
    context.setLineDash(step.kind === 'passaggio' ? [10*unit,6*unit] : []);
    context.beginPath();
    context.moveTo(x,y);
    context.lineTo(tx,ty);
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.moveTo(tx-Math.cos(angle-.5)*size,ty-Math.sin(angle-.5)*size);
    context.lineTo(tx,ty);
    context.lineTo(tx-Math.cos(angle+.5)*size,ty-Math.sin(angle+.5)*size);
    context.stroke();
  }
  context.restore();
}

function previewPlan(objects) {
  const equipment = objects.filter(isCircuitEquipment);
  const runs = objects.filter(isRun);
  const available = objects.filter(object => isPlayer(object) && (!isPressing(object) || pressingTrigger(object,objects)));
  const hiddenObjects = new Set();
  const runners = [];
  const passes = [];
  const addStep = (steps,route,duration,start) => {
    steps.push({route,start,duration,end:start+duration});
  };

  const passArrows = objects.filter(isPass);
  const actors = new Map(available.filter(player => player.id).map(player => [player.id,player]));
  const assignments = assignRunPlayers(runs.filter(arrow => !actors.has(arrow.actorId)),available);

  for (const arrow of runs.length || passArrows.some(arrow => arrow.type === "dribble") ? runs : [null]) {
    const route = previewRoute(equipment,arrow);
    if (!route) continue;
    const [x,y] = route.segments[0].a;
    const player = arrow ? actors.get(arrow.actorId) ?? assignments.get(arrow) : available.reduce((nearest,candidate) => {
      const distance = Math.hypot(candidate.x-x,candidate.y-y);
      return !nearest || distance < Math.hypot(nearest.x-x,nearest.y-y) ? candidate : nearest;
    },null);
    let runner = player ? runners.find(runner => runner.player === player) : null;
    if (!player) {
      let closest = 2;
      for (const candidate of runners) {
        const [endX,endY] = candidate.steps.at(-1).route.segments.at(-1).b;
        const distance = Math.hypot(endX-x,endY-y);
        if (distance < closest) {
          closest = distance;
          runner = candidate;
        }
      }
    }
    if (!runner) {
      runner = {player,bib:!player && available.length ? 'none' : playerBib(player),steps:[]};
      runners.push(runner);
      if (player) hiddenObjects.add(player);
    }
    const afterPass = arrow?.afterPass == null && actors.has(arrow?.actorId)
      ? objects.slice(0,objects.indexOf(arrow)).filter(isPass).length
      : runStartPass(arrow,passArrows.length);
    const duration = clamp(route.length*115,arrow ? 500 : 2800,18000)/arrowSpeed(arrow,runSpeeds);
    runner.steps.push({route,duration,afterPass,arrow,receipts:[]});
  }

  const arrivalTimes = [];
  const scheduleRuns = () => {
    for (const runner of runners) {
      let end = 0;
      for (const step of runner.steps) {
        step.start = Math.max(end,arrivalTimes[step.afterPass-1] ?? 0);
        const last = step.receipts.at(-1);
        step.end = last ? last.time + step.duration*(1-last.progress) : step.start+step.duration;
        end = step.end;
      }
    }
  };

  scheduleRuns();
  passArrows.forEach((arrow,index) => {
    const points = routePoints(arrow);
    const previous = passes.at(-1);
    const actor = actors.get(arrow.actorId);
    const earlierRun = actor && runners.find(runner => runner.player === actor)?.steps.findLast(step =>
      step.afterPass <= index && objects.indexOf(step.arrow) < objects.indexOf(arrow));
    const start = Math.max(previous ? previous.end+220 : 0,earlierRun?.end ?? 0);
    const match = runs.length && arrow.type === 'pass' ? findReceipt(runners,arrow.end,index+1) : null;
    const snappedRoute = match && routeFromPoints([...points.slice(0,-1),match.point]);
    const receipt = snappedRoute ? match : null;
    const route = snappedRoute || routeFromPoints(points);
    if (!route) {
      arrivalTimes.push(previous?.end ?? 0);
      scheduleRuns();
      return;
    }

    const rate = arrow.type === 'dribble' ? 120 : arrow.type === 'shot' ? 26 : 38;
    const duration = clamp(route.length*rate,350,arrow.type === 'dribble' ? 18000 : 2800)/arrowSpeed(arrow,passSpeeds);
    let passStart = start;
    if (receipt) {
      const {step,progress} = receipt;
      const last = step.receipts.at(-1);
      const travelTime = step.duration*(progress-(last?.progress ?? 0));
      const earliest = (last?.time ?? step.start)+Math.max(travelTime,1);
      passStart = Math.max(start,earliest-duration);
      step.receipts.push({progress,time:passStart+duration});
    }
    addStep(passes,route,duration,passStart);
    Object.assign(passes.at(-1),{arrow,actor,kind:arrow.type === 'dribble' ? 'conduzione' : arrow.type === 'shot' ? 'tiro' : 'passaggio'});
    arrivalTimes.push(passStart+duration);
    scheduleRuns();
  });

  for (const step of passes.filter(step => step.kind === 'conduzione')) {
    const [x,y] = step.route.segments[0].a;
    const near = point => Math.hypot(point[0]-x,point[1]-y);
    const registered = runners.filter(runner => runner.steps.every(run =>
      run.end <= step.start || run.start >= step.end));
    const candidates = registered.flatMap(runner => {
      const previous = runner.steps.findLast(run => run.end <= step.start);
      const point = previous ? previous.route.segments.at(-1).b
        : runner.player && [runner.player.x,runner.player.y];
      return point ? [{runner,distance:near(point)}] : [];
    });
    for (const player of available.filter(player => !hiddenObjects.has(player))) {
      candidates.push({player,distance:near([player.x,player.y])});
    }
    const assigned = step.actor && (candidates.find(candidate =>
      (candidate.player ?? candidate.runner?.player) === step.actor));
    const best = step.actor ? assigned : candidates.filter(candidate => candidate.distance <= 7)
      .sort((a,b) => a.distance-b.distance)[0];
    if (assigned) {
      const origin = assigned.runner ? playerPosition(assigned.runner,step.start) : [step.actor.x,step.actor.y];
      const route = routeFromPoints([origin,...step.route.segments.map(segment => segment.b)]);
      if (route) step.route = route;
    }
    const runner = best?.runner ?? {player:best?.player,bib:best?.player ? playerBib(best.player) : 'none',steps:[]};
    if (!best?.runner) runners.push(runner);
    if (runner.player) hiddenObjects.add(runner.player);
    runner.steps.push({...step,receipts:[]});
    runner.steps.sort((a,b) => a.start-b.start);
  }

  for (const step of passes.filter(step => step.kind === 'tiro' && step.actor)) {
    const runner = runners.find(runner => runner.player === step.actor);
    const origin = runner ? playerPosition(runner,step.start) : [step.actor.x,step.actor.y];
    const points = step.route.segments.map(segment => segment.b);
    const route = routeFromPoints([origin,...points]);
    if (route) step.route = route;
  }

  if (passes.length) {
    const [x,y] = passes[0].route.segments[0].a;
    const ball = objects.filter(object => object.type === 'ball').reduce((best,object) => {
      const distance = Math.hypot(object.x-x,object.y-y);
      return distance < (best?.distance ?? 6) ? {object,distance} : best;
    },null);
    if (ball) hiddenObjects.add(ball.object);
  }
  const pressingRunners = runners.map(runner => ({...runner,steps:[...runner.steps]}));
  for (const opponent of objects.filter(isPressing)) {
    const trigger = pressingTrigger(opponent,objects);
    const triggerStep = trigger && [...passes,...pressingRunners.flatMap(runner => runner.steps)]
      .find(step => step.arrow === trigger);
    if (trigger && !triggerStep) continue;
    const start = triggerStep?.end ?? 0;
    const currentRunner = runners.find(runner => runner.player === opponent);
    const origin = currentRunner ? playerPosition(currentRunner,start) : [opponent.x,opponent.y];

    const target = pressingTarget(opponent,objects);
    const targetRunner = target && pressingRunners.find(runner => runner.player === target);
    const ball = !target && !passes.length ? nearestBall({...opponent,x:origin[0],y:origin[1]},objects) : null;
    const focus = target || ball;
    const reaction = opponent.pressureStart === 'arrival' ? 'end' : 'start';
    const chase = focus
      ? [{start,target:targetRunner ? playerPosition(targetRunner,start) : [focus.x,focus.y]},
          ...(targetRunner?.steps ?? []).filter(step => step.end > start).map(step => ({
            start:Math.max(start,step.start),target:step.route.segments.at(-1).b
          }))]
      : passes.filter(step => step[reaction] >= start).map(step => ({
          start:step[reaction],target:step.route.segments.at(-1).b
        }));
    if (triggerStep && !focus && passes.length && chase[0]?.start !== start) {
      const {step,progress} = trackPosition(passes,start);
      const {x,y} = pointAlongRoute(step.route,progress);
      chase.unshift({start,target:[x,y]});
    }
    const steps = pressureSteps(opponent,chase,origin);
    if (!steps.length) continue;
    if (currentRunner) {
      currentRunner.steps = [...stepsUntil(currentRunner.steps,start),...steps];
      currentRunner.pressing = true;
    } else {
      runners.push({player:opponent,bib:playerBib(opponent),steps,pressing:true});
    }
    hiddenObjects.add(opponent);
  }

  const duration = Math.max(0,passes.at(-1)?.end ?? 0,...runners.map(({steps}) => steps.at(-1).end));
  return {runners,passes,hiddenObjects,duration};
}

function pressingTrigger(player,objects) {
  return player.pressureAfterId && objects.find(object => object.id === player.pressureAfterId &&
    (isPass(object) || isRun(object)));
}

function stepsUntil(steps,time) {
  const completed = steps.filter(step => step.end <= time);
  const active = steps.find(step => step.start < time && time < step.end);
  if (!active) return completed;
  const {progress} = runnerPosition([active],time);
  const {x,y,segment} = pointAlongRoute(active.route,progress);
  const points = active.route.segments.slice(0,active.route.segments.indexOf(segment)).map(part => part.a);
  const route = routeFromPoints([...points,segment.a,[x,y]]);
  if (route) {
    const receipts = active.receipts.filter(receipt => receipt.time < time)
      .map(receipt => ({...receipt,progress:receipt.progress/progress}));
    completed.push({...active,route,end:time,duration:active.duration*progress,receipts});
  }
  return completed;
}

function pressingTarget(player,objects) {
  return objects.find(target => isPlayer(target) && target !== player && target.id &&
    target.id === player?.pressureTargetId);
}

function nearestBall(player,objects) {
  const distance = ball => Math.hypot(ball.x-player.x,ball.y-player.y);
  return objects.filter(object => object.type === 'ball').reduce((best,ball) =>
    !best || distance(ball) < distance(best) ? ball : best,null);
}

function playerPosition(runner,elapsed) {
  if (elapsed < runner.steps[0].start) return [runner.player.x,runner.player.y];
  const {step,progress} = runnerPosition(runner.steps,elapsed);
  const {x,y} = pointAlongRoute(step.route,progress);
  return [x,y];
}

function pressureSteps(opponent,chase,origin) {
  const steps = [];
  const millisecondsPerUnit = 115/opponent.pressureSpeed;
  const standOff = 3;
  let position = origin;
  chase.forEach(({start,target:[x,y]},index) => {
    const next = chase[index+1]?.start ?? Infinity;
    const dx = x-position[0];
    const dy = y-position[1];
    const distance = Math.hypot(dx,dy);
    const end = Math.min(start+(distance-standOff)*millisecondsPerUnit,next);
    const travel = (end-start)/millisecondsPerUnit;
    if (travel <= .01) return;
    const target = [position[0]+dx*travel/distance,position[1]+dy*travel/distance];
    const route = routeFromPoints([position,target]);
    if (!route) return;
    steps.push({route,start,duration:end-start,end,receipts:[]});
    position = target;
  });
  return steps;
}

function findReceipt(runners,[x,y],passNumber) {
  let best = null;
  let closest = 2;
  for (const {steps} of runners) {
    const first = steps.findLastIndex(step => step.receipts.length);
    for (const [index,step] of steps.entries()) {
      // A run triggered by this pass or a later one cannot receive it on the move.
      if (step.afterPass >= passNumber) break;
      if (index < first) continue;
      const minimum = step.receipts.at(-1)?.progress ?? 0;
      for (const {a,b,length,start} of step.route.segments) {
        const dx = b[0]-a[0];
        const dy = b[1]-a[1];
        const fraction = clamp(((x-a[0])*dx+(y-a[1])*dy)/length**2,0,1);
        const point = [a[0]+dx*fraction,a[1]+dy*fraction];
        const distance = Math.hypot(x-point[0],y-point[1]);
        const progress = (start+fraction*length)/step.route.length;
        if (distance < closest && progress >= minimum) {
          closest = distance;
          best = {step,point,progress};
        }
      }
    }
  }
  return best;
}

function runnerPosition(steps,elapsed) {
  const {step,progress} = trackPosition(steps,elapsed);
  if (!step.receipts.length || elapsed < step.start || elapsed >= step.end) {
    return {step,progress:elapsed >= step.end ? 1 : progress};
  }
  let before = {time:step.start,progress:0};
  for (const after of [...step.receipts,{time:step.end,progress:1}]) {
    if (elapsed <= after.time) {
      const fraction = after.time === before.time ? 1 : (elapsed-before.time)/(after.time-before.time);
      return {step,progress:before.progress+(after.progress-before.progress)*fraction};
    }
    before = after;
  }
  return {step,progress};
}

function trackPosition(steps,elapsed) {
  const next = steps.findIndex(step => elapsed <= step.end);
  const step = next < 0 ? steps.at(-1) : steps[next];
  if (next > 0 && elapsed < step.start) return {step:steps[next-1],progress:1};
  return {step,progress:step.end === step.start ? Number(elapsed >= step.end) : clamp((elapsed-step.start)/(step.end-step.start),0,1)};
}

function pointAlongRoute(route,progress) {
  const distance = route.length*progress;
  const segment = route.segments.find(part => distance <= part.start+part.length) || route.segments.at(-1);
  const fraction = clamp((distance-segment.start)/segment.length,0,1);
  const {a,b} = segment;
  return {
    x:a[0]+(b[0]-a[0])*fraction,
    y:a[1]+(b[1]-a[1])*fraction,
    distance,segment
  };
}

function drawBall(ctx,x,y,scale = 1) {
  ctx.beginPath();
  ctx.arc(x,y,11*scale,0,2*Math.PI);
  ctx.fillStyle = '#fafafa';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x,y,4*scale,0,2*Math.PI);
  ctx.fillStyle = '#252932';
  ctx.fill();
}

function drawFootballer(ctx,x,y,scale,perspective,direction,bib,stride = 0,number) {
  const [,color] = bibs[bib] || bibs.red;
  const kit = '#222937';
  const skin = '#d9a47d';
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(scale,scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  function shape(points,fill,border = '#142421') {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }

  function limb(points,color,width) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function head(x,y,radius,color) {
    ctx.beginPath();
    ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#182321';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }

  if (perspective) {
    const turn = Math.cos(direction);
    const swing = stride*4;
    for (const side of [-1,1]) {
      const knee = side*5+side*swing;
      const foot = side*6+side*swing+turn*2;
      limb([[side*4,-18],[knee,-9],[foot,-2]],skin,4.7);
      limb([[knee,-8],[foot,-2]],'#f0f1f6',3.4);
      limb([[foot-2,-1],[foot+turn*3+2,-1]],kit,4);
      limb([[side*7,-34],[side*10,-26],[side*9-side*swing,-22]],skin,4);
    }
    shape([[-7,-23],[7,-23],[6,-15],[1,-15],[0,-19],[-1,-15],[-6,-15]],kit);
    shape([[-12,-32],[-7,-37],[7,-37],[12,-32],[9,-27],[7,-30],[7,-22],[-7,-22],[-7,-30],[-9,-27]],kit);
    if (color) shape([[-6,-35],[-3,-36],[0,-33],[3,-36],[6,-35],[5,-30],[6,-23],[-6,-23],[-5,-30]],color);
    head(turn*1.1,-42,5.3,skin);
    limb([[turn*1.1-3.5,-45],[turn*1.1,-46.5],[turn*1.1+3.5,-45]],'#392d2a',2.3);
  } else {
    ctx.rotate(direction+Math.PI/2);
    shape([[-4,5],[4,5],[5+stride*3,13],[1+stride*3,13],[0,9],[-1-stride*3,13],[-5-stride*3,13]],kit);
    shape([[-10,-3],[-6,-8],[6,-8],[10,-3],[7,1],[5,-1],[5,7],[-5,7],[-5,-1],[-7,1]],kit);
    if (color) shape([[-4,-7],[-2,-8],[0,-5],[2,-8],[4,-7],[4,5],[-4,5]],color);
    head(0,-11,3.7,skin);
  }
  ctx.restore();
  if (number) {
    ctx.save();
    ctx.font = `bold ${16*scale}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4*scale;
    ctx.strokeStyle = '#102218';
    ctx.fillStyle = '#fff';
    const labelY = y-(perspective ? 53 : 22)*scale;
    ctx.strokeText(number,x,labelY);
    ctx.fillText(number,x,labelY);
    ctx.restore();
  }
}

function snapDisc([x,y],objects,omitted,project,tolerance) {
  const origin = project(x,y);
  const matches = [null,null];
  const distances = [tolerance,tolerance];
  objects.forEach((entry,index) => {
    if (!isDisc(entry) || index === omitted) return;
    const candidates = [project(entry.x,y),project(x,entry.y)];
    candidates.forEach(([px,py],axis) => {
      const distance = Math.hypot(px-origin[0],py-origin[1]);
      if (distance < distances[axis]) {
        distances[axis] = distance;
        matches[axis] = entry;
      }
    });
  });
  const point = [matches[0]?.x ?? x,matches[1]?.y ?? y];
  const lines = matches.filter(Boolean).map(({x,y}) => [[x,y],point]);
  return {point,lines};
}

function sortZonePoints(points) {
  if (points.length !== 4) return [];
  const center = points.reduce(([x,y],[px,py]) => [x+px/4,y+py/4],[0,0]);
  const angle = ([x,y]) => Math.atan2(y-center[1],x-center[0]);
  const vertices = [...points].sort((a,b) => angle(a)-angle(b));
  const area = vertices.reduce((sum,[x,y],index) => {
    const [nextX,nextY] = vertices[(index+1)%4];
    return sum+x*nextY-y*nextX;
  },0);
  const distinct = new Set(points.map(point => point.join(','))).size === 4;
  return distinct && Math.abs(area) > 0.02 ? vertices : [];
}

function presetZonePoints([[ax,ay],[bx,by]],shape,side) {
  const dx = bx-ax;
  const dy = by-ay;
  if (Math.hypot(dx,dy) < 0.5) return [];
  if (shape === 'diamond') {
    const cx = (ax+bx)/2;
    const cy = (ay+by)/2;
    return [[ax,ay],[cx-dy/3,cy+dx/3],[bx,by],[cx+dy/3,cy-dx/3]];
  }
  const depth = (shape === 'rectangle' ? 0.5 : 1)*side;
  return [[ax,ay],[bx,by],[bx-dy*depth,by+dx*depth],[ax-dy*depth,ay+dx*depth]];
}

function zonePoints(zone,objects) {
  const discs = zone.discIds.map(id => objects.find(entry => isDisc(entry) && entry.id === id));
  if (discs.some(disc => !disc)) return [];
  const points = discs.map(({x,y}) => [x,y]);
  if (points.length === 2 && ['square','rectangle','diamond'].includes(zone.shape)) {
    return presetZonePoints(points,zone.shape,zone.side === -1 ? -1 : 1);
  }
  return sortZonePoints(points);
}

function pointInZone([x,y],points) {
  let inside = false;
  points.forEach(([ax,ay],index) => {
    const [bx,by] = points[(index+1)%points.length];
    if ((ay > y) !== (by > y) && x < (bx-ax)*(y-ay)/(by-ay)+ax) inside = !inside;
  });
  return inside;
}

function videoFrame(board,objects,plan,perspective,angle) {
  const points = objects.flatMap(object => {
    if (isZone(object)) return zonePoints(object,objects);
    if (object.end) return routePoints(object);
    return [[object.x,object.y]];
  });
  const steps = [...plan.passes,...plan.runners.flatMap(runner => runner.steps)];
  for (const {route} of steps) {
    for (const {a,b} of route.segments) points.push(a,b);
  }
  const min = Math.min(...points.map(([x]) => x));
  const max = Math.max(...points.map(([x]) => x));
  const leftUsed = min < 50-1e-8;
  const rightUsed = max > 50+1e-8;
  const half = leftUsed === rightUsed ? null : leftUsed ? 'left' : 'right';
  if (!half) return {x:0,y:0,width:board.width,height:board.height,half};

  const left = half === 'left' ? -2 : 50;
  const right = half === 'left' ? 50 : 102;
  const projected = [[left,-2],[right,-2],[right,66],[left,66]].map(([x,y]) =>
    projectPoint(board,perspective,angle,x,y));
  const xs = projected.map(([x]) => x);
  const ys = projected.map(([,y]) => y);
  // Leave room for equipment, players and pass numbers along the touchlines.
  const x = 2*Math.floor((Math.min(...xs)-58)/2);
  const y = perspective ? 2*Math.floor((Math.min(...ys)-90)/2) : 0;
  const endX = 2*Math.ceil((Math.max(...xs)+58)/2);
  const endY = perspective ? 2*Math.ceil((Math.max(...ys)+58)/2) : board.height;
  return {x,y,width:endX-x,height:endY-y,half};
}

function drawField(canvas, objects, perspective, angle, selected, routeStart, viewport = {zoom:1,x:0,y:0}, units = 1, grip = null, hiddenObjects, zoneCorners = [], showZones = true, alignment = null, exportFrame = null, projection = canvas) {
  const ctx = canvas.getContext('2d');
  const {width:w,height:h} = projection;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const project = (x,y,z) => projectPoint(projection,perspective,angle,x,y,z);

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
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(viewport.x,viewport.y);
  ctx.scale(viewport.zoom,viewport.zoom);
  ctx.save();
  if (exportFrame?.half) {
    const left = exportFrame.half === 'left' ? -4 : 49.8;
    const right = exportFrame.half === 'left' ? 50.2 : 104;
    path(rect(left,-4,right-left,74));
    ctx.clip();
  }
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

  ctx.restore();

  objects.forEach((entry,index) => {
    if (!showZones || !isZone(entry)) return;
    const vertices = zonePoints(entry,objects);
    if (!vertices.length) return;
    const color = zoneColors[colorKey(zoneColors,entry.color,'blue')][1];
    path(vertices,color+'50',color,index === selected ? 6 : 3);
  });

  if (alignment) {
    for (const line of alignment.lines) {
      path(line,null,'#152a31',6/viewport.zoom,[10,7]);
      path(line,null,'#d8f8ff',3/viewport.zoom,[10,7]);
    }
    if (alignment.color) path(ring(...alignment.point,1.5),alignment.color+'aa','#fff',2/viewport.zoom);
  }

  const passLabels = [];
  objects.forEach((entry,index) => {
    const {type,end} = entry;
    if (!end) return;
    const points = routePoints(entry);
    const previous = points.at(-2);
    const heading = Math.atan2(end[1]-previous[1],end[0]-previous[0]);
    const color = {run:'#ffdb6b',dribble:'#9ef287',shot:'#fff'}[type] ?? '#6be1ff';
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

  const props = objects.map((entry,index) => ({entry,index})).filter(({entry}) => !entry.end && !isZone(entry) && !hiddenObjects?.has(entry));
  if (perspective) props.sort((a,b) =>
    (a.entry.x-b.entry.x)*sin+(a.entry.y-b.entry.y)*cos);
  for (const {entry,index} of props) {
    const {type,x,y} = entry;
    const rotation = (entry.rotation || 0)*Math.PI/180;
    const local = ([a,b,z]) => [x+a*Math.cos(rotation)-b*Math.sin(rotation),y+a*Math.sin(rotation)+b*Math.cos(rotation),z];
    const prop = (points,fill,stroke,weight) => path(points.map(local),fill,stroke,weight);
    if (index === selected || zoneCorners.includes(index)) path(ring(x,y,3.1),null,'#fff',4,[9,6]);
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
      const color = type === 'disc' ? discColors[colorKey(discColors,entry.color,'pink')][1] : '#ff9c3c';
      path(ring(x,y,1.5),color,'#502946',3);
      if (perspective && type === 'cone') prop([[-1.4,0,0],[0,0,2.9],[1.4,0,0]],'#ff9c3c','#a84a21',3);
      else path(ring(x,y,.55,type==='disc' ? .4 : 0),'#ffe0ac');
    } else if (type === 'pole') {
      path(ring(x,y,1.2),'#ffc95a','#4e3320',4);
      if (perspective) prop([[0,0,0],[0,0,6]],null,'#ffc95a',7);
    } else if (isPlayer(entry)) {
      const [px,py] = project(x,y);
      const [tx,ty] = project(x+Math.cos(rotation),y+Math.sin(rotation));
      drawFootballer(ctx,px,py,w/1500*1.25,perspective,Math.atan2(ty-py,tx-px),playerBib(entry),0,entry.number);
    } else if (type === 'ball') {
      const [px,py] = project(x,y);
      drawBall(ctx,px,py);
    }
  }
  const badgeUnit = Math.max(units,2.6)/viewport.zoom;
  const badgeCenters = [];
  const labelFrame = exportFrame ?? {x:0,y:0,width:w,height:h};
  passLabels.forEach(({center:[x,y],direction},index) => {
    const offset = 17*badgeUnit;
    const margin = 12*badgeUnit;
    const positions = [[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1],[2.3,0],[-2.3,0]];
    const candidates = positions.map(([side,along]) => [
      clamp(x+offset*(Math.sin(direction)*side+Math.cos(direction)*along*1.25),labelFrame.x+margin,labelFrame.x+labelFrame.width-margin),
      clamp(y+offset*(-Math.cos(direction)*side+Math.sin(direction)*along*1.25),labelFrame.y+margin,labelFrame.y+labelFrame.height-margin)
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
