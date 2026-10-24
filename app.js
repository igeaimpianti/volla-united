import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const $=s=>document.querySelector(s), app=$('#app'), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const configured=SUPABASE_URL.startsWith('https://')&&SUPABASE_ANON_KEY!=='INSERISCI_ANON_KEY';
const sb=configured?createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null;
let me=null,access=[],page='home',cats=[],players=[],matches=[],users=[],currentCat='',editing=null,selected=[],draft=null;
let playerDetails=[],distintaMatch=null;
let sessions=[],attendance=[],attendanceDate=new Date().toLocaleDateString('en-CA'),attendanceFrom='',attendanceTo='',attendancePlayer='';
const toast=m=>{let t=$('#toast');t.textContent=m;t.style.display='block';setTimeout(()=>t.style.display='none',3500)};
const field=(name,label,value='',type='text',extra='')=>`<div class="field ${extra}"><label for="${name}">${label}</label><input id="${name}" type="${type}" value="${esc(value)}" ${type==='date'?'required':''}></div>`;
const val=id=>$('#'+id)?.value?.trim()||'';
const rememberedUserKey='volla-united-remember-username';
const rememberedUsername=()=>{try{return localStorage.getItem(rememberedUserKey)||''}catch{return ''}};


// Nomi avversari: salvati sul dispositivo e recuperati anche dallo storico Supabase.
const opponentKey='volla-united-opponents-v1';
let serverOpponents=[];
const upper=s=>String(s??'').toLocaleUpperCase('it-IT');
function knownOpponents(){
  let local=[];
  try{local=JSON.parse(localStorage.getItem(opponentKey)||'[]')}catch{}
  return [...new Set([...serverOpponents,...local,...matches.map(m=>m.opponent)].filter(Boolean).map(x=>upper(x).trim()))].sort((a,b)=>a.localeCompare(b,'it'));
}
function rememberOpponent(name){
  const n=upper(name).trim();if(!n)return;
  try{localStorage.setItem(opponentKey,JSON.stringify([...new Set([...knownOpponents(),n])].slice(-250)))}catch(e){console.warn('Salvataggio locale avversari:',e)}
}
async function loadOpponents(){
  if(!sb)return [];
  const {data,error}=await sb.from('opponents').select('name').order('name');
  if(error){
    console.error('Lettura avversari Supabase:',error);
    toast('Errore caricamento avversari: '+error.message);
    return [];
  }
  serverOpponents=[...new Set((data||[]).map(x=>upper(x.name).trim()).filter(Boolean))];
  refreshOpponentSuggestions(document.activeElement?.id==='opponent');
  return serverOpponents;
}

async function saveOpponentToSupabase(name){
  const n=upper(name).trim();
  if(!n)return;
  if(serverOpponents.includes(n))return;
  const {error}=await sb.from('opponents').upsert({name:n},{onConflict:'name',ignoreDuplicates:true});
  if(error)throw new Error('Convocazione salvata, ma avversario non registrato: '+error.message);
  serverOpponents.push(n);
  rememberOpponent(n);
}
function opponentSuggestions(value=''){
  const q=upper(value).trim();
  // Su iPhone il menu rimane nascosto fino alla terza lettera.
  if(q.length<3)return [];
  return knownOpponents().filter(n=>n.includes(q)).slice(0,30);
}
// Menu in flusso: sempre IMMEDIATAMENTE SOTTO il campo, mai sopra.
// Non usa coordinate viewport, overlay o portali: la tastiera iOS non lo sposta.
function opponentMenu(){return document.getElementById('opponent-suggestions')}
function refreshOpponentSuggestions(show=true){
  const input=$('#opponent'),box=opponentMenu();
  if(!input||!box)return;
  const suggestions=opponentSuggestions(input.value);
  box.innerHTML=suggestions.map(n=>`<button type="button" data-opponent="${esc(n)}" style="display:block;width:100%;text-align:left;padding:13px;background:#24151d;color:#fff;border:0;border-bottom:1px solid #54313e;font:inherit">${esc(n)}</button>`).join('');
  Object.assign(box.style,{
    position:'static',top:'auto',left:'auto',right:'auto',width:'100%',
    maxHeight:'180px',overflowY:'auto',webkitOverflowScrolling:'touch',
    transform:'none',zIndex:'auto',marginTop:'5px',boxSizing:'border-box',
    background:'#24151d',border:'1px solid #54313e',borderRadius:'10px'
  });
  box.style.display=show&&suggestions.length?'block':'none';
  box.querySelectorAll('[data-opponent]').forEach(b=>{
    b.addEventListener('pointerdown',e=>e.preventDefault());
    b.addEventListener('click',()=>{
      input.value=b.dataset.opponent;
      box.style.display='none';
      input.focus();
    });
  });
}

function bindMatchText(){
  if(!$('#matchform'))return;
  opponentDropdownController.abort();opponentDropdownController=new AbortController();
  $('#matchform').querySelectorAll('input[type="text"], textarea').forEach(el=>{
    el.style.textTransform='uppercase';
    el.addEventListener('input',()=>{
      const a=el.selectionStart,b=el.selectionEnd;
      el.value=upper(el.value);
      try{el.setSelectionRange(a,b)}catch{}
      if(el.id==='opponent')refreshOpponentSuggestions(true);
    });
    el.value=upper(el.value);
  });
  const input=$('#opponent'),box=$('#opponent-suggestions');
  if(input&&box){
    input.setAttribute('autocomplete','off');
    input.setAttribute('aria-autocomplete','list');
    // Rileggi Supabase a ogni apertura, anche se la PWA era rimasta in background.
    let opponentFetchInProgress=false;
    const openOpponents=async()=>{
      refreshOpponentSuggestions(true);
      if(opponentFetchInProgress)return;
      opponentFetchInProgress=true;
      try{
        await loadOpponents();
        if(document.activeElement===input)refreshOpponentSuggestions(true);
      }finally{opponentFetchInProgress=false}
    };
    input.addEventListener('focus',openOpponents);
    input.addEventListener('click',openOpponents);
    input.addEventListener('keydown',e=>{if(e.key==='Escape')box.style.display='none'});
    input.addEventListener('blur',()=>setTimeout(()=>{box.style.display='none'},250));
    document.addEventListener('pointerdown',e=>{if(!input.contains(e.target)&&!box.contains(e.target))box.style.display='none'},{signal:opponentDropdownController.signal});
    refreshOpponentSuggestions(false);
  }
}
let opponentDropdownController=new AbortController();

const permitted=()=>me?.role==='admin'?cats.map(c=>c.id):access.map(a=>a.category_id);
const convocable=()=>access.filter(a=>a.can_call_up).map(a=>a.category_id);
const allowed=(cat,action='view')=>(me?.role==='admin'&&action==='view')||access.some(a=>a.category_id===cat&&(action==='view'||a.can_call_up));
const selectedCategory=()=>cats.find(c=>c.id===currentCat);
const categoryOptions=(ids=permitted())=>cats.filter(c=>ids.includes(c.id)).map(c=>`<option value="${esc(c.id)}" ${currentCat===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
const nav=()=>`<header class="top"><div class="brand"><img src="logo.png" alt="Volla United"><div><h1>VOLLA UNITED</h1><div class="sub">TEAM MANAGEMENT</div></div></div><div class="row"><span class="pill">${esc(me?.full_name||'Mister')}</span><button class="btn alt sm" data-action="logout">Esci</button></div></header><div class="tabs">${[['home','🏠 Home'],['players','⚽ Calciatori'],['matches','📋 Convocazioni'],['history','🗂 Storico'],['attendance','✅ Presenze'],...(me?.role==='admin'?[['admin','⚙️ Admin']]:[])].map(([p,t])=>`<button class="tab ${page===p?'active':''}" data-page="${p}">${t}</button>`).join('')}</div>`;
function login(force=false){app.innerHTML=`<main class="login"><div class="loginbox"><img src="logo.png" alt="Volla United"><h1>VOLLA UNITED</h1><p class="sub">${force?'PRIMO ACCESSO · CAMBIO PASSWORD':'ACCESSO RISERVATO AI MISTER'}</p><form id="loginform" class="stack">${force?`<p class="muted">Devi scegliere una password personale prima di continuare.</p>${field('newpass','Nuova password','','password')}${field('confirm','Conferma password','','password')}`:`${field('username','Nome utente',rememberedUsername())}${field('password','Password','','password')}<label style="display:flex;align-items:center;gap:10px;font-size:15px;cursor:pointer"><input type="checkbox" id="remember-login" style="width:20px;height:20px;flex:none" ${rememberedUsername()?'checked':''}> Ricorda nome utente</label>`}<button class="btn">${force?'Salva password e accedi':'Accedi →'}</button></form><div id="autherror" class="error"></div>${!configured?'<p class="error">Configurazione Supabase mancante. Consulta README.md.</p>':''}</div></main>`;
$('#loginform').onsubmit=async e=>{e.preventDefault();$('#autherror').textContent='';try{if(!sb)throw Error('Collega Supabase per attivare il login');if(force){if(val('newpass').length<10)throw Error('Password di almeno 10 caratteri');if(val('newpass')!==val('confirm'))throw Error('Le password non coincidono');await adminCall({action:'change-password',password:val('newpass')});page='home';editing=null;draft=null;selected=[];await load();}else{const uname=val('username').toLowerCase();const email=uname.includes('@')?uname:uname+'@users.volla.invalid';const {error}=await sb.auth.signInWithPassword({email,password:val('password')});if(error)throw Error('Credenziali non valide');try{if($('#remember-login')?.checked)localStorage.setItem(rememberedUserKey,uname);else localStorage.removeItem(rememberedUserKey)}catch{}page='home';editing=null;draft=null;selected=[];await load();}}catch(err){$('#autherror').textContent=err.message}}}
async function query(table,cols='*'){const {data,error}=await sb.from(table).select(cols);if(error)throw error;return data||[]}
async function load(){try{const {data:{user}}=await sb.auth.getUser();if(!user){me=null;login();return}const {data,error}=await sb.from('profiles').select('*').eq('id',user.id).single();if(error)throw error;me=data;if(me.must_change_password){page='home';login(true);return}cats=await query('categories');access=await query('coach_categories');players=await query('players');matches=await query('matches');await loadOpponents();const mp=await query('match_players');matches.forEach(m=>m.player_ids=mp.filter(x=>x.match_id===m.id).sort((a,b)=>a.sort_order-b.sort_order).map(x=>x.player_id));users=me.role==='admin'?await query('profiles'):[];await loadPlayerDetails();await loadAttendance();if(!permitted().includes(currentCat))currentCat=permitted()[0]||'';render()}catch(e){toast(e.message);console.error(e)}}
function render(){document.getElementById('opponent-suggestions')?.remove();app.innerHTML=`<main class="shell">${nav()}<div id="content"></div><footer class="foot">#weL⚽ve VOLLAUNITED 🔥</footer></main>`;let c=$('#content');if(page==='home')c.innerHTML=home();if(page==='players')c.innerHTML=roster();if(page==='matches')c.innerHTML=matchEditor();if(page==='history')c.innerHTML=history();if(page==='attendance')c.innerHTML=attendancePage();if(page==='admin')c.innerHTML=admin();bind()}
const home=()=>`<section class="hero"><div><div class="sub">BENVENUTO NEL CLUB</div><h2>Ciao, ${esc(me.full_name)}! 🔥</h2><p>${me.role==='admin'?'Gestisci la società. Convocazioni abilitate soltanto per le tue categorie autorizzate.':'La tua squadra, le tue convocazioni.'}</p></div></section><div class="grid">${[['players','👥','Calciatori','Gestisci la rosa'],['matches','📋','Convocazioni','Prepara la partita'],['history','🏟','Storico','Le gare precedenti'],['attendance','✅','Presenze','Allenamenti e statistiche'],[me.role==='admin'?'admin':'players','🛡️',me.role==='admin'?'Amministrazione':'Categorie','Gestione società']].map(([p,i,t,s])=>`<button class="tile" data-page="${p}"><span class="emoji">${i}</span><b>${t}</b><span>${s}</span></button>`).join('')}</div><section class="panel"><h3>Le tue categorie</h3>${cats.filter(c=>permitted().includes(c.id)).map(c=>`<div class="item"><strong>${esc(c.name)}</strong><small>${allowed(c.id,'convocate')?'✓ Puoi convocare':'Solo visualizzazione'} · ${players.filter(p=>p.category_id===c.id).length} calciatori</small></div>`).join('')||'<p class="empty">Nessuna categoria assegnata</p>'}</section>`;
const catSelector=(ids=permitted())=>`<div class="field"><label>Categoria</label><select id="category">${categoryOptions(ids)}</select></div>`;
const detailOf=id=>playerDetails.find(d=>d.player_id===id)||{};
async function loadPlayerDetails(){const r=await sb.from('player_details').select('*');if(r.error){console.warn('Dettagli giocatori:',r.error);playerDetails=[];toast('Configura la tabella player_details su Supabase');return}playerDetails=r.data||[]}
const roster=()=>`<div class="row sectionhead"><h2>⚽ Calciatori</h2><button class="btn sm" data-action="new-player">+ Nuovo</button></div>${catSelector()}<div id="playerform"></div><section class="panel"><div class="row" style="align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><h3 style="margin:0">Rosa ${esc(selectedCategory()?.name||'')}</h3><strong style="font-size:14px;white-space:nowrap">Iscritti ${players.filter(p=>p.category_id===currentCat).length} Calciatori</strong></div>${players.filter(p=>p.category_id===currentCat).sort(sortPlayers).map(p=>`<div class="item row"><div><strong>${esc(p.last_name)} ${esc(p.first_name)} ${p.jersey_number?'#'+esc(p.jersey_number):''}</strong><small>${esc(p.primary_role||'Ruolo non indicato')}${p.secondary_role?' · '+esc(p.secondary_role):''}${detailOf(p.id).team_role==='captain'?' · CAPITANO':detailOf(p.id).team_role==='vice'?' · VICECAPITANO':''}</small></div><div class="actions"><button class="btn alt sm" data-action="edit-player" data-id="${p.id}">Modifica</button><button class="btn alt sm" data-action="delete-player" data-id="${p.id}">✕</button></div></div>`).join('')||'<p class="empty">Nessun calciatore presente</p>'}</section>`;
const roles=['Portiere','Difensore','Centrocampista','Attaccante','Jolly'];
// Ordine fisso per ruolo, poi cognome e nome (italiano).
const roleOrder=['Portiere','Difensore','Centrocampista','Attaccante'];
const sortPlayers=(a,b)=>{
  const rank=p=>{const n=roleOrder.indexOf(p.primary_role);return n<0?roleOrder.length:n};
  return rank(a)-rank(b) || (a.last_name||'').localeCompare(b.last_name||'','it',{sensitivity:'base'}) || (a.first_name||'').localeCompare(b.first_name||'','it',{sensitivity:'base'});
};

const playerForm=p=>`<form id="playerformreal" class="panel"><h3>${p?'Modifica':'Nuovo'} calciatore</h3><div class="fields">${field('firstname','Nome',p?.first_name)}${field('surname','Cognome',p?.last_name)}${field('birthday','Data di nascita',p?.birth_date,'date')}${field('shirt','Numero maglia',p?.jersey_number,'number')}<div class="field"><label>Ruolo principale</label><select id="role">${roles.map(r=>`<option ${p?.primary_role===r?'selected':''}>${r}</option>`).join('')}</select></div><div class="field"><label>Ruolo secondario</label><select id="role2"><option value="">Nessuno</option>${roles.map(r=>`<option ${p?.secondary_role===r?'selected':''}>${r}</option>`).join('')}</select></div><div class="field"><label>Qualifica</label><select id="teamrole">${[['none','Calciatore'],['captain','Capitano (CAP)'],['vice','Vicecapitano (V.CAP)']].map(([v,t])=>`<option value="${v}" ${((p&&detailOf(p.id).team_role)||'none')===v?'selected':''}>${t}</option>`).join('')}</select></div>${field('identitynumber','Numero carta identità',p?detailOf(p.id).identity_number:'')}${field('figcnumber','Matricola FIGC',p?detailOf(p.id).figc_number:'')}</div><div class="actions"><button class="btn">Salva calciatore</button><button type="button" class="btn alt" data-action="close-player">Annulla</button></div></form>`;
const matchEditor=()=>{let ids=convocable();if(editing&&me.role==='admin'&&!ids.includes(currentCat))ids=[...ids,currentCat];if(!ids.includes(currentCat))currentCat=ids[0]||'';if(!ids.length)return'<h2>📋 Convocazioni</h2><div class="panel empty">Non sei autorizzato a creare convocazioni per nessuna categoria.</div>';const ps=players.filter(p=>p.category_id===currentCat).sort(sortPlayers);return`<h2 class="sectionhead">📋 ${editing?'Modifica':'Nuova'} convocazione</h2>${catSelector(ids)}<form id="matchform" class="panel"><div class="fields"><div class="field"><label>Tipologia gara</label><select id="kind">${['AMICHEVOLE','TORNEO FIGC','NEXT GEN','CAMPIONATO','TORNEO','TRIANGOLARE','ALTRO'].map(x=>`<option ${draft?.match_type===x||((draft?.match_type&&!['AMICHEVOLE','TORNEO FIGC','NEXT GEN','CAMPIONATO','TORNEO','TRIANGOLARE'].includes(draft.match_type))&&x==='ALTRO')?'selected':''}>${x}</option>`).join('')}</select></div>${field('customkind','Se ALTRO, specifica',draft?.custom_kind||((draft?.match_type&&!['AMICHEVOLE','TORNEO FIGC','NEXT GEN','CAMPIONATO','TORNEO','TRIANGOLARE'].includes(draft.match_type))?draft.match_type:''))}${field('fieldname','Campo da gioco',draft?.field_name||'MADRIGAL')}${field('opponent','Avversario',draft?.opponent).replace('<input id="opponent"','<input id="opponent" autocomplete="off"').replace('</div>','<div id="opponent-suggestions" role="listbox" style="display:none;position:static;width:100%;max-height:180px;overflow-y:auto;border:1px solid #54313e;border-radius:10px;background:#24151d;z-index:100;box-shadow:0 10px 25px #0008"></div></div>')}${field('date','Data',draft?.match_date||new Date().toLocaleDateString('en-CA'),'date')}${field('meet','Ora convocazione',draft?.meeting_time||'17:35','time')}${field('start','Inizio partita',draft?.kick_off_time||'17:50','time')}${field('shirtcolor','Maglia',draft?.jersey_color||'ROSSO-NERA')}${field('shorts','Pantaloncini',draft?.shorts_color||'NERO')}${field('socks','Calzerotti',draft?.socks_color||'NERO')}</div><div class="field" style="margin-top:13px"><label>Avviso ai genitori</label><textarea id="notice">${esc(draft?.notice||'Comunicare tempestivamente ogni tipo di assenza IN PRIVATO.')}</textarea></div><div class="field" style="margin-top:13px"><label>Mister (uno per riga)</label><textarea id="coaches">${esc(draft?.coaches_text||me.full_name.toUpperCase())}</textarea></div><h3 class="sectionhead">Seleziona i convocati · <span id="count">${selected.length}</span></h3><div class="stack">${ps.map(p=>`<div class="check"><input type="checkbox" id="p${p.id}" data-player="${p.id}" ${selected.includes(p.id)?'checked':''}><label for="p${p.id}">${esc(p.last_name)} ${esc(p.first_name)} <span class="muted">· ${esc(p.primary_role||'')}</span></label></div>`).join('')||'<p class="empty">Inserisci prima i calciatori della categoria.</p>'}</div><div class="actions"><button class="btn" type="submit">💾 Salva convocazione</button><button class="btn alt" type="button" data-action="preview">👁 Anteprima WhatsApp</button></div></form><div id="previewarea"></div>`};
function getDraft(){return{category_id:currentCat,match_type:upper(val('customkind')||val('kind')),field_name:upper(val('fieldname')),opponent:upper(val('opponent')),match_date:val('date'),meeting_time:val('meet'),kick_off_time:val('start'),jersey_color:upper(val('shirtcolor')),shorts_color:upper(val('shorts')),socks_color:upper(val('socks')),notice:upper(val('notice')),coaches_text:upper(val('coaches')),player_ids:selected}}
const history=()=>`<h2>🗂 Storico convocazioni</h2><section class="panel">${matches.sort((a,b)=>b.match_date.localeCompare(a.match_date)).map(m=>`<div class="item"><div class="row"><div><strong>${esc(m.opponent)} · ${esc(cats.find(c=>c.id===m.category_id)?.name)}</strong><small>${esc(m.match_date)} · ${esc(m.field_name)} · ${esc(m.match_type)}</small></div><button class="btn alt sm" data-action="view-match" data-id="${m.id}">Apri</button></div></div>`).join('')||'<p class="empty">Nessuna convocazione salvata</p>'}</section><div id="historydetail"></div>`;
function formatMessage(m){const dt=new Date(m.match_date+'T12:00:00');const date=isNaN(+dt)?m.match_date:dt.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).toUpperCase();const names=(m.player_ids||[]).map(id=>players.find(p=>p.id===id)).filter(Boolean).sort(sortPlayers);return`ⒸⓄⓃⓋⓄⒸⒶⓏⒾⓄⓃⒺ\n\n⚽️ 𝚃𝙸𝙿𝙾𝙻𝙾𝙶𝙸𝙰 𝙶𝙰𝚁𝙰: ${m.match_type}\n🏟 𝙲𝙰𝙼𝙿𝙾 𝙳𝙰 𝙶𝙸𝙾𝙲𝙾: ${m.field_name}\n🗓 𝙳𝙰𝚃A: ${date}\n🥅 𝙰𝚅𝚅𝙴𝚁𝚂𝙰𝚁𝙸𝙾: ${m.opponent}\n⏱ 𝙾𝚛𝚊 𝚌𝚘𝚗𝚟𝚘𝚌𝚊𝚣𝚒𝚘𝚗𝚎: ${(m.meeting_time||'').slice(0,5).replace(':',',')}\n⏱ inizio partita : ${(m.kick_off_time||'').slice(0,5).replace(':',',')}\n🎽 𝙲𝚘𝚖𝚙𝚕𝚎𝚝𝚘 𝚐𝚊𝚛𝚊:\n𝑴𝒂𝒈𝒍𝒊𝒂 𝐆𝐀𝐑𝐀  ${m.jersey_color}\n𝑷𝒂𝒏𝒕𝒂𝒍𝒐𝒏𝒄𝒊𝒏𝒊 ${m.shorts_color}\n𝑪𝒂𝒍𝒛𝒆𝒓𝒐𝒕𝒕𝒊 ${m.socks_color}\n⚠️ 𝐀𝐓𝐓𝐄𝐍𝐙𝐈𝐎𝐍𝐄\n${m.notice}\nℂ𝕆ℕ𝕍𝕆ℂ𝔸𝕋𝕀\n${names.map((p,i)=>`${i+1}. ${p.last_name} ${p.first_name}`).join('\n')}\n🖋 𝙼𝚒𝚜𝚝𝚎𝚛\n${m.coaches_text}\n#𝚠𝚎𝙻⚽️𝚟𝚎 VOLLAUNITED🔥`}
function preview(m,target){
  const text=formatMessage(m);
  const area=$(target);if(!area)return;
  area.innerHTML=`<section class="panel"><h3>Anteprima WhatsApp</h3><div class="preview">${esc(text)}</div><div class="actions"><button class="btn alt" type="button" data-action="copy">📋 Copia</button><button class="btn" type="button" data-action="whatsapp">🟢 Condividi WhatsApp</button></div></section>`;
  window._previewText=text;
  // Il testo viene passato direttamente: niente riferimenti a pulsanti creati prima.
  area.querySelector('[data-action="copy"]')?.addEventListener('click',()=>copyMessage(text));
  area.querySelector('[data-action="whatsapp"]')?.addEventListener('click',()=>shareWhatsApp(text));
}
async function copyMessage(message){
  if(!message)return toast('Nessun messaggio da copiare');
  try{
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(message);toast('Messaggio copiato');return}
  }catch(e){console.warn('Clipboard API:',e)}
  const el=document.createElement('textarea');el.value=message;el.readOnly=true;
  el.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
  document.body.appendChild(el);el.focus();el.select();el.setSelectionRange(0,el.value.length);
  let ok=false;try{ok=document.execCommand('copy')}catch{}el.remove();
  if(ok){toast('Messaggio copiato');return}
  // Ultima possibilità su iOS: mostra il testo selezionabile.
  const area=document.querySelector('#historydetail .preview, #previewarea .preview');
  if(area){area.style.userSelect='text';area.style.webkitUserSelect='text'}
  toast('Copia non disponibile: tieni premuto sul testo per copiarlo');
}
function shareWhatsApp(message){
  if(!message)return toast('Nessun messaggio da condividere');
  // Navigazione diretta sul click: iOS PWA può bloccare window.open in una nuova finestra.
  const url='https://api.whatsapp.com/send?text='+encodeURIComponent(message);
  window.location.assign(url);
}


// PRESENZE ALLENAMENTI - una sessione per categoria e data.
async function loadAttendance(){
  const [a,b]=await Promise.all([sb.from('training_sessions').select('*').order('training_date',{ascending:false}),sb.from('training_attendance').select('*')]);
  if(a.error||b.error){console.error(a.error||b.error);sessions=[];attendance=[];toast('Configura le tabelle presenze su Supabase');return}
  sessions=a.data||[];attendance=b.data||[];
}
const dateIt=d=>d?new Date(d+'T12:00:00').toLocaleDateString('it-IT'):'';
const fullName=p=>`${p.last_name||''} ${p.first_name||''}`.trim();
function attendancePage(){
  const ps=players.filter(p=>p.category_id===currentCat).sort((a,b)=>fullName(a).localeCompare(fullName(b),'it'));
  const sess=sessions.find(x=>x.category_id===currentCat&&x.training_date===attendanceDate);
  const rows=attendance.filter(x=>x.session_id===sess?.id);
  const from=attendanceFrom||new Date(new Date().getFullYear(),new Date().getMonth(),1).toLocaleDateString('en-CA');
  const to=attendanceTo||new Date().toLocaleDateString('en-CA');
  const filtered=sessions.filter(x=>x.category_id===currentCat&&x.training_date>=from&&x.training_date<=to).sort((a,b)=>a.training_date.localeCompare(b.training_date));
  const stats=ps.filter(p=>!attendancePlayer||p.id===attendancePlayer).map(p=>{
    const entries=filtered.map(t=>attendance.find(a=>a.session_id===t.id&&a.player_id===p.id)).filter(Boolean);
    const present=entries.filter(x=>x.present).length;
    return {p,present,absent:entries.length-present,total:entries.length,percentage:entries.length?Math.round(present*100/entries.length):0};
  });
  const editable=me.role==='admin'||access.some(a=>a.category_id===currentCat);
  return `<h2>✅ Presenze allenamenti</h2>${catSelector()}<section class="panel"><h3>Registro allenamento</h3>${field('training-date','Data allenamento',attendanceDate,'date')}
    <p class="muted">${sess?'Allenamento già registrato: puoi aggiornare le presenze.':'Nuovo allenamento: seleziona i presenti e salva.'}</p>
    <div class="stack">${ps.map(p=>`<label class="check" style="display:flex;align-items:center;gap:12px"><input type="checkbox" data-attend="${esc(p.id)}" ${rows.find(r=>r.player_id===p.id)?.present?'checked':''} ${!editable?'disabled':''}><span>${esc(fullName(p))}</span></label>`).join('')||'<p class="empty">Nessun calciatore nella categoria</p>'}</div>
    ${editable?'<div class="actions"><button class="btn" id="save-attendance">💾 Salva presenze</button>'+(sess?'<button class="btn alt" id="delete-attendance-day" type="button">🗑 Elimina questo allenamento</button>':'')+'</div>':''}</section>
    <section class="panel"><h3>Statistiche e PDF</h3><div class="fields">${field('att-from','Dal',from,'date')}${field('att-to','Al',to,'date')}
    <div class="field"><label>Allievo</label><select id="att-player"><option value="">Tutti gli allievi</option>${ps.map(p=>`<option value="${esc(p.id)}" ${attendancePlayer===p.id?'selected':''}>${esc(fullName(p))}</option>`).join('')}</select></div></div>
    <div class="actions"><button class="btn alt sm" data-period="week">Settimana</button><button class="btn alt sm" data-period="month">Mese</button><button class="btn alt sm" data-period="year">Anno</button><button class="btn alt sm" data-period="all">Tutto</button></div>
    <details class="panel" style="margin:12px 0" id="training-session-list"><summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 0"><span><strong>${filtered.length} allenamenti registrati nel periodo</strong><small style="display:block;margin-top:6px">Clicca per visualizzare le date e gestire gli allenamenti.</small></span><span aria-hidden="true" style="font-size:21px">⌄</span></summary><p class="muted">Le assenze si contano solo per le sessioni in cui è stata registrata una presenza o assenza per l'allievo.</p>${filtered.length?`<div class="stack">${filtered.map(t=>`<div class="item row" style="gap:12px;align-items:center;justify-content:space-between"><strong>${esc(dateIt(t.training_date))}</strong>${editable?`<button type="button" class="btn alt sm" data-remove-training="${esc(t.id)}">🗑 Elimina</button>`:''}</div>`).join('')}</div>`:'<p class="empty">Nessun allenamento nel periodo selezionato.</p>'}${editable&&filtered.length>1?`<details style="margin-top:12px"><summary style="cursor:pointer">Elimina più allenamenti</summary><div class="stack">${filtered.map(t=>`<label class="check" style="display:flex;align-items:center;gap:10px"><input type="checkbox" data-delete-session="${esc(t.id)}"><span>${esc(dateIt(t.training_date))}</span></label>`).join('')}</div><div class="actions"><button type="button" class="btn alt" id="delete-attendance-selected">🗑 Elimina date selezionate</button></div></details>`:''}</details>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Allievo</th><th>P</th><th>A</th><th>%</th></tr></thead><tbody>${stats.map(x=>`<tr><td style="padding:9px 3px">${esc(fullName(x.p))}</td><td align="center">${x.present}</td><td align="center">${x.absent}</td><td align="center">${x.percentage}%</td></tr>`).join('')}</tbody></table></div>
    <div class="actions"><button class="btn" id="print-attendance">📄 Genera PDF presenze</button></div></section>`;
}
async function deleteTrainingSessions(ids){
  const valid=sessions.filter(t=>ids.includes(t.id)&&t.category_id===currentCat);
  if(valid.length!==ids.length||!valid.length)return toast('Seleziona allenamenti validi della categoria');
  if(!(me.role==='admin'||access.some(a=>a.category_id===currentCat)))return toast('Non autorizzato');
  const dates=valid.map(t=>dateIt(t.training_date)).join(', ');
  if(!confirm(`Eliminare definitivamente ${valid.length} allenamento/i (${dates}) e tutte le presenze e assenze collegate? Questa operazione non si può annullare.`))return;
  try{
    // ON DELETE CASCADE elimina le righe training_attendance collegate.
    const {data,error}=await sb.from('training_sessions').delete().in('id',ids).eq('category_id',currentCat).select('id');
    if(error)throw error;
    if((data||[]).length!==ids.length)throw Error('Eliminazione non completata: controlla i permessi Supabase');
    await loadAttendance();render();toast('Allenamenti eliminati: '+ids.length);
  }catch(err){toast('Errore eliminazione: '+err.message)}
}
function bindAttendance(){
  document.querySelectorAll('[data-remove-training]').forEach(btn=>btn.addEventListener('click',()=>{
    deleteTrainingSessions([btn.dataset.removeTraining]);
  }));

  $('#delete-attendance-day')?.addEventListener('click',()=>{
    const t=sessions.find(x=>x.category_id===currentCat&&x.training_date===attendanceDate);
    if(t)deleteTrainingSessions([t.id]);
  });
  $('#delete-attendance-selected')?.addEventListener('click',()=>{
    const ids=[...document.querySelectorAll('[data-delete-session]:checked')].map(x=>x.dataset.deleteSession);
    if(!ids.length)return toast('Seleziona almeno una data');
    deleteTrainingSessions(ids);
  });
  $('#training-date')?.addEventListener('change',e=>{attendanceDate=e.target.value;render()});
  $('#att-from')?.addEventListener('change',e=>{attendanceFrom=e.target.value;render()});
  $('#att-to')?.addEventListener('change',e=>{attendanceTo=e.target.value;render()});
  $('#att-player')?.addEventListener('change',e=>{attendancePlayer=e.target.value;render()});
  document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{
    const today=new Date(),p=b.dataset.period;
    const start=p==='week'?new Date(today.getFullYear(),today.getMonth(),today.getDate()-(today.getDay()+6)%7):p==='month'?new Date(today.getFullYear(),today.getMonth(),1):p==='year'?new Date(today.getFullYear(),0,1):new Date(2000,0,1);
    const local=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    attendanceFrom=local(start);attendanceTo=local(today);render();
  });
  $('#save-attendance')?.addEventListener('click',async e=>{
    const btn=e.currentTarget;btn.disabled=true;
    try{
      if(!currentCat||!attendanceDate)throw Error('Seleziona categoria e data');
      const ps=players.filter(p=>p.category_id===currentCat);
      if(!ps.length)throw Error('Non ci sono allievi');
      let sess=sessions.find(x=>x.category_id===currentCat&&x.training_date===attendanceDate);
      const anyPresent=ps.some(p=>document.querySelector(`[data-attend="${p.id}"]`)?.checked);
      if(!anyPresent){
        if(sess){
          await deleteTrainingSessions([sess.id]);
        }else{
          toast('Nessuna presenza selezionata: allenamento non creato');
        }
        btn.disabled=false;
        return;
      }
      if(!sess){const r=await sb.from('training_sessions').insert({category_id:currentCat,training_date:attendanceDate,created_by:me.id}).select('id').single();if(r.error)throw r.error;sess=r.data}
      const data=ps.map(p=>({session_id:sess.id,player_id:p.id,present:!!document.querySelector(`[data-attend="${p.id}"]`)?.checked}));
      const r=await sb.from('training_attendance').upsert(data,{onConflict:'session_id,player_id'});if(r.error)throw r.error;
      await loadAttendance();render();toast('Presenze salvate correttamente');
    }catch(err){toast('Errore: '+err.message);btn.disabled=false}
  });
  $('#print-attendance')?.addEventListener('click',()=>{
    const from=val('att-from'),to=val('att-to');if(from>to)return toast('Intervallo date non valido');
    const ps=players.filter(p=>p.category_id===currentCat&&(!attendancePlayer||p.id===attendancePlayer)).sort((a,b)=>fullName(a).localeCompare(fullName(b),'it'));
    const dates=sessions.filter(x=>x.category_id===currentCat&&x.training_date>=from&&x.training_date<=to).sort((a,b)=>a.training_date.localeCompare(b.training_date));
    const cell=(p,t)=>{const r=attendance.find(x=>x.session_id===t.id&&x.player_id===p.id);return r?(r.present?'P':'A'):'—'};
    const body=ps.map(p=>{const a=dates.map(t=>cell(p,t));const n=a.filter(x=>x==='P').length,abs=a.filter(x=>x==='A').length;return `<tr><td>${esc(fullName(p))}</td>${a.map(x=>`<td>${x}</td>`).join('')}<td>${n}</td><td>${abs}</td><td>${n+abs?Math.round(n*100/(n+abs)):0}%</td></tr>`}).join('');
    const html=`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Presenze Volla United</title><style>body{font-family:Arial,sans-serif;padding:16px;color:#222}header{display:flex;align-items:center;gap:16px}img{width:72px;height:72px;object-fit:contain}h1{font-size:22px}table{border-collapse:collapse;width:100%;font-size:10px;margin-top:20px}td,th{border:1px solid #999;padding:6px;text-align:center}td:first-child,th:first-child{text-align:left;white-space:nowrap}th{background:#eee}@page{size:landscape;margin:12mm}</style></head><body><header><img src="${new URL('logo.png',location.href).href}"><div><h1>VOLLA UNITED · REGISTRO PRESENZE</h1><p>Categoria: ${esc(selectedCategory()?.name||'')} · Dal ${dateIt(from)} al ${dateIt(to)}</p></div></header><table><thead><tr><th>Allievo</th>${dates.map(t=>`<th>${dateIt(t.training_date)}</th>`).join('')}<th>P</th><th>A</th><th>%</th></tr></thead><tbody>${body}</tbody></table><p>P = Presente · A = Assente · — = Non registrato</p><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350))<\/script></body></html>`;
    const w=window.open('','_blank');if(!w)return toast('Consenti i popup per generare il PDF');w.document.open();w.document.write(html);w.document.close();
  });
}

const admin=()=>`<h2>⚙️ Pannello amministratore</h2><div class="panel"><h3>Categorie</h3><form id="catform" class="row"> <input id="catname" placeholder="Es. 2021 o Under 12" required><button class="btn">+ Aggiungi</button></form>${cats.map(c=>`<div class="item row"><strong>${esc(c.name)}</strong><small>${esc(c.id.slice(0,8))}</small></div>`).join('')}</div><div class="panel"><h3>Crea account mister</h3><form id="userform" class="stack">${field('newname','Nome e cognome')}${field('newuser','Nome utente (lettere, numeri e punti)')}<div class="field"><label>Categorie da assegnare al mister</label>${cats.map(c=>`<div class="row" style="padding:7px 0"><strong>${esc(c.name)}</strong><label><input type="checkbox" style="width:auto" data-newcat="${esc(c.id)}"> Vedi</label><label><input type="checkbox" style="width:auto" data-newcall="${esc(c.id)}"> Convoca</label></div>`).join('')}</div><button class="btn">Genera accesso temporaneo</button></form><div id="credential"></div></div><div class="panel"><h3>Gestisci mister e autorizzazioni</h3>${users.map(u=>`<div class="item"><div class="row"><div><strong>${esc(u.full_name)}</strong><small>${esc(u.username)} · ${esc(u.role)}</small></div><button class="btn alt sm" data-action="reset-pass" data-id="${u.id}">Reset password</button></div><div style="margin-top:12px">${cats.map(c=>{let a=access.find(a=>a.user_id===u.id&&a.category_id===c.id);return`<div class="row" style="padding:7px 0"><small>${esc(c.name)}</small><label><input type="checkbox" style="width:auto" data-access="${u.id}|${c.id}|view" ${a?'checked':''}> Vedi</label><label><input type="checkbox" style="width:auto" data-access="${u.id}|${c.id}|convocate" ${a?.can_call_up?'checked':''}> Convoca</label></div>`}).join('')}</div></div>`).join('')}</div><p class="muted">Le password temporanee sono visibili soltanto quando vengono generate: consegnale privatamente ai mister.</p>`;
async function save(table,obj,id){let q=id?sb.from(table).update(obj).eq('id',id):sb.from(table).insert(obj);const {error}=await q;if(error)throw error;await load()}
async function adminCall(body){const {data:{session}}=await sb.auth.getSession();const r=await fetch(`${SUPABASE_URL}/functions/v1/manage-users`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,apikey:SUPABASE_ANON_KEY},body:JSON.stringify(body)});const x=await r.json();if(!r.ok)throw Error(x.error||'Operazione non riuscita');return x}

const fmtItalian=d=>d?d.split('-').reverse().join('/') : '';
function distintaForm(m){
 const values={heading:'VOLLA UNITED - '+(m.opponent||''),competition:m.match_type||'',place:m.field_name||'',date:m.match_date||'',time:(m.kick_off_time||'').slice(0,5),assistant:'',assistant_doc:'',accompanying:'',accompanying_doc:'',referee_officer:'',referee_officer_doc:'',coach:m.coaches_text||'',coach_doc:'',doctor:'',doctor_doc:'',masseur:'',masseur_doc:''};
 const f=(id,label,type='text')=>`<div class="field"><label>${label}</label><input id="df-${id}" type="${type}" value="${esc(values[id]||'')}"></div>`;
 const staff=[['assistant','Assistente arbitro'],['accompanying','Dirigente accompagnatore'],['referee_officer','Dirigente addetto arbitro'],['coach','Allenatore'],['doctor','Medico sociale'],['masseur','Massaggiatore']];
 return `<section class="panel" id="distinta-panel"><h2>📄 Distinta Gara · ${esc(m.opponent||'')}</h2><p class="muted">I campi sono modificabili. Il PDF riproduce il modello ufficiale caricato.</p><div class="fields">${f('heading','Distinta Giocatori partecipanti alla gara')}${f('competition','Campionato')}${f('place','Da disputare a')}${f('date','Il','date')}${f('time','Alle ore','time')}</div><h3>Staff (facoltativo)</h3><div class="fields">${staff.map(([k,label])=>f(k,label)+f(k+'_doc','Documento e/o tessera FIGC n°')).join('')}</div><div class="actions"><button type="button" class="btn" id="create-distinta">📄 Genera PDF distinta</button><button type="button" class="btn alt" id="close-distinta">Chiudi</button></div><p class="muted">C.I. e matricola vengono recuperate dalle schede calciatori.</p></section>`;
}
function openDistinta(m){
 if(!m||!allowed(m.category_id,'view'))return toast('Non autorizzato');
 distintaMatch=m;
 const host=$('#historydetail');if(!host)return;
 host.innerHTML=distintaForm(m);host.scrollIntoView({behavior:'smooth'});
 $('#close-distinta').onclick=()=>{distintaMatch=null;host.innerHTML=''};
 $('#create-distinta').onclick=()=>generateDistinta(m);
}
async function generateDistinta(m){
 const btn=$('#create-distinta');if(btn)btn.disabled=true;
 try{
 const {PDFDocument,StandardFonts,rgb}=await import('https://esm.sh/pdf-lib@1.17.1');
 const response=await fetch('./distinta-template.pdf',{cache:'no-store'});
 if(!response.ok)throw Error('Carica distinta-template.pdf nella stessa cartella di app.js su GitHub');
 const pdf=await PDFDocument.load(await response.arrayBuffer());const page=pdf.getPages()[0];
 const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const W=page.getWidth(),H=page.getHeight();
 const clean=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,' ').trim();
 // Coordinate REALI A4 del modello (595.32 x 841.92), non coordinate dello screenshot.
 const sx=W/595.32,sy=H/841.92;
 const write=(v,x,top,size=8,max=100,heavy=false)=>{
   let t=clean(v);if(!t)return;
   const ft=heavy?bold:font,fs=size*sx;
   while(t.length&&ft.widthOfTextAtSize(t,fs)>max*sx)t=t.slice(0,-1);
   page.drawText(t,{x:x*sx,y:H-top*sy,size:fs,font:ft,color:rgb(0,0,0)});
 };
 const value=k=>val('df-'+k);
 // Il titolo libero viene inserito nello spazio già previsto, senza coprire la tabella.
 if(value('heading')){
   page.drawRectangle({x:34*sx,y:H-148*sy,width:527*sx,height:16*sy,color:rgb(1,1,1)});
   write('Distinta Giocatori partecipanti alla gara: '+value('heading'),36,144,8.5,520,true);
 }
 // Riga campionato: testo DOPO le etichette stampate.
 write(value('competition'),86,172,7,74);
 write(value('place'),231,172,7,132);
 write(fmtItalian(value('date')),389,172,7,78);
 write(value('time'),514,172,7,49);
 const ids=m.player_ids||[];
 if(ids.length>20)throw Error('Il modello contiene 20 righe: riduci i convocati prima di esportare');
 ids.forEach((id,i)=>{
   const p=players.find(x=>x.id===id);if(!p)return;
   const d=detailOf(id);
   // 20 righe, centrate verticalmente tra le linee della tabella.
   const top=235.5+i*19.8;
   write(p.jersey_number??'',35,top,8,31,true);
   const parts=(p.birth_date||'').split('-');
   if(parts.length===3){write(parts[2],77,top,8,20);write(parts[1],106,top,8,20);write(parts[0],132,top,8,26)}
   write((p.last_name||'')+' '+(p.first_name||''),164,top,8,145);
   write(d.team_role==='captain'?'CAP':d.team_role==='vice'?'V.CAP':'',315,top,7,31,true);
   write(d.figc_number||'',365,top,7,57);
   if(d.identity_number){write('C.I.',431,top,7,27);write(d.identity_number,465,top,7,95)}
 });
 // Nomi staff dentro la colonna centrale; documenti nella colonna a destra.
 const staff=[['assistant',641],['accompanying',660],['referee_officer',679],['coach',699],['doctor',720],['masseur',741]];
 for(const [key,top] of staff){
   write(value(key),158,top,8,201);
   write(value(key+'_doc'),486,top,7,75);
 }
 const bytes=await pdf.save();const blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='Distinta_Volla_United_'+(m.match_date||'gara')+'.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 toast('Distinta PDF generata');
 }catch(e){console.error(e);toast(e.message);alert('Impossibile generare la distinta: '+e.message)}finally{if(btn&&btn.isConnected)btn.disabled=false}
}
function bind(){document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page;editing=null;draft=null;selected=[];render()});document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>act(b.dataset.action,b.dataset.id));$('#category')?.addEventListener('change',e=>{currentCat=e.target.value;selected=[];draft=null;render()});document.querySelectorAll('[data-player]').forEach(el=>el.onchange=()=>{selected=[...document.querySelectorAll('[data-player]:checked')].map(x=>x.dataset.player);$('#count').textContent=selected.length});if(page==='attendance')bindAttendance();if($('#playerformreal'))bindPlayer();if($('#matchform'))bindMatchText();if($('#matchform'))$('#matchform').onsubmit=async e=>{e.preventDefault();try{let m=getDraft();if(!m.opponent||!m.match_date)throw Error('Inserisci data e avversario');const ids=m.player_ids;delete m.player_ids;if(!editing)m.created_by=me.id;let result=editing?await sb.from('matches').update(m).eq('id',editing).select('id').single():await sb.from('matches').insert(m).select('id').single();if(result.error)throw result.error;rememberOpponent(m.opponent);let opponentSaveError=null;try{await saveOpponentToSupabase(m.opponent)}catch(e){opponentSaveError=e.message}const matchId=result.data.id;const del=await sb.from('match_players').delete().eq('match_id',matchId);if(del.error)throw del.error;if(ids.length){const ins=await sb.from('match_players').insert(ids.map((player_id,i)=>({match_id:matchId,player_id,sort_order:i})));if(ins.error)throw ins.error;}await load();toast(opponentSaveError||'Convocazione salvata');page='history';editing=null;draft=null;selected=[];render()}catch(err){toast(err.message)}};if($('#catform'))$('#catform').onsubmit=async e=>{e.preventDefault();try{await save('categories',{name:val('catname')});toast('Categoria aggiunta')}catch(err){toast(err.message)}};if($('#userform'))$('#userform').onsubmit=async e=>{e.preventDefault();const button=$('#userform button[type=submit], #userform button.btn');button.disabled=true;try{const assignments=cats.filter(c=>document.querySelector(`[data-newcat="${c.id}"]`)?.checked||document.querySelector(`[data-newcall="${c.id}"]`)?.checked).map(c=>({category_id:c.id,can_call_up:!!document.querySelector(`[data-newcall="${c.id}"]`)?.checked}));let r=await adminCall({action:'create',username:val('newuser'),full_name:val('newname')});if(!r.temporary_password||!r.user_id)throw Error('Account creato, ma risposta incompleta: non riprovare la creazione. Usa Reset password.');$('#credential').innerHTML=`<div class="item"><strong>Credenziali da consegnare privatamente</strong><p>Utente: ${esc(r.username)}</p><p>Password temporanea: <b>${esc(r.temporary_password)}</b></p><p>Consegna subito la password al mister: non sarà mostrata nuovamente.</p></div>`;if(assignments.length){try{await adminCall({action:'set-categories',user_id:r.user_id,assignments})}catch(err){toast('Account creato, ma categorie non assegnate: '+err.message)}}users=await query('profiles');access=await query('coach_categories');toast('Account creato. Conserva la password temporanea.')}catch(err){toast(err.message)}finally{button.disabled=false}};document.querySelectorAll('[data-access]').forEach(x=>x.onchange=async()=>{const [user_id,category_id,kind]=x.dataset.access.split('|');if(users.find(u=>u.id===user_id)?.role!=='coach'){x.checked=!x.checked;return toast('I permessi admin non si modificano da questa schermata')}if(kind==='convocate'&&x.checked){const view=document.querySelector(`[data-access="${user_id}|${category_id}|view"]`);if(view)view.checked=true}if(kind==='view'&&!x.checked){const call=document.querySelector(`[data-access="${user_id}|${category_id}|convocate"]`);if(call)call.checked=false}const group=[...document.querySelectorAll('[data-access]')].filter(el=>el.dataset.access.startsWith(user_id+'|'));const assignments=cats.filter(c=>{const view=group.find(el=>el.dataset.access===`${user_id}|${c.id}|view`);const call=group.find(el=>el.dataset.access===`${user_id}|${c.id}|convocate`);return view?.checked||call?.checked}).map(c=>({category_id:c.id,can_call_up:!!group.find(el=>el.dataset.access===`${user_id}|${c.id}|convocate`)?.checked}));try{await adminCall({action:'set-categories',user_id,assignments});access=await query('coach_categories');render();toast('Permessi aggiornati')}catch(err){toast(err.message);x.checked=!x.checked}})}
function bindPlayer(){ $('#playerformreal').onsubmit=async e=>{e.preventDefault();const btn=$('#playerformreal button[type="submit"],#playerformreal button.btn');if(btn)btn.disabled=true;try{
 if(!val('firstname')||!val('surname'))throw Error('Nome e cognome obbligatori');
 const role=val('teamrole')||'none';const current=window._editPlayer;
 const conflict=playerDetails.find(d=>d.player_id!==current&&d.team_role===role&&players.some(p=>p.id===d.player_id&&p.category_id===currentCat));
 if(role!=='none'&&conflict)throw Error(`Esiste già un ${role==='captain'?'capitano':'vicecapitano'} in questa categoria: modificalo prima.`);
 const obj={category_id:currentCat,first_name:val('firstname'),last_name:val('surname'),birth_date:val('birthday')||null,jersey_number:val('shirt')?Number(val('shirt')):null,primary_role:val('role'),secondary_role:val('role2')||null};
 const q=current?sb.from('players').update(obj).eq('id',current):sb.from('players').insert(obj);
 const r=await q.select('id').single();if(r.error)throw r.error;
 const d=await sb.from('player_details').upsert({player_id:r.data.id,category_id:currentCat,team_role:role,identity_number:val('identitynumber')||null,figc_number:val('figcnumber')||null},{onConflict:'player_id'});
 if(d.error)throw Error('Calciatore salvato, ma dettagli non salvati: '+d.error.message);
 window._editPlayer=null;await load();toast('Calciatore e documenti salvati');
 }catch(err){toast(err.message)}finally{if(btn&&btn.isConnected)btn.disabled=false}}}

async function act(action,id){try{if(action==='logout'){await sb.auth.signOut();me=null;page='home';editing=null;draft=null;selected=[];currentCat='';login();return}if(action==='new-player'||action==='edit-player'){let p=players.find(p=>p.id===id);window._editPlayer=p?.id||null;$('#playerform').innerHTML=playerForm(p);bindPlayer();$('#playerform').scrollIntoView({behavior:'smooth'});$('#playerform [data-action="close-player"]').onclick=()=>$('#playerform').innerHTML='';return}if(action==='close-player'){$('#playerform').innerHTML='';return}if(action==='delete-player'){if(!confirm('Eliminare questo calciatore?'))return;const {error}=await sb.from('players').delete().eq('id',id);if(error)throw error;await load();return}if(action==='preview'){preview(getDraft(),'#previewarea');return}if(action==='view-match'){let m=matches.find(m=>m.id===id);preview(m,'#historydetail');$('#historydetail').insertAdjacentHTML('beforeend',`<div class="actions"><button class="btn" id="open-distinta">📄 Genera Distinta</button><button class="btn alt" id="editmatch">Modifica</button><button class="btn alt" id="deletematch">Elimina</button></div>`);$('#open-distinta').onclick=()=>openDistinta(m);$('#editmatch').onclick=()=>{if(!allowed(m.category_id,'convocate')&&me.role!=='admin')return toast('Non autorizzato a modificare');currentCat=m.category_id;draft=m;selected=m.player_ids||[];editing=m.id;page='matches';render()};$('#deletematch').onclick=async()=>{if(!allowed(m.category_id,'convocate')&&me.role!=='admin')return toast('Non autorizzato');if(!confirm('Eliminare la convocazione?'))return;const {error}=await sb.from('matches').delete().eq('id',m.id);if(error)throw error;await load()};return}if(action==='copy'){await copyMessage(window._previewText);return}if(action==='whatsapp'){shareWhatsApp(window._previewText);return}if(action==='reset-pass'){if(!confirm('Generare una nuova password temporanea?'))return;let r=await adminCall({action:'reset',user_id:id});if(!r.temporary_password)throw Error('Reset eseguito ma password non ricevuta: verifica la funzione Supabase');alert('Nuova password temporanea (copiala ora): '+r.temporary_password);return}}catch(err){toast(err.message)}}
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(console.warn);
if(sb){sb.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){me=null;page='home';editing=null;draft=null;selected=[];currentCat='';login()}});load()}else login();

// Quando l'utente lascia la PWA e torna, riparte dalla Home senza disconnetterlo.
let wasBackgrounded=false;
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){wasBackgrounded=true;return}
  if(document.visibilityState==='visible'&&wasBackgrounded){
    wasBackgrounded=false;page='home';editing=null;draft=null;selected=[];
    if(me&&!me.must_change_password)render();
  }
});
window.addEventListener('pageshow',e=>{
  if(e.persisted){page='home';editing=null;draft=null;selected=[];if(me&&!me.must_change_password)render()}
});
