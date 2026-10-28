import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const $=s=>document.querySelector(s), app=$('#app'), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const configured=SUPABASE_URL.startsWith('https://')&&SUPABASE_ANON_KEY!=='INSERISCI_ANON_KEY';
const sb=configured?createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null;
let me=null,access=[],page='home',cats=[],players=[],matches=[],users=[],currentCat='',editing=null,selected=[],draft=null;
let lastParentCredentials=null;
let matchScorers=[];

// Web Push: la chiave privata resta esclusivamente nei Secrets di Supabase.
const VU_VAPID_PUBLIC_KEY='BDEBTIz1Y5JOw4sv_XCTIz15de3yXzV8u7h92j47jktL2iBK_qM_b11fHqCZ3P8FO8zjBm9Jzg2i_y0aw8Na14I';
function vuDecodeVapid(s){const pad='='.repeat((4-s.length%4)%4);const raw=atob((s+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
let vuPushActive=false;
async function vuCheckPush(){
 vuPushActive=false;
 if(me?.role!=='parent'||!sb||!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)||Notification.permission!=='granted')return;
 try{
  const reg=await navigator.serviceWorker.ready;
  const sub=await reg.pushManager.getSubscription();
  if(!sub)return;
  const {data,error}=await sb.from('push_subscriptions').select('id').eq('user_id',me.id).eq('endpoint',sub.endpoint).limit(1);
  if(error)throw error;
  vuPushActive=!!data?.length;
 }catch(e){console.warn('Verifica iscrizione push:',e)}
}
async function vuEnablePush(){
 const button=document.querySelector('#vu-enable-push');if(button)button.disabled=true;
 try{
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw Error('Notifiche push non supportate su questo dispositivo. Su iPhone installa la PWA nella schermata Home.');
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw Error('Permesso notifiche non concesso. Controlla le impostazioni del dispositivo.');
  const registration=await navigator.serviceWorker.ready;
  const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vuDecodeVapid(VU_VAPID_PUBLIC_KEY)});
  const json=subscription.toJSON();
  const {error}=await sb.from('push_subscriptions').upsert({user_id:me.id,endpoint:json.endpoint,p256dh:json.keys.p256dh,auth_key:json.keys.auth,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
  if(error)throw error;
  vuPushActive=true;
  toast('🔔 Notifiche push attivate su questo dispositivo');
  render();
 }catch(err){console.error('Web Push:',err);toast(err.message||'Impossibile attivare le notifiche')}finally{if(button?.isConnected)button.disabled=false}
}
const vuPushActivation=()=>vuPushActive?'':`<section class="panel"><h3>🔔 Avvisi sul telefono</h3><p class="muted">Ricevi notifiche quando tuo figlio viene convocato e un promemoria un’ora prima della partita. Su iPhone apri la PWA dalla schermata Home.</p><button type="button" class="btn" id="vu-enable-push">🔔 Attiva notifiche</button></section>`;
function vuRequestedMatch(){return new URLSearchParams(location.search).get('vu_match')}
function vuRequestedNotification(){return new URLSearchParams(location.search).get('notification')}
function vuClearPushUrl(){const u=new URL(location.href);u.searchParams.delete('notification');u.searchParams.delete('vu_match');u.searchParams.delete('notifications');history.replaceState(null,'',u.pathname+u.search+u.hash)}
async function vuOpenRequestedMatch(){
 if(me?.role!=='parent')return;
 const noticeId=vuRequestedNotification(),matchId=vuRequestedMatch(),openInbox=new URLSearchParams(location.search).has('notifications');
 if(!noticeId&&!matchId&&!openInbox)return;
 page='notifications';render();
 if(noticeId){
   const n=vuNotifications.find(x=>x.id===noticeId);
   if(n)await vuOpenNotification(n.id);
   else toast('Notifica non disponibile: apri la campanella per controllare gli avvisi.');
 }else if(matchId){
   const n=vuNotifications.find(x=>x.match_id===matchId);
   if(n)await vuOpenNotification(n.id);
   else{const m=matches.find(x=>x.id===matchId);if(m&&m.player_ids?.some(pid=>players.some(p=>p.id===pid)))vuShowNotificationMatch(m);}
 }
 vuClearPushUrl();
}
function vuShowNotificationMatch(m){
 const host=$('#notification-match-detail');if(!host||!m)return;
 const authorized=m.player_ids?.some(pid=>players.some(p=>p.id===pid));if(!authorized)return;
 host.innerHTML=m.status==='completed'?matchDetail(m):`<section class="panel"><h3>⚽ ${esc(m.opponent)}</h3><p>${esc(dateIt(m.match_date))} · ${esc(m.field_name||'')} · Ore ${esc((m.kick_off_time||'').slice(0,5))}</p><p>${esc(m.notice||'')}</p></section>`;
 host.scrollIntoView({behavior:'smooth',block:'start'});
}

let vuNotifications=[];
let vuNotificationError='';
let profileSearch='',profilePlayerId='';
let playerDetails=[],distintaMatch=null,playerPhotos=[],photoUrls={},parentChildIds=[],activeChild='',adminParentChildIds=[];
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
  const toggleTournament=()=>{const t=val('kind')==='TORNEO';const el=$('#tournamentname');if(el){el.closest('.field').style.display=t?'':'none';el.required=t}const opp=$('#opponent');if(opp)opp.required=!t};$('#kind')?.addEventListener('change',toggleTournament);toggleTournament();
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

const permitted=()=>me?.role==='admin'?cats.map(c=>c.id):me?.role==='parent'?cats.filter(c=>players.some(p=>p.category_id===c.id)).map(c=>c.id):access.map(a=>a.category_id);
const convocable=()=>me?.role==='admin'?cats.map(c=>c.id):access.filter(a=>a.can_call_up).map(a=>a.category_id);
const allowed=(cat,action='view')=>(me?.role==='admin')||access.some(a=>a.category_id===cat&&(action==='view'||a.can_call_up));
const selectedCategory=()=>cats.find(c=>c.id===currentCat);
const categoryOptions=(ids=permitted())=>cats.filter(c=>ids.includes(c.id)).map(c=>`<option value="${esc(c.id)}" ${currentCat===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
const vuUnread=()=>vuNotifications.filter(n=>!n.read_at).length;
const vuBell=()=>me?.role==='parent'?`<button type="button" class="vu-bell" data-action="open-notifications" aria-label="Notifiche, ${vuUnread()} non lette" title="Notifiche">🔔${vuUnread()?`<span class="vu-bell-count">${vuUnread()>99?'99+':vuUnread()}</span>`:''}</button>`:'';
async function vuLoadNotifications(){
 vuNotifications=[];vuNotificationError='';
 if(me?.role!=='parent')return;
 const {data,error}=await sb.from('notifications').select('id,title,body,match_id,created_at,read_at').eq('recipient_id',me.id).order('created_at',{ascending:false}).limit(100);
 if(error){vuNotificationError='Notifiche non disponibili: verifica lo script SQL su Supabase.';console.warn('Notifiche:',error);return}
 vuNotifications=data||[];
}
function vuNotificationsPage(){
 return `${vuPushActivation()}<section class="panel"><h2>🔔 Notifiche</h2>${vuNotificationError?`<p class="muted">${esc(vuNotificationError)}</p>`:''}<div class="actions"><button class="btn alt sm" type="button" data-action="read-all-notifications">Segna tutte come lette</button></div>${vuNotifications.map(n=>`<button type="button" class="vu-notification ${n.read_at?'':'vu-notification-new'}" data-notification="${esc(n.id)}"><strong>${esc(n.title)}</strong><span>${esc(n.body||'')}</span><small>${esc(new Date(n.created_at).toLocaleString('it-IT'))}${n.read_at?'':' · Da leggere'}</small></button>`).join('')||'<p class="muted">Non hai notifiche.</p>'}</section><div id="notification-match-detail"></div>`;
}
async function vuOpenNotification(id){
 const n=vuNotifications.find(x=>x.id===id);if(!n)return;
 if(!n.read_at){const {error}=await sb.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('recipient_id',me.id);if(error){toast(error.message);return}n.read_at=new Date().toISOString()}
 page='notifications';render();
 if(n.match_id)vuShowNotificationMatch(matches.find(x=>x.id===n.match_id));
}

async function vuReadAllNotifications(){const ids=vuNotifications.filter(x=>!x.read_at).map(x=>x.id);if(!ids.length)return;const {error}=await sb.from('notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',me.id).in('id',ids);if(error)return toast(error.message);await vuLoadNotifications();render()}
const nav=()=>{const parent=me?.role==='parent';const items=parent?[['family','🏠','Area famiglie']]:[['home','🏠','Home'],['players','⚽','Calciatori'],['matches','📋','Convocazioni'],['callhistory','🗂','Storico convocazioni'],['history','🏆','Storico partite'],['attendance','✅','Presenze'],['profile','🪪','Profilo calciatore'],...(me?.role==='admin'?[['admin','⚙️','Setup · Account e categorie']]:[])];return `<header class="top vu-header"><button type="button" class="vu-brand" data-page="${parent?'family':'home'}" aria-label="Torna alla Home"><img src="logo.png" alt="Volla United"><span><strong>VOLLA UNITED</strong><small>${parent?'AREA FAMIGLIE':'TEAM MANAGEMENT'}</small></span></button>${vuBell()}<details class="vu-account"><summary aria-label="Apri menu di ${esc(me?.full_name||'Utente')}">${esc(me?.full_name||'Mister')} <span>⌄</span></summary><nav class="vu-account-menu" aria-label="Menu principale"><div class="vu-account-role">${parent?'Genitore':me?.role==='admin'?'Amministratore':'Mister'}</div>${items.map(([p,i,t])=>`<button type="button" class="vu-account-link ${page===p?'active':''}" data-page="${p}"><span>${i}</span><span>${t}</span></button>`).join('')}<div class="vu-account-separator"></div><button type="button" class="vu-logout" data-action="logout">🚪 Esci dall’account</button></nav></details></header>`};
const vuStyles=`<style id="vu-nav-style">.vu-header{display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative;z-index:100}.vu-brand{display:flex;align-items:center;gap:10px;border:0;background:none;color:inherit;text-align:left;padding:0;cursor:pointer;min-width:0}.vu-brand img{width:52px;height:52px;object-fit:contain}.vu-brand span{display:flex;flex-direction:column;gap:3px}.vu-brand strong{font-size:16px;letter-spacing:.6px}.vu-brand small{font-size:10px;opacity:.7}.vu-bell{position:relative;flex:none;border:1px solid #7d3646;background:#25171e;color:#fff;border-radius:12px;padding:10px;font-size:20px;cursor:pointer}.vu-bell-count{position:absolute;right:-6px;top:-8px;border-radius:12px;background:#dc244e;color:#fff;font-size:10px;font-weight:800;min-width:18px;padding:3px}.vu-notification{display:flex;flex-direction:column;gap:7px;width:100%;text-align:left;margin:10px 0;padding:14px;background:#24151d;border:1px solid #54313e;border-radius:12px;color:#fff}.vu-notification-new{border-color:#e44b70;background:#351a29}.vu-notification span{font-size:13px}.vu-notification small{opacity:.65}.vu-account{position:relative;min-width:0;max-width:55%}.vu-account summary{cursor:pointer;list-style:none;border:1px solid #7d3646;border-radius:12px;padding:12px;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#25171e}.vu-account summary::-webkit-details-marker{display:none}.vu-account[open] summary{border-color:#cb3558;background:#431827}.vu-account-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:3000;background:#24151d;border:1px solid #7d3646;border-radius:15px;width:min(310px,calc(100vw - 32px));padding:10px;box-shadow:0 16px 40px #000b;max-height:min(75vh,650px);overflow-y:auto;-webkit-overflow-scrolling:touch}.vu-account-role{font-size:12px;opacity:.65;padding:9px 12px 12px}.vu-account-menu button{display:flex;align-items:center;gap:12px;width:100%;padding:12px;border:0;border-radius:9px;background:transparent;color:#fff;text-align:left;font-size:14px;cursor:pointer}.vu-account-menu button.active{background:#9e1d3a;font-weight:700}.vu-account-menu button:hover{background:#673043}.vu-account-menu button span:first-child{width:24px;text-align:center}.vu-account-separator{height:1px;background:#693343;margin:8px 3px}.vu-account-menu .vu-logout{color:#ffbeca}@media(max-width:650px){.shell{padding-bottom:18px}.vu-header{padding:8px 0}.vu-brand img{width:43px;height:43px}.vu-brand strong{font-size:13px}.vu-brand small{font-size:9px}.vu-account summary{font-size:12px;padding:11px}.vu-account-menu{max-height:75dvh}}</style>`;

function login(force=false){app.innerHTML=`<main class="login"><div class="loginbox"><img src="logo.png" alt="Volla United"><h1>VOLLA UNITED</h1><p class="sub">${force?'PRIMO ACCESSO · CAMBIO PASSWORD':'ACCESSO MISTER, GENITORI E ADMIN'}</p><form id="loginform" class="stack">${force?`<p class="muted">Devi scegliere una password personale prima di continuare.</p>${field('newpass','Nuova password','','password')}${field('confirm','Conferma password','','password')}`:`${field('username','Nome utente',rememberedUsername())}${field('password','Password','','password')}<label style="display:flex;align-items:center;gap:10px;font-size:15px;cursor:pointer"><input type="checkbox" id="remember-login" style="width:20px;height:20px;flex:none" ${rememberedUsername()?'checked':''}> Ricorda nome utente</label>`}<button class="btn">${force?'Salva password e accedi':'Accedi →'}</button></form><div id="autherror" class="error"></div>${!configured?'<p class="error">Configurazione Supabase mancante. Consulta README.md.</p>':''}</div></main>`;
$('#loginform').onsubmit=async e=>{e.preventDefault();$('#autherror').textContent='';try{if(!sb)throw Error('Collega Supabase per attivare il login');if(force){if(val('newpass').length<8)throw Error('Password: almeno 8 caratteri');if(val('newpass')!==val('confirm'))throw Error('Le password non coincidono');await adminCall({action:'change-password',password:val('newpass')});page='home';editing=null;draft=null;selected=[];await load();}else{const uname=val('username').toLowerCase();const email=uname.includes('@')?uname:uname+'@users.volla.invalid';const {error}=await sb.auth.signInWithPassword({email,password:val('password')});if(error)throw Error('Credenziali non valide');try{if($('#remember-login')?.checked)localStorage.setItem(rememberedUserKey,uname);else localStorage.removeItem(rememberedUserKey)}catch{}page='home';editing=null;draft=null;selected=[];await load();}}catch(err){$('#autherror').textContent=err.message}}}
async function query(table,cols='*'){const {data,error}=await sb.from(table).select(cols);if(error)throw error;return data||[]}
async function load(){try{const {data:{user}}=await sb.auth.getUser();if(!user){me=null;login();return}const {data,error}=await sb.from('profiles').select('*').eq('id',user.id).single();if(error)throw error;me=data;if(!me.active){await sb.auth.signOut();me=null;login();toast('Account disattivato: contatta l’amministratore');return}if(me.must_change_password){page='home';login(true);return}cats=await query('categories');access=me.role==='parent'?[]:await query('coach_categories');players=await query('players');matches=await query('matches');matchScorers=await query('match_scorers');if(me.role!=='parent')await loadOpponents();const mp=await query('match_players');matches.forEach(m=>{const rows=mp.filter(x=>x.match_id===m.id).sort((a,b)=>a.sort_order-b.sort_order);m.player_ids=rows.map(x=>x.player_id);m.played_ids=rows.filter(x=>x.played).map(x=>x.player_id)});users=me.role==='admin'?await query('profiles'):[];if(me.role!=='parent')await loadPlayerDetails();else playerDetails=[];await loadAttendance();await loadFamilyData();if(me.role==='parent')await loadParentMatchDetails();await vuLoadNotifications();await vuCheckPush();if(!permitted().includes(currentCat))currentCat=permitted()[0]||'';if(me.role==='parent'){if(page!=='notifications')page='family';if(!players.some(p=>p.id===activeChild))activeChild=players[0]?.id||''}render();await vuOpenRequestedMatch()}catch(e){toast(e.message);console.error(e)}}
function render(){document.getElementById('opponent-suggestions')?.remove();app.innerHTML=`<main class="shell">${vuStyles}${nav()}<div id="content"></div><footer class="foot">#weL⚽ve VOLLAUNITED 🔥</footer></main>`;let c=$('#content');if(me?.role==='parent'){if(page!=='notifications')page='family';c.innerHTML=page==='notifications'?vuNotificationsPage():familyPage();}else if(page==='home')c.innerHTML=home();if(page==='players')c.innerHTML=roster();if(page==='matches')c.innerHTML=matchEditor();if(page==='history')c.innerHTML=history();if(page==='callhistory')c.innerHTML=callHistory();if(page==='attendance')c.innerHTML=attendancePage();if(page==='admin')c.innerHTML=admin();if(page==='profile')c.innerHTML=profilePage();bind()}
const home=()=>`<section class="hero"><div><div class="sub">BENVENUTO NEL CLUB</div><h2>Ciao, ${esc(me.full_name)}! 🔥</h2><p>${me.role==='admin'?'Gestisci tutte le categorie, convocazioni e funzioni della società.':'La tua squadra, le tue convocazioni.'}</p></div></section><div class="grid">${[['players','👥','Calciatori','Gestisci la rosa'],['matches','📋','Convocazioni','Prepara la partita'],['callhistory','🗂','Storico convocazioni','Convocazioni salvate'],['history','🏆','Storico partite','Risultati e marcatori'],['attendance','✅','Presenze','Allenamenti e statistiche'],['profile','🪪','Profilo calciatore','Visualizza la scheda come un genitore'],[me.role==='admin'?'admin':'players','🛡️',me.role==='admin'?'Amministrazione':'Categorie','Gestione società']].map(([p,i,t,s])=>`<button class="tile" data-page="${p}"><span class="emoji">${i}</span><b>${t}</b><span>${s}</span></button>`).join('')}</div><section class="panel"><h3>Le tue categorie</h3>${cats.filter(c=>permitted().includes(c.id)).map(c=>`<div class="item"><strong>${esc(c.name)}</strong><small>${allowed(c.id,'convocate')?'✓ Puoi convocare':'Solo visualizzazione'} · ${players.filter(p=>p.category_id===c.id).length} calciatori</small></div>`).join('')||'<p class="empty">Nessuna categoria assegnata</p>'}</section>`;
const catSelector=(ids=permitted())=>`<div class="field"><label>Categoria</label><select id="category">${categoryOptions(ids)}</select></div>`;
const detailOf=id=>playerDetails.find(d=>d.player_id===id)||{};
async function loadPlayerDetails(){const r=await sb.from('player_details').select('*');if(r.error){console.warn('Dettagli giocatori:',r.error);playerDetails=[];toast('Configura la tabella player_details su Supabase');return}playerDetails=r.data||[]}
const roster=()=>`<div class="row sectionhead"><h2>⚽ Calciatori</h2><button class="btn sm" data-action="new-player">+ Nuovo</button></div>${catSelector()}<div id="playerform"></div><section class="panel"><div class="actions"><button type="button" class="btn" data-action="export-roster">📄 Scarica lista completa PDF</button></div><div class="row" style="align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><h3 style="margin:0">Rosa ${esc(selectedCategory()?.name||'')}</h3><strong style="font-size:14px;white-space:nowrap">Iscritti ${players.filter(p=>p.category_id===currentCat).length} Calciatori</strong></div>${players.filter(p=>p.category_id===currentCat).sort(sortPlayers).map(p=>`<div class="item row"><div><strong>${esc(p.last_name)} ${esc(p.first_name)} ${p.jersey_number?'#'+esc(p.jersey_number):''}</strong><small>${esc(p.primary_role||'Ruolo non indicato')}${p.secondary_role?' · '+esc(p.secondary_role):''}${detailOf(p.id).team_role==='captain'?' · CAPITANO':detailOf(p.id).team_role==='vice'?' · VICECAPITANO':''}</small></div><div class="actions"><button class="btn alt sm" data-action="edit-player" data-id="${p.id}">Modifica</button><button class="btn alt sm" data-action="delete-player" data-id="${p.id}">✕</button></div></div>`).join('')||'<p class="empty">Nessun calciatore presente</p>'}</section>`;
const roles=['Portiere','Difensore','Centrocampista','Attaccante','Jolly'];
// Ordine fisso per ruolo, poi cognome e nome (italiano).
const roleOrder=['Portiere','Difensore','Centrocampista','Attaccante'];
const sortPlayers=(a,b)=>{
  const rank=p=>{const n=roleOrder.indexOf(p.primary_role);return n<0?roleOrder.length:n};
  return rank(a)-rank(b) || (a.last_name||'').localeCompare(b.last_name||'','it',{sensitivity:'base'}) || (a.first_name||'').localeCompare(b.first_name||'','it',{sensitivity:'base'});
};

const playerForm=p=>`<form id="playerformreal" class="panel"><h3>${p?'Modifica':'Nuovo'} calciatore</h3><div class="fields">${field('firstname','Nome',p?.first_name)}${field('surname','Cognome',p?.last_name)}${field('birthday','Data di nascita',p?.birth_date,'date')}${field('shirt','Numero maglia',p?.jersey_number,'number')}<div class="field"><label>Ruolo principale</label><select id="role">${roles.map(r=>`<option ${p?.primary_role===r?'selected':''}>${r}</option>`).join('')}</select></div><div class="field"><label>Ruolo secondario</label><select id="role2"><option value="">Nessuno</option>${roles.map(r=>`<option ${p?.secondary_role===r?'selected':''}>${r}</option>`).join('')}</select></div><div class="field"><label>Qualifica</label><select id="teamrole">${[['none','Calciatore'],['captain','Capitano (CAP)'],['vice','Vicecapitano (V.CAP)']].map(([v,t])=>`<option value="${v}" ${((p&&detailOf(p.id).team_role)||'none')===v?'selected':''}>${t}</option>`).join('')}</select></div>${field('identitynumber','Numero carta identità',p?detailOf(p.id).identity_number:'')}${field('figcnumber','Matricola FIGC',p?detailOf(p.id).figc_number:'')}${p?`<div class="field"><label>Foto del calciatore</label>${photoOf(p.id)?`<img src="${esc(photoOf(p.id))}" alt="Foto profilo" style="max-height:150px;max-width:100%;object-fit:contain">`:''}<input type="file" id="playerphoto" accept="image/jpeg,image/png,image/webp"><p class="muted">La foto caricata sarà visualizzata nel profilo del bambino e nell’area genitori.</p></div>`:''}</div><div class="actions"><button class="btn">Salva calciatore</button><button type="button" class="btn alt" data-action="close-player">Annulla</button></div></form>`;
const matchEditor=()=>{let ids=convocable();if(editing&&me.role==='admin'&&!ids.includes(currentCat))ids=[...ids,currentCat];if(!ids.includes(currentCat))currentCat=ids[0]||'';if(!ids.length)return'<h2>📋 Convocazioni</h2><div class="panel empty">Non sei autorizzato a creare convocazioni per nessuna categoria.</div>';const ps=players.filter(p=>p.category_id===currentCat).sort(sortPlayers);return`<h2 class="sectionhead">📋 ${editing?'Modifica':'Nuova'} convocazione</h2>${catSelector(ids)}<div id="historydetail"></div><form id="matchform" class="panel"><div class="fields"><div class="field"><label>Tipologia gara</label><select id="kind">${['AMICHEVOLE','TORNEO FIGC','NEXT GEN','CAMPIONATO','TORNEO','TRIANGOLARE','ALTRO'].map(x=>`<option ${draft?.match_type===x||((draft?.match_type&&!['AMICHEVOLE','TORNEO FIGC','NEXT GEN','CAMPIONATO','TORNEO','TRIANGOLARE'].includes(draft.match_type))&&x==='ALTRO')?'selected':''}>${x}</option>`).join('')}</select></div>${field('customkind','Se ALTRO, specifica',draft?.custom_kind||((draft?.match_type&&!['AMICHEVOLE','TORNEO FIGC','NEXT GEN','CAMPIONATO','TORNEO','TRIANGOLARE'].includes(draft.match_type))?draft.match_type:''))}${field('tournamentname','Nome torneo',draft?.tournament_name||'')}${field('fieldname','Campo da gioco',draft?.field_name||'MADRIGAL')}${field('opponent','Avversario',draft?.opponent).replace('<input id="opponent"','<input id="opponent" autocomplete="off"').replace('</div>','<div id="opponent-suggestions" role="listbox" style="display:none;position:static;width:100%;max-height:180px;overflow-y:auto;border:1px solid #54313e;border-radius:10px;background:#24151d;z-index:100;box-shadow:0 10px 25px #0008"></div></div>')}${field('date','Data',draft?.match_date||new Date().toLocaleDateString('en-CA'),'date')}${field('meet','Ora convocazione',draft?.meeting_time||'17:35','time')}${field('start','Inizio partita',draft?.kick_off_time||'17:50','time')}${field('shirtcolor','Maglia',draft?.jersey_color||'ROSSO-NERA')}${field('shorts','Pantaloncini',draft?.shorts_color||'NERO')}${field('socks','Calzerotti',draft?.socks_color||'NERO')}</div><div class="field" style="margin-top:13px"><label>Avviso ai genitori</label><textarea id="notice">${esc(draft?.notice||'Comunicare tempestivamente ogni tipo di assenza IN PRIVATO.')}</textarea></div><div class="field" style="margin-top:13px"><label>Mister responsabile (nome e cognome)</label><textarea id="coaches">${esc(draft?.coaches_text||me.full_name.toUpperCase())}</textarea></div><h3 class="sectionhead">Seleziona i convocati · <span id="count">${selected.length}</span></h3><div class="stack">${ps.map(p=>`<div class="check"><input type="checkbox" id="p${p.id}" data-player="${p.id}" ${selected.includes(p.id)?'checked':''}><label for="p${p.id}">${esc(p.last_name)} ${esc(p.first_name)} <span class="muted">· ${esc(p.primary_role||'')}</span></label></div>`).join('')||'<p class="empty">Inserisci prima i calciatori della categoria.</p>'}</div><div class="actions"><button class="btn" type="submit">💾 Salva convocazione</button><button class="btn alt" type="button" data-action="preview">👁 Anteprima WhatsApp</button></div></form><div id="previewarea"></div>`};
function getDraft(){return{category_id:currentCat,match_type:upper(val('kind')==='ALTRO'?val('customkind'):val('kind')),tournament_name:val('kind')==='TORNEO'?upper(val('tournamentname')):null,field_name:upper(val('fieldname')),opponent:upper(val('opponent')),match_date:val('date'),meeting_time:val('meet'),kick_off_time:val('start'),jersey_color:upper(val('shirtcolor')),shorts_color:upper(val('shorts')),socks_color:upper(val('socks')),notice:upper(val('notice')),coaches_text:upper(val('coaches')),player_ids:selected}}
const callHistory=()=>`<h2>🗂 Storico convocazioni</h2>${catSelector()}<section class="panel">${matches.filter(m=>m.category_id===currentCat&&m.status!=='completed').sort((a,b)=>b.match_date.localeCompare(a.match_date)).map(m=>`<div class="item"><strong>${esc(isTournament(m)?m.tournament_name||'TORNEO':m.opponent)} · ${esc(dateIt(m.match_date))}</strong><small>${esc(m.match_type||'')} · ${esc(m.field_name||'')} · Mister: ${esc(matchCoachName(m))}</small><div class="actions"><button type="button" class="btn sm" data-action="distinta" data-id="${m.id}">📄 Distinta</button><button type="button" class="btn alt sm" data-action="share-match" data-id="${m.id}">🟢 WhatsApp</button><button type="button" class="btn sm" data-action="result-match" data-id="${m.id}">🏁 Inserisci risultato</button><button type="button" class="btn alt sm" data-action="delete-match" data-id="${m.id}">🗑 Elimina</button></div></div>`).join('')||'<p class="empty">Nessuna convocazione salvata in attesa del risultato.</p>'}</section><div id="historydetail"></div>`;
const history=()=>`<h2>🏟 Storico partite</h2>${catSelector()}<section class="panel">${matches.filter(m=>m.category_id===currentCat&&m.status==='completed').sort((a,b)=>b.match_date.localeCompare(a.match_date)).map(m=>`<div class="item row"><div><strong>${esc(matchLabel(m))}</strong><small>${esc(dateIt(m.match_date))} · ${esc(m.match_type)} · Mister: ${esc(matchCoachName(m))}</small></div><button class="btn alt sm" data-action="view-match" data-id="${m.id}">Apri</button></div>`).join('')||'<p class="empty">Nessuna partita conclusa.</p>'}</section><div id="historydetail"></div>`;
const isTournament=m=>m.match_type==='TORNEO';
const ordinalPlace=n=>n===1?'primo':n===2?'secondo':n===3?'terzo':n===4?'quarto':n===5?'quinto':`${n}°`;
const matchLabel=m=>isTournament(m)?`${m.tournament_name||'TORNEO'}${m.tournament_position?' · '+ordinalPlace(m.tournament_position)+' posto':''}`:`Volla United ${m.goals_for} – ${m.goals_against} ${m.opponent}`;
const matchScorersFor=m=>matchScorers.filter(x=>x.match_id===m.id);
const matchCoachName=m=>String(m?.coaches_text||users.find(u=>u.id===m?.created_by)?.full_name||(m?.created_by===me?.id?me?.full_name:'')||'Non indicato').trim();
function matchDetail(m){return `<section class="panel"><h3>🏟 ${esc(matchLabel(m))}</h3><p>${esc(dateIt(m.match_date))} · ${esc(m.match_type)} · Mister: ${esc(matchCoachName(m))}</p>${isTournament(m)?'':'<h3>⚽ Marcatori</h3>'}${isTournament(m)?'':matchScorersFor(m).map(x=>{const p=players.find(p=>p.id===x.player_id);const display=p?fullName(p):(x.display_name||m.public_players?.find(y=>y.player_id===x.player_id)?.display_name||'Calciatore');return `<div class="item">${esc(display)} · ${x.goals} ${x.goals===1?'gol':'gol'}</div>`}).join('')|| (isTournament(m)?'':'<p class="muted">Nessun marcatore registrato.</p>')}<h3>👥 Convocati</h3>${(m.player_ids||[]).map(id=>{const p=players.find(p=>p.id===id);const display=p?fullName(p):(m.public_players?.find(y=>y.player_id===id)?.display_name||'Calciatore');return `<div class="item row"><span>${esc(display)}</span><small>${m.played_ids?.includes(id)?'✅ Ha giocato':'Assente'}</small></div>`}).join('')}</section>`}
function resultForm(m){const played=m.status==='completed'?(m.played_ids||[]):(m.player_ids||[]);const tournament=isTournament(m);return `<section class="panel"><h3>🏁 ${esc(tournament?m.tournament_name||'TORNEO':m.opponent)}</h3><p class="muted">Tutti i convocati sono considerati giocanti. Spunta soltanto gli assenti.</p>${tournament?`<div class="field"><label>Posizione finale del torneo</label><select id="tournament-position">${Array.from({length:30},(_,i)=>i+1).map(n=>`<option value="${n}" ${m.tournament_position===n?'selected':''}>${n}° posto</option>`).join('')}</select></div>`:`<div class="fields">${field('goals-for','Gol Volla United',m.goals_for??0,'number')}${field('goals-against','Gol avversari',m.goals_against??0,'number')}</div>`}<h3>Assenti ${tournament?'al torneo':'alla partita'}</h3>${(m.player_ids||[]).map(id=>{const p=players.find(p=>p.id===id);const goals=matchScorersFor(m).find(x=>x.player_id===id)?.goals||0;return `<div class="item"><label class="check"><input type="checkbox" data-absent="${id}" ${!played.includes(id)?'checked':''}> Assente · ${esc(p?fullName(p):'Calciatore')}</label>${tournament?'':`<div class="field"><label>Gol segnati</label><input type="number" min="0" step="1" data-goals="${id}" value="${goals}"></div>`}</div>`}).join('')}<div class="actions"><button class="btn" id="save-result">💾 Salva ${tournament?'piazzamento':'risultato'}</button><button class="btn alt" id="cancel-result">Annulla</button></div></section>`}
function openResult(m){const host=$('#historydetail');if(!host)return;host.innerHTML=resultForm(m);host.scrollIntoView({behavior:'smooth'});$('#cancel-result').onclick=()=>host.innerHTML='';$('#save-result').onclick=async()=>{const btn=$('#save-result');btn.disabled=true;try{const absent=[...document.querySelectorAll('[data-absent]:checked')].map(x=>x.dataset.absent);const played=(m.player_ids||[]).filter(id=>!absent.includes(id));let error;if(isTournament(m)){const position=Number(val('tournament-position'));if(!Number.isInteger(position)||position<1)throw Error('Posizione non valida');if(!confirm(`Confermi il ${position}° posto?\nPartecipanti: ${played.length}\nAssenti: ${absent.length}`))return;({error}=await sb.rpc('vu_complete_tournament',{p_match_id:m.id,p_position:position,p_played_ids:played}));}else{const gf=Number(val('goals-for')),ga=Number(val('goals-against'));if(!Number.isInteger(gf)||!Number.isInteger(ga)||gf<0||ga<0)throw Error('Risultato non valido');const scorers=[...document.querySelectorAll('[data-goals]')].map(x=>({player_id:x.dataset.goals,goals:Number(x.value)})).filter(x=>x.goals>0||!Number.isInteger(x.goals));if(scorers.some(x=>!played.includes(x.player_id)||!Number.isInteger(x.goals)))throw Error('Marcatori non validi');if(scorers.reduce((a,x)=>a+x.goals,0)>gf)throw Error('I marcatori superano i gol segnati');if(!confirm(`Confermi il risultato?\nGiocanti: ${played.length}\nAssenti: ${absent.length}`))return;({error}=await sb.rpc('vu_complete_match',{p_match_id:m.id,p_goals_for:gf,p_goals_against:ga,p_played_ids:played,p_scorers:scorers}));}if(error)throw error;await load();page='history';currentCat=m.category_id;render();toast('Salvato nello storico partite')}catch(e){toast(e.message)}finally{if(btn.isConnected)btn.disabled=false}}}

function formatMessage(m){const dt=new Date(m.match_date+'T12:00:00');const date=isNaN(+dt)?m.match_date:dt.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).toUpperCase();const names=(m.player_ids||[]).map(id=>players.find(p=>p.id===id)).filter(Boolean).sort(sortPlayers);return`ⒸⓄⓃⓋⓄⒸⒶⓏⒾⓄⓃⒺ\n\n⚽️ 𝚃𝙸𝙿𝙾𝙻𝙾𝙶𝙸𝙰 𝙶𝙰𝚁𝙰: ${m.match_type}\n🏟 𝙲𝙰𝙼𝙿𝙾 𝙳𝙰 𝙶𝙸𝙾𝙲𝙾: ${m.field_name}\n🗓 𝙳𝙰𝚃A: ${date}\n${isTournament(m)?'🏆 TORNEO: '+m.tournament_name:( '🥅 𝙰𝚅𝚅𝙴𝚁𝚂𝙰𝚁𝙸𝙾: '+m.opponent)}\n⏱ 𝙾𝚛𝚊 𝚌𝚘𝚗𝚟𝚘𝚌𝚊𝚣𝚒𝚘𝚗𝚎: ${(m.meeting_time||'').slice(0,5).replace(':',',')}\n⏱ inizio partita : ${(m.kick_off_time||'').slice(0,5).replace(':',',')}\n🎽 𝙲𝚘𝚖𝚙𝚕𝚎𝚝𝚘 𝚐𝚊𝚛𝚊:\n𝑴𝒂𝒈𝒍𝒊𝒂 𝐆𝐀𝐑𝐀  ${m.jersey_color}\n𝑷𝒂𝒏𝒕𝒂𝒍𝒐𝒏𝒄𝒊𝒏𝒊 ${m.shorts_color}\n𝑪𝒂𝒍𝒛𝒆𝒓𝒐𝒕𝒕𝒊 ${m.socks_color}\n⚠️ 𝐀𝐓𝐓𝐄𝐍𝐙𝐈𝐎𝐍𝐄\n${m.notice}\nℂ𝕆ℕ𝕍𝕆ℂ𝔸𝕋𝕀\n${names.map((p,i)=>`${i+1}. ${p.last_name} ${p.first_name}`).join('\n')}\n🖋 𝙼𝚒𝚜𝚝𝚎𝚛\n${m.coaches_text}\n#𝚠𝚎𝙻⚽️𝚟𝚎 VOLLAUNITED🔥`}
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
    <p class="muted">${sess?'Allenamento già registrato: puoi aggiornare le presenze.':'Nuovo allenamento: tutti presenti; deseleziona soltanto gli assenti.'}</p>
    <div class="stack">${ps.map(p=>`<label class="check" style="display:flex;align-items:center;gap:12px"><input type="checkbox" data-attend="${esc(p.id)}" ${sess?(rows.find(r=>r.player_id===p.id)?.present?'checked':''):'checked'} ${!editable?'disabled':''}><span>${esc(fullName(p))}</span></label>`).join('')||'<p class="empty">Nessun calciatore nella categoria</p>'}</div>
    ${editable?'<div class="actions"><button class="btn" id="save-attendance">💾 Salva presenze</button>'+(sess?'<button class="btn alt" id="delete-attendance-day" type="button">🗑 Elimina questo allenamento</button>':'')+'</div>':''}</section>
    <section class="panel"><h3>Statistiche e PDF</h3><div class="fields">${field('att-from','Dal',from,'date')}${field('att-to','Al',to,'date')}
    <div class="field"><label>Allievo</label><select id="att-player"><option value="">Tutti gli allievi</option>${ps.map(p=>`<option value="${esc(p.id)}" ${attendancePlayer===p.id?'selected':''}>${esc(fullName(p))}</option>`).join('')}</select></div></div>
    <div class="actions"><button class="btn alt sm" data-period="week">Settimana</button><button class="btn alt sm" data-period="month">Mese</button><button class="btn alt sm" data-period="year">Anno</button><button class="btn alt sm" data-period="all">Tutto</button></div>
    <details class="panel" style="margin:12px 0" id="training-session-list"><summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 0"><span><strong>${filtered.length} allenamenti registrati nel periodo</strong><small style="display:block;margin-top:6px">Clicca per visualizzare le date e gestire gli allenamenti.</small></span><span aria-hidden="true" style="font-size:21px">⌄</span></summary><p class="muted">Le assenze si contano solo per le sessioni in cui è stata registrata una presenza o assenza per l'allievo.</p>${filtered.length?`<div class="stack">${filtered.map(t=>`<div class="item row" style="gap:12px;align-items:center;justify-content:space-between"><strong>${esc(dateIt(t.training_date))}</strong>${editable?`<button type="button" class="btn alt sm" data-remove-training="${esc(t.id)}">📦 Archivia</button>`:''}</div>`).join('')}</div>`:'<p class="empty">Nessun allenamento nel periodo selezionato.</p>'}${editable&&filtered.length>1?`<details style="margin-top:12px"><summary style="cursor:pointer">Elimina più allenamenti</summary><div class="stack">${filtered.map(t=>`<label class="check" style="display:flex;align-items:center;gap:10px"><input type="checkbox" data-delete-session="${esc(t.id)}"><span>${esc(dateIt(t.training_date))}</span></label>`).join('')}</div><div class="actions"><button type="button" class="btn alt" id="delete-attendance-selected">🗑 Elimina date selezionate</button></div></details>`:''}</details>
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
  $('#print-attendance')?.addEventListener('click',async e=>{
    const btn=e.currentTarget;btn.disabled=true;
    try{
      const from=val('att-from'),to=val('att-to');
      if(!from||!to||from>to)throw Error('Intervallo date non valido');
      const ps=players.filter(p=>p.category_id===currentCat&&(!attendancePlayer||p.id===attendancePlayer)).sort((a,b)=>fullName(a).localeCompare(fullName(b),'it'));
      const dates=sessions.filter(x=>x.category_id===currentCat&&x.training_date>=from&&x.training_date<=to).sort((a,b)=>a.training_date.localeCompare(b.training_date));
      if(!ps.length)throw Error('Nessun calciatore da esportare');
      const {PDFDocument,StandardFonts,rgb}=await import('https://esm.sh/pdf-lib@1.17.1');
      const pdf=await PDFDocument.create();
      const page=pdf.addPage([595.28,841.89]); // A4 verticale, sempre una pagina
      const W=page.getWidth(),H=page.getHeight();
      const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
      const ink=rgb(.12,.12,.12),red=rgb(.66,.07,.14),light=rgb(.94,.94,.94),white=rgb(1,1,1);
      const clean=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,' ').trim();
      const write=(s,x,y,size=9,font=regular,color=ink)=>page.drawText(clean(s),{x,y,size,font,color});
      const center=(s,y,size=10,font=regular,color=ink)=>write(s,(W-font.widthOfTextAtSize(clean(s),size))/2,y,size,font,color);
      // Logo ufficiale della PWA, caricato dalla stessa cartella di app.js.
      try{
        const response=await fetch('./logo.png',{cache:'no-store'});
        if(response.ok){
          const logo=await pdf.embedPng(await response.arrayBuffer());
          const scale=Math.min(78/logo.width,78/logo.height);
          const lw=logo.width*scale,lh=logo.height*scale;
          page.drawImage(logo,{x:(W-lw)/2,y:H-22-lh,width:lw,height:lh});
        }
      }catch(err){console.warn('Logo PDF non disponibile:',err)}
      center('VOLLA UNITED',H-116,18,bold,red);
      center('REGISTRO PRESENZE ALLENAMENTI',H-133,11,bold);
      center(`Categoria: ${selectedCategory()?.name||''}     Dal ${dateIt(from)} al ${dateIt(to)}`,H-149,9);
      center(`Allenamenti nel periodo: ${dates.length}`,H-163,8);
      const margin=29,tableW=W-margin*2,top=H-184,bottom=55;
      const nameW=166,summaryW=102,available=tableW-nameW-summaryW;
      const dateW=dates.length?available/dates.length:0;
      const widths=[nameW,...dates.map(()=>dateW),34,34,34];
      const rowH=Math.min(24,(top-bottom)/(ps.length+1));
      const fontSize=Math.max(5.5,Math.min(9,rowH*.43));
      const dateFont=Math.max(3,Math.min(7,dateW*.34));
      const fit=(value,width,size,font=regular)=>{
        let text=clean(value);while(text&&font.widthOfTextAtSize(text,size)>width-5)text=text.slice(0,-1);
        return text;
      };
      const cell=(value,x,y,width,fill=false,size=fontSize,font=regular,align='left')=>{
        page.drawRectangle({x,y,width,height:rowH,borderColor:ink,borderWidth:.45,...(fill?{color:light}:{})});
        const text=fit(value,width,size,font);
        const tx=align==='center'?x+(width-font.widthOfTextAtSize(text,size))/2:x+3;
        write(text,tx,y+(rowH-size)/2+1,size,font);
      };
      const att=(p,t)=>{const a=attendance.find(x=>x.session_id===t.id&&x.player_id===p.id);return a?(a.present?'P':'A'):'-'};
      const headers=['CALCIATORE',...dates.map(t=>dateIt(t.training_date).slice(0,5)),'P','A','%'];
      let x=margin;
      headers.forEach((h,i)=>{cell(h,x,top-rowH,widths[i],true,i===0?8:i<=dates.length?dateFont:8,bold,i===0?'left':'center');x+=widths[i]});
      ps.forEach((p,index)=>{
        const results=dates.map(t=>att(p,t));
        const P=results.filter(v=>v==='P').length,A=results.filter(v=>v==='A').length;
        const values=[fullName(p),...results,P,A,P+A?Math.round(P*100/(P+A))+'%':'0%'];
        const y=top-rowH*(index+2);let cx=margin;
        values.forEach((v,i)=>{cell(v,cx,y,widths[i],false,i===0?Math.min(8.5,fontSize):Math.min(8,fontSize),regular,i===0?'left':'center');cx+=widths[i]});
      });
      write('P = Presente     A = Assente     - = Non registrato',margin,32,8);
      write(`Volla United  |  ${dateIt(from)} - ${dateIt(to)}`,margin,19,7);
      const bytes=await pdf.save();
      const filename=`Presenze_Volla_United_${from}_${to}.pdf`;
      const file=new File([bytes],filename,{type:'application/pdf'});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        try{await navigator.share({files:[file]});toast('PDF presenze condiviso')}
        catch(err){if(err.name!=='AbortError')throw err}
      }else{
        const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
        const a=document.createElement('a');a.href=url;a.download=filename;
        document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),60000);
        toast('PDF scaricato: puoi allegarlo come documento');
      }
    }catch(err){console.error(err);toast('Errore PDF: '+err.message)}
    finally{if(btn.isConnected)btn.disabled=false}
  });
}

const admin=()=>`<h2>⚙️ Pannello amministratore</h2><div class="panel"><h3>Categorie</h3><form id="catform" class="row"> <input id="catname" placeholder="Es. 2021 o Under 12" required><button class="btn">+ Aggiungi</button></form>${cats.map(c=>`<div class="item row"><strong>${esc(c.name)}</strong><button type="button" class="btn alt sm" data-action="rename-category" data-id="${c.id}">✏️ Rinomina</button></div>`).join('')}</div><div class="panel"><h3>Crea account mister</h3><form id="userform" class="stack">${field('newname','Nome e cognome')}${field('newuser','Nome utente (lettere, numeri e punti)')}<div class="field"><label>Categorie da assegnare al mister</label>${cats.map(c=>`<div class="row" style="padding:7px 0"><strong>${esc(c.name)}</strong><label><input type="checkbox" style="width:auto" data-newcat="${esc(c.id)}"> Vedi</label><label><input type="checkbox" style="width:auto" data-newcall="${esc(c.id)}"> Convoca</label></div>`).join('')}</div><button class="btn">Genera accesso temporaneo</button></form><div id="credential"></div></div><div class="panel"><h3>Gestisci mister e autorizzazioni</h3><p class="muted">Elimina mister = archivia l’account, senza cancellare convocazioni, allenamenti e presenze.</p>${users.filter(u=>u.role==='coach'&&u.active!==false).map(u=>`<div class="item"><div class="row"><div><strong>${esc(u.full_name)}</strong><small>${esc(u.username)} · ${esc(u.role)}</small></div><div class="actions"><button class="btn alt sm" data-action="edit-coach" data-id="${u.id}">✏️ Modifica</button><button class="btn alt sm" data-action="reset-pass" data-id="${u.id}">Reset password</button>${u.role==='coach'?`<button class="btn alt sm" data-action="delete-coach" data-id="${u.id}">📦 Archivia</button>`:''}</div></div><div style="margin-top:12px">${cats.map(c=>{let a=access.find(a=>a.user_id===u.id&&a.category_id===c.id);return`<div class="row" style="padding:7px 0"><small>${esc(c.name)}</small><label><input type="checkbox" style="width:auto" data-access="${u.id}|${c.id}|view" ${a?'checked':''}> Vedi</label><label><input type="checkbox" style="width:auto" data-access="${u.id}|${c.id}|convocate" ${a?.can_call_up?'checked':''}> Convoca</label></div>`}).join('')}</div></div>`).join('')}</div>${parentAdminPanel()}<div class="panel"><h3>📦 Mister archiviati</h3><p class="muted">Gli account archiviati non vengono cancellati. Tutti i dati storici rimangono nel database.</p>${users.filter(u=>u.role==='coach'&&u.active===false).map(u=>`<div class="item row"><div><strong>${esc(u.full_name)}</strong><small>${esc(u.username)} · Disattivato</small></div><button type="button" class="btn alt sm" data-action="restore-coach" data-id="${u.id}">↩ Riattiva</button></div>`).join('')||'<p class="empty">Nessun mister archiviato.</p>'}</div><p class="muted">Le password temporanee sono visibili soltanto quando vengono generate: consegnale privatamente ai mister.</p>`;
async function save(table,obj,id){let q=id?sb.from(table).update(obj).eq('id',id):sb.from(table).insert(obj);const {error}=await q;if(error)throw error;await load()}
async function adminCall(body){const {data:{session}}=await sb.auth.getSession();const r=await fetch(`${SUPABASE_URL}/functions/v1/manage-users`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,apikey:SUPABASE_ANON_KEY},body:JSON.stringify(body)});const x=await r.json();if(!r.ok)throw Error(x.error||'Operazione non riuscita');return x}

const fmtItalian=d=>d?d.split('-').reverse().join('/') : '';
function distintaForm(m){
 const values={heading:'VOLLA UNITED - '+(m.opponent||''),competition:m.match_type||'',place:m.field_name||'',date:m.match_date||'',time:(m.kick_off_time||'').slice(0,5),assistant:'',assistant_doc:'',accompanying:'',accompanying_doc:'',referee_officer:'',referee_officer_doc:'',coach:matchCoachName(m)==='Non indicato'?'':matchCoachName(m),coach_doc:'',doctor:'',doctor_doc:'',masseur:'',masseur_doc:''};
 const f=(id,label,type='text')=>`<div class="field"><label>${label}</label><input id="df-${id}" type="${type}" value="${esc(values[id]||'')}"></div>`;
 const staff=[['assistant','Assistente arbitro'],['accompanying','Dirigente accompagnatore'],['referee_officer','Dirigente addetto arbitro'],['coach','Allenatore'],['doctor','Medico sociale'],['masseur','Massaggiatore']];
  const convocati=(m.player_ids||[]).map(id=>players.find(p=>p.id===id)).filter(Boolean);
  const documenti=`<h3>Documenti dei convocati</h3><p class="muted">C.I. e matricola FIGC sono precaricate dalla scheda del calciatore. Puoi correggerle per questa distinta senza modificare l'archivio.</p><div class="stack">${convocati.map(p=>{const d=detailOf(p.id);return `<div class="item"><strong>${esc(fullName(p))}</strong><div class="fields">${field('df-ci-'+p.id,'Carta identità (C.I.)',d.identity_number||'')}${field('df-figc-'+p.id,'Matricola FIGC',d.figc_number||'')}</div></div>`}).join('')}</div>`;
 return `<section class="panel" id="distinta-panel"><h2>📄 Distinta Gara · ${esc(m.opponent||'')}</h2><p class="muted">I campi sono modificabili. Il PDF riproduce il modello ufficiale caricato.</p><div class="fields">${f('heading','Distinta Giocatori partecipanti alla gara')}${f('competition','Campionato')}${f('place','Da disputare a')}${f('date','Il','date')}${f('time','Alle ore','time')}</div>${documenti}<h3>Staff (facoltativo)</h3><div class="fields">${staff.map(([k,label])=>f(k,label)+f(k+'_doc','Documento e/o tessera FIGC n°')).join('')}</div><div class="actions"><button type="button" class="btn" id="create-distinta">📄 Genera PDF distinta</button><button type="button" class="btn alt" id="close-distinta">Chiudi</button></div><p class="muted">C.I. e matricola vengono recuperate dalle schede calciatori.</p></section>`;
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
   const figc=val('df-figc-'+id)||d.figc_number||'';
   const ci=val('df-ci-'+id)||d.identity_number||'';
   write(figc,365,top,7,57);
   if(ci){write('C.I.',431,top,7,27);write(ci,465,top,7,95)}
 });
 // Nomi staff dentro la colonna centrale; documenti nella colonna a destra.
 const staff=[['assistant',641],['accompanying',660],['referee_officer',679],['coach',699],['doctor',720],['masseur',741]];
 for(const [key,top] of staff){
   write(value(key),158,top,8,201);
   write(value(key+'_doc'),486,top,7,75);
 }
 const bytes=await pdf.save();
 const filename='Distinta_Volla_United_'+(m.match_date||'gara')+'.pdf';
 const file=new File([bytes],filename,{type:'application/pdf'});
 // Condividi direttamente il documento: NON condividere un URL blob, che su WhatsApp appare come link inutilizzabile.
 if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
   try{
     await navigator.share({files:[file]});
     toast('Distinta condivisa');
   }catch(shareError){
     if(shareError.name!=='AbortError')throw shareError;
   }
 }else{
   // Browser senza condivisione di file: scarica il PDF, da allegare manualmente su WhatsApp.
   const blob=new Blob([bytes],{type:'application/pdf'});
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');a.href=url;a.download=filename;
   document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),60000);
   toast('PDF scaricato: allegalo come documento su WhatsApp');
 }
 }catch(e){console.error(e);toast(e.message);alert('Impossibile generare la distinta: '+e.message)}finally{if(btn&&btn.isConnected)btn.disabled=false}
}
async function exportRosterPdf(){
 if(me?.role!=='admin')throw Error('Esportazione dati personali riservata all’amministratore');
 const cat=selectedCategory();if(!cat)throw Error('Seleziona un gruppo');
 const [pr,dr]=await Promise.all([sb.from('players').select('*').eq('category_id',cat.id),sb.from('player_details').select('*').eq('category_id',cat.id)]);
 if(pr.error)throw pr.error;if(dr.error)throw dr.error;
 const list=(pr.data||[]).sort(sortPlayers),details=new Map((dr.data||[]).map(d=>[d.player_id,d]));
 if(!list.length)throw Error('Nessun calciatore presente nel gruppo');
 const {PDFDocument,StandardFonts,rgb}=await import('https://esm.sh/pdf-lib@1.17.1');
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const page=pdf.addPage([841.89,595.28]),W=page.getWidth(),H=page.getHeight();
 const ink=rgb(.12,.12,.12),red=rgb(.63,.07,.13),pale=rgb(.95,.95,.95),white=rgb(1,1,1);
 const clean=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,' ').trim();
 const columns=['Calciatore','N.','Nascita','Ruolo','Qualifica','Carta identita','Matricola FIGC'];
 const getDetail=p=>details.get(p.id)||{};
 const rows=list.map(p=>{const d=getDetail(p);return [fullName(p),p.jersey_number??'-',p.birth_date?fmtItalian(p.birth_date):'-',p.primary_role||'-',d.team_role==='captain'?'CAP':d.team_role==='vice'?'VICE':'-',d.identity_number||'-',d.figc_number||'-'].map(String)});
 const margin=20,tableW=W-2*margin,top=H-116,bottom=40,availableH=top-bottom;
 const weights=columns.map((c,i)=>i===0?2.6:c==='Ruolo'?2.1:Math.max(.85,Math.min(1.8,c.length/10)));
 const sum=weights.reduce((x,y)=>x+y,0),widths=weights.map(x=>tableW*x/sum);
 const wrap=(value,width,size,face)=>{const words=clean(value).split(/\s+/),out=[];let line='';for(const word of words){let next=line?line+' '+word:word;if(face.widthOfTextAtSize(next,size)<=width-6){line=next;continue}if(line){out.push(line);line=''}let part='';for(const ch of word){if(face.widthOfTextAtSize(part+ch,size)>width-6&&part){out.push(part);part=''}part+=ch}line=part}if(line)out.push(line);return out.length?out:['-']};
 // Riduce proporzionalmente il carattere fino a far entrare tutti i dati in una sola pagina.
 let size=9,heights=[];
 for(;size>=2.5;size-=.25){heights=rows.map(r=>Math.max(1,...r.map((v,i)=>wrap(v,widths[i],size,font).length))*size*1.2+5);const headH=Math.max(16,size*2.4);if(heights.reduce((a,b)=>a+b,headH)<=availableH)break}
 if(size<2.5)throw Error('Troppi dati per una pagina A4 leggibile. Riduci i campi oppure usa un formato piu grande.');
 let logo=null;try{const r=await fetch('./logo.png',{cache:'no-store'});if(r.ok)logo=await pdf.embedPng(await r.arrayBuffer())}catch(e){console.warn('Logo PDF:',e)}
 if(logo){const sc=Math.min(66/logo.width,66/logo.height);page.drawImage(logo,{x:margin,y:H-82,width:logo.width*sc,height:logo.height*sc})}
 const title='VOLLA UNITED';page.drawText(title,{x:W/2-bold.widthOfTextAtSize(title,19)/2,y:H-47,size:19,font:bold,color:red});
 const sub=clean('LISTA COMPLETA CALCIATORI - '+cat.name).toUpperCase();const subSize=Math.min(12,(W-180)/bold.widthOfTextAtSize(sub,1));page.drawText(sub,{x:W/2-bold.widthOfTextAtSize(sub,subSize)/2,y:H-66,size:subSize,font:bold,color:ink});
 const info=`Totale calciatori: ${list.length}   |   ${new Date().toLocaleDateString('it-IT')}`;page.drawText(clean(info),{x:W/2-font.widthOfTextAtSize(clean(info),9)/2,y:H-85,size:9,font,color:ink});
 const drawCell=(txt,x,y,w,h,face,fill)=>{page.drawRectangle({x,y,width:w,height:h,borderWidth:.35,borderColor:rgb(.65,.65,.65),color:fill});const lines=wrap(txt,w,size,face),lineH=size*1.2;let ty=y+h-3-size;for(const ln of lines){page.drawText(ln,{x:x+3,y:ty,size,font:face,color:ink});ty-=lineH}};
 const headH=Math.max(16,size*2.4);let y=top-headH,x=margin;
 columns.forEach((c,i)=>{drawCell(c,x,y,widths[i],headH,bold,pale);x+=widths[i]});
 rows.forEach((r,j)=>{const h=heights[j];y-=h;x=margin;r.forEach((v,i)=>{drawCell(v,x,y,widths[i],h,font,j%2?white:rgb(.98,.98,.98));x+=widths[i]})});
 page.drawText(clean(`Volla United - ${cat.name} | Documento riservato - dati personali di minori`),{x:margin,y:18,size:7,font,color:ink});
 const bytes=await pdf.save(),filename='Lista_Calciatori_'+cat.name.replace(/[^a-zA-Z0-9_-]+/g,'_')+'.pdf',file=new File([bytes],filename,{type:'application/pdf'});
 if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file]})}catch(e){if(e.name!=='AbortError')throw e}}
 else{const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
}
function bind(){document.querySelector('#vu-enable-push')?.addEventListener('click',vuEnablePush);document.querySelector('[data-action="open-notifications"]')?.addEventListener('click',()=>{page='notifications';render()});document.querySelector('[data-action="read-all-notifications"]')?.addEventListener('click',vuReadAllNotifications);document.querySelectorAll('[data-notification]').forEach(b=>b.addEventListener('click',()=>vuOpenNotification(b.dataset.notification)));document.querySelectorAll('[data-action="vu-more"]').forEach(b=>b.onclick=()=>{const m=$('#vu-more-menu');if(m)m.hidden=!m.hidden});document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page;editing=null;draft=null;selected=[];render()});document.querySelectorAll('[data-action]').forEach(b=>{if(!['open-notifications','read-all-notifications'].includes(b.dataset.action))b.onclick=()=>act(b.dataset.action,b.dataset.id)});$('#category')?.addEventListener('change',e=>{currentCat=e.target.value;selected=[];draft=null;render()});document.querySelectorAll('[data-player]').forEach(el=>el.onchange=()=>{selected=[...document.querySelectorAll('[data-player]:checked')].map(x=>x.dataset.player);$('#count').textContent=selected.length});if(page==='attendance')bindAttendance();if(page==='family')bindFamily();if(page==='profile')bindProfile();if(page==='admin')bindParentsAdmin();if($('#playerformreal'))bindPlayer();if($('#matchform'))bindMatchText();if($('#matchform'))$('#matchform').onsubmit=async e=>{e.preventDefault();try{let m=getDraft();if(!m.match_date)throw Error('Inserisci la data');if(m.match_type==='TORNEO'){if(!m.tournament_name)throw Error('Inserisci il nome del torneo')}else if(!m.opponent)throw Error('Inserisci avversario');const ids=m.player_ids;delete m.player_ids;if(!editing)m.created_by=me.id;let result=editing?await sb.from('matches').update(m).eq('id',editing).select('id').single():await sb.from('matches').insert(m).select('id').single();if(result.error)throw result.error;rememberOpponent(m.opponent);let opponentSaveError=null;try{await saveOpponentToSupabase(m.opponent)}catch(e){opponentSaveError=e.message}const matchId=result.data.id;const del=await sb.from('match_players').delete().eq('match_id',matchId);if(del.error)throw del.error;if(ids.length){const ins=await sb.from('match_players').insert(ids.map((player_id,i)=>({match_id:matchId,player_id,sort_order:i})));if(ins.error)throw ins.error;}page='callhistory';editing=null;draft=null;selected=[];
await load();render();
const savedMatch=matches.find(x=>x.id===matchId);
if(savedMatch){
 const host=$('#historydetail');
 if(host){
  host.innerHTML=`<section class="panel"><h3>✅ Convocazione salvata</h3><p>${esc(savedMatch.opponent)} · ${esc(dateIt(savedMatch.match_date))}</p><div class="actions"><button type="button" class="btn" id="saved-distinta">📄 Crea distinta PDF</button><button type="button" class="btn alt" id="saved-whatsapp">🟢 Condividi WhatsApp</button></div></section>`;
  $('#saved-distinta').onclick=()=>openDistinta(savedMatch);
  $('#saved-whatsapp').onclick=()=>shareWhatsApp(formatMessage(savedMatch));
  host.scrollIntoView({behavior:'smooth',block:'start'});
 }
}
toast(opponentSaveError||'Convocazione salvata')}catch(err){toast(err.message)}};if($('#catform'))$('#catform').onsubmit=async e=>{e.preventDefault();try{await save('categories',{name:val('catname')});toast('Categoria aggiunta')}catch(err){toast(err.message)}};if($('#userform'))$('#userform').onsubmit=async e=>{e.preventDefault();const button=$('#userform button[type=submit], #userform button.btn');button.disabled=true;try{const assignments=cats.filter(c=>document.querySelector(`[data-newcat="${c.id}"]`)?.checked||document.querySelector(`[data-newcall="${c.id}"]`)?.checked).map(c=>({category_id:c.id,can_call_up:!!document.querySelector(`[data-newcall="${c.id}"]`)?.checked}));let r=await adminCall({action:'create',username:val('newuser'),full_name:val('newname')});if(!r.temporary_password||!r.user_id)throw Error('Account creato, ma risposta incompleta: non riprovare la creazione. Usa Reset password.');$('#credential').innerHTML=`<div class="item"><strong>Credenziali da consegnare privatamente</strong><p>Utente: ${esc(r.username)}</p><p>Password temporanea: <b>${esc(r.temporary_password)}</b></p><p>Consegna subito la password al mister: non sarà mostrata nuovamente.</p></div>`;if(assignments.length){try{await adminCall({action:'set-categories',user_id:r.user_id,assignments})}catch(err){toast('Account creato, ma categorie non assegnate: '+err.message)}}users=await query('profiles');access=await query('coach_categories');toast('Account creato. Conserva la password temporanea.')}catch(err){toast(err.message)}finally{button.disabled=false}};document.querySelectorAll('[data-access]').forEach(x=>x.onchange=async()=>{const [user_id,category_id,kind]=x.dataset.access.split('|');if(users.find(u=>u.id===user_id)?.role!=='coach'){x.checked=!x.checked;return toast('I permessi admin non si modificano da questa schermata')}if(kind==='convocate'&&x.checked){const view=document.querySelector(`[data-access="${user_id}|${category_id}|view"]`);if(view)view.checked=true}if(kind==='view'&&!x.checked){const call=document.querySelector(`[data-access="${user_id}|${category_id}|convocate"]`);if(call)call.checked=false}const group=[...document.querySelectorAll('[data-access]')].filter(el=>el.dataset.access.startsWith(user_id+'|'));const assignments=cats.filter(c=>{const view=group.find(el=>el.dataset.access===`${user_id}|${c.id}|view`);const call=group.find(el=>el.dataset.access===`${user_id}|${c.id}|convocate`);return view?.checked||call?.checked}).map(c=>({category_id:c.id,can_call_up:!!group.find(el=>el.dataset.access===`${user_id}|${c.id}|convocate`)?.checked}));try{await adminCall({action:'set-categories',user_id,assignments});access=await query('coach_categories');render();toast('Permessi aggiornati')}catch(err){toast(err.message);x.checked=!x.checked}})}
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
 if($('#playerphoto')?.files?.length){await uploadPlayerPhoto(r.data.id,$('#playerphoto').files[0]);toast('Foto del calciatore caricata')}window._editPlayer=null;await load();toast('Calciatore salvato');
 }catch(err){toast(err.message)}finally{if(btn&&btn.isConnected)btn.disabled=false}}}

async function act(action,id){try{
if(action==='distinta'){
 const m=matches.find(x=>x.id===id);
 if(!m)throw Error('Convocazione non trovata');
 if(!allowed(m.category_id,'view'))throw Error('Non autorizzato');
 openDistinta(m);return;
}
if(action==='share-match'){
 const m=matches.find(x=>x.id===id);
 if(!m)throw Error('Convocazione non trovata');
 if(!allowed(m.category_id,'view'))throw Error('Non autorizzato');
 shareWhatsApp(formatMessage(m));return;
}
if(action==='export-roster'){await exportRosterPdf();return}if(action==='logout'){await sb.auth.signOut();me=null;page='home';editing=null;draft=null;selected=[];currentCat='';login();return}if(action==='new-player'||action==='edit-player'){let p=players.find(p=>p.id===id);window._editPlayer=p?.id||null;$('#playerform').innerHTML=playerForm(p);bindPlayer();$('#playerform').scrollIntoView({behavior:'smooth'});$('#playerform [data-action="close-player"]').onclick=()=>$('#playerform').innerHTML='';return}if(action==='close-player'){$('#playerform').innerHTML='';return}if(action==='delete-player'){if(!confirm('Eliminare questo calciatore?'))return;const {error}=await sb.from('players').delete().eq('id',id);if(error)throw error;await load();return}if(action==='preview'){preview(getDraft(),'#previewarea');return}if(action==='result-match'){const m=matches.find(x=>x.id===id);if(!m||!(me.role==='admin'||allowed(m.category_id,'convocate')))return toast('Non autorizzato');openResult(m);return}if(action==='view-match'){const m=matches.find(x=>x.id===id);if(!m)return;const host=$('#historydetail')||$('#profile-match-detail');if(!host)return;host.innerHTML=matchDetail(m)+(me.role!=='parent'?`<div class="actions"><button class="btn alt" id="edit-result">Modifica risultato</button><button class="btn alt" id="delete-result">Elimina partita</button></div>`:'');host.scrollIntoView({behavior:'smooth'});if(me.role!=='parent'){const edit=$('#edit-result');if(edit)edit.onclick=()=>{if(me.role!=='admin'&&!allowed(m.category_id,'convocate'))return toast('Non autorizzato');page='history';currentCat=m.category_id;render();openResult(m)};const del=$('#delete-result');if(del)del.onclick=async()=>{if(me.role!=='admin'&&!allowed(m.category_id,'convocate'))return toast('Non autorizzato');if(!confirm('Eliminare definitivamente la partita e tutte le statistiche collegate?'))return;const r=await sb.from('matches').delete().eq('id',m.id);if(r.error)return toast(r.error.message);await load()}}return}if(action==='delete-match'){const m=matches.find(x=>x.id===id);if(!m||!(me.role==='admin'||allowed(m.category_id,'convocate')))return toast('Non autorizzato');if(!confirm('Eliminare definitivamente questa convocazione?'))return;const r=await sb.from('matches').delete().eq('id',id);if(r.error)throw r.error;await load();return}if(action==='copy'){await copyMessage(window._previewText);return}if(action==='whatsapp'){shareWhatsApp(window._previewText);return}if(action==='edit-parent'||action==='archive-parent'||action==='restore-parent'||action==='reset-parent'||action==='children-parent'){await parentAdminAction(action,id);return}if(action==='rename-category'){
 if(me?.role!=='admin')throw Error('Operazione riservata all’amministratore');
 const c=cats.find(x=>x.id===id);if(!c)return;
 const name=prompt('Nuovo nome del gruppo:',c.name);if(name===null)return;
 const clean=name.trim();if(!clean)return toast('Il nome non può essere vuoto');
 if(cats.some(x=>x.id!==id&&x.name.toLocaleLowerCase('it')===clean.toLocaleLowerCase('it')))return toast('Esiste già un gruppo con questo nome');
 const {error}=await sb.from('categories').update({name:clean}).eq('id',id);
 if(error)throw error;await load();toast('Gruppo rinominato');return;
 }
 if(action==='edit-coach'){
 if(me?.role!=='admin')throw Error('Operazione riservata all’amministratore');
 const u=users.find(x=>x.id===id);if(!u)return;
 const name=prompt('Nome e cognome del mister:',u.full_name||'');if(name===null)return;
 if(!name.trim())return toast('Inserisci nome e cognome');
 // Modifica il profilo senza cambiare account, password o assegnazioni.
 const {error}=await sb.from('profiles').update({full_name:name.trim()}).eq('id',id);
 if(error)throw error;await load();toast('Mister modificato');return;
 }
  if(action==='delete-coach'){
  if(me?.role!=='admin')throw Error('Operazione riservata all’amministratore');
  const u=users.find(x=>x.id===id);if(!u||u.role!=='coach'||u.id===me.id)throw Error('Puoi archiviare soltanto account mister');
  if(!confirm(`Archiviare ${u.full_name}? Il mister non potrà più accedere. Convocazioni, allenamenti, presenze e calciatori saranno conservati.`))return;
  await adminCall({action:'set-active',user_id:id,active:false});
  await load();toast('Mister archiviato. Dati storici conservati.');return;
 }
 if(action==='restore-coach'){
  if(me?.role!=='admin')throw Error('Operazione riservata all’amministratore');
  const u=users.find(x=>x.id===id);if(!u||u.role!=='coach'||u.active!==false)throw Error('Mister archiviato non trovato');
  if(!confirm(`Riattivare ${u.full_name}? Il mister potrà accedere nuovamente con le credenziali esistenti.`))return;
  await adminCall({action:'set-active',user_id:id,active:true});
  await load();toast('Mister riattivato');return;
 }
 if(action==='reset-pass'){if(!confirm('Generare una nuova password temporanea?'))return;let r=await adminCall({action:'reset',user_id:id});if(!r.temporary_password)throw Error('Reset eseguito ma password non ricevuta: verifica la funzione Supabase');alert('Nuova password temporanea (copiala ora): '+r.temporary_password);return}}catch(err){toast(err.message)}}

// AREA FAMIGLIE - accesso esclusivamente in lettura (anche protetto da RLS Supabase).
const currentSeason=()=>{const d=new Date(),y=d.getMonth()>=8?d.getFullYear():d.getFullYear()-1;return `${y}-${y+1}`};
const photoOf=id=>photoUrls[id]||'';
// Foto originali dei bambini: niente card, Overall o pagelle.
// Dettagli completi della gara: recuperati tramite RPC controllata lato server.
async function loadParentMatchDetails(){
  const ids=matches.filter(m=>m.status==='completed').map(m=>m.id);
  if(!ids.length)return;
  const {data,error}=await sb.rpc('vu_parent_completed_match_details',{p_match_ids:ids});
  if(error){console.error('Dettagli partite genitori:',error);toast('Dettagli partite non disponibili: applica SQL correzione');return}
  for(const d of data||[]){
    const m=matches.find(x=>x.id===d.match_id);if(!m)continue;
    m.public_players=d.players||[];
    m.player_ids=m.public_players.map(x=>x.player_id);
    m.played_ids=m.public_players.filter(x=>x.played).map(x=>x.player_id);
    matchScorers=matchScorers.filter(x=>x.match_id!==m.id);
    for(const x of d.scorers||[])matchScorers.push({match_id:m.id,player_id:x.player_id,goals:x.goals,display_name:x.display_name});
  }
}
async function loadFamilyData(){
  const {data,error}=await sb.from('player_photos').select('*');
  if(error)throw error;
  playerPhotos=data||[];
  parentChildIds=me.role==='parent'?players.map(p=>p.id):[];
  photoUrls={};
  await Promise.all(playerPhotos.map(async p=>{
    if(!p.storage_path)return;
    const {data:signed,error:signError}=await sb.storage.from('volla-player-photos').createSignedUrl(p.storage_path,3600);
    if(!signError&&signed?.signedUrl)photoUrls[p.player_id]=signed.signedUrl;
  }));
}
async function uploadPlayerPhoto(playerId,file){
  if(me.role==='parent')throw Error('Non autorizzato');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Foto JPG, PNG o WEBP, massimo 5 MB');
  const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
  const path=`${playerId}/profilo.${ext}`;
  const old=playerPhotos.find(p=>p.player_id===playerId)?.storage_path;
  const up=await sb.storage.from('volla-player-photos').upload(path,file,{upsert:true,contentType:file.type});
  if(up.error)throw Error('Caricamento foto: '+up.error.message);
  const r=await sb.from('player_photos').upsert({player_id:playerId,storage_path:path,updated_at:new Date().toISOString()},{onConflict:'player_id'});
  if(r.error)throw r.error;
 const cached=playerPhotos.find(p=>p.player_id===playerId);
 if(cached)cached.storage_path=path;else playerPhotos.push({player_id:playerId,storage_path:path});
  if(old&&old!==path)await sb.storage.from('volla-player-photos').remove([old]);
   
}
// Foto del profilo: usa esclusivamente il file originale caricato dal mister/admin.
const vuProfilePhotoCss=`<style>
.vu-player-photo{display:block;width:100%;max-width:420px;max-height:540px;object-fit:contain;object-position:center;margin:18px auto;border-radius:16px;background:#171219}
.vu-player-photo-empty{max-width:420px;min-height:180px;margin:18px auto;display:flex;align-items:center;justify-content:center;border:1px dashed #876d77;border-radius:16px;color:#bfaeb6;text-align:center;padding:18px}
</style>`;
function playerProfilePhoto(p){const src=photoOf(p.id);return src?`<img class="vu-player-photo" src="${esc(src)}" alt="Foto di ${esc(fullName(p))}">`:'<div class="vu-player-photo-empty">Foto non ancora caricata dal mister o dall’amministratore.</div>'}
function profilePage(){
 const available=players.filter(p=>permitted().includes(p.category_id)).sort(sortPlayers);
 const selected=available.find(p=>p.id===profilePlayerId);
 const query=profileSearch.trim().toLocaleLowerCase('it');
 const found=query?available.filter(p=>(fullName(p)+' '+(cats.find(c=>c.id===p.category_id)?.name||'')).toLocaleLowerCase('it').includes(query)).slice(0,40):[];
 return `${vuProfilePhotoCss}<h2>🪪 Profilo calciatore</h2><section class="panel"><p class="muted">Cerca un calciatore e visualizza esattamente la scheda disponibile al suo genitore. Puoi vedere solo le categorie autorizzate.</p><div class="field"><label>Nome, cognome o categoria</label><input id="profile-search" type="search" placeholder="🔎 Cerca un calciatore" value="${esc(profileSearch)}" autocomplete="off"></div><div id="profile-results">${found.map(p=>`<button type="button" class="btn alt sm" data-profile-player="${esc(p.id)}" style="display:block;width:100%;margin:6px 0;text-align:left">${esc(fullName(p))} · ${esc(cats.find(c=>c.id===p.category_id)?.name||'')}</button>`).join('')||'<p class="muted">Scrivi un nome per cercare.</p>'}</div></section><div id="profile-detail">${selected?playerFamilyContent(selected,true):'<section class="panel"><p class="empty">Seleziona un calciatore per aprire il suo profilo.</p></section>'}</div>`;
}
function bindProfile(){
 $('#profile-search')?.addEventListener('input',e=>{profileSearch=e.target.value;const available=players.filter(p=>permitted().includes(p.category_id)).sort(sortPlayers);const q=profileSearch.trim().toLocaleLowerCase('it');$('#profile-results').innerHTML=q?available.filter(p=>(fullName(p)+' '+(cats.find(c=>c.id===p.category_id)?.name||'')).toLocaleLowerCase('it').includes(q)).slice(0,40).map(p=>`<button type="button" class="btn alt sm" data-profile-player="${esc(p.id)}" style="display:block;width:100%;margin:6px 0;text-align:left">${esc(fullName(p))} · ${esc(cats.find(c=>c.id===p.category_id)?.name||'')}</button>`).join('')||'<p class="muted">Nessun risultato</p>':'<p class="muted">Scrivi un nome per cercare.</p>';wireProfileResults()});wireProfileResults();
}
function wireProfileResults(){document.querySelectorAll('[data-profile-player]').forEach(b=>b.onclick=()=>{profilePlayerId=b.dataset.profilePlayer;profileSearch='';render();document.querySelector('#profile-detail')?.scrollIntoView({behavior:'smooth',block:'start'})})}

function familyPage(){
 const p=players.find(x=>x.id===activeChild);
 if(!p)return `<section class="panel"><h2>👨‍👩‍👧‍👦 Area famiglie</h2><p>Nessun bambino associato a questo account. Contatta l'amministratore.</p></section>`;
 return `${vuProfilePhotoCss}${vuPushActivation()}<h2>👨‍👩‍👧‍👦 I miei figli</h2>${players.length>1?`<div class="field"><label>Seleziona bambino</label><select id="child-select">${players.map(x=>`<option value="${x.id}" ${x.id===p.id?'selected':''}>${esc(x.first_name+' '+x.last_name)}</option>`).join('')}</select></div>`:''}${playerFamilyContent(p)}`;
}
function playerFamilyContent(p,staffView=false){
 const now=new Date().toLocaleDateString('en-CA');
 const childMatches=matches.filter(m=>m.player_ids?.includes(p.id)).sort((a,b)=>a.match_date.localeCompare(b.match_date));
 const upcoming=childMatches.filter(m=>m.status!=='completed'&&m.match_date>=now),past=childMatches.filter(m=>m.status==='completed'&&m.played_ids?.includes(p.id)).reverse();
 const trainings=sessions.filter(s=>s.category_id===p.category_id).sort((a,b)=>b.training_date.localeCompare(a.training_date));
 const records=trainings.map(s=>({s,a:attendance.find(a=>a.session_id===s.id&&a.player_id===p.id)})).filter(x=>x.a);
 const present=records.filter(x=>x.a.present).length;
 return `<section class="panel"><h3>${esc(p.first_name)} ${esc(p.last_name)}</h3><p class="muted">${esc(cats.find(c=>c.id===p.category_id)?.name||'')} · ${esc(p.primary_role)} · ${p.jersey_number?'Maglia '+esc(p.jersey_number):'Numero non assegnato'}</p><div class="grid"><div class="item"><strong>${records.length?Math.round(present/records.length*100):0}%</strong><small>Allenamenti</small></div><div class="item"><strong>${past.length}</strong><small>Partite giocate</small></div><div class="item"><strong>${past.reduce((n,m)=>n+(matchScorersFor(m).find(x=>x.player_id===p.id)?.goals||0),0)}</strong><small>Gol fatti</small></div></div>${playerProfilePhoto(p)}</section><section class="panel"><h3>🏃 Allenamenti</h3><p><strong>${present} presenze su ${records.length} registrazioni · ${records.length?Math.round(present/records.length*100):0}%</strong></p>${records.slice(0,5).map(x=>`<div class="item row"><span>${esc(dateIt(x.s.training_date))}</span><strong>${x.a.present?'✅ Presente':'❌ Assente'}</strong></div>`).join('')||'<p class="muted">Nessun allenamento registrato.</p>'}</section><section class="panel"><h3>📅 Prossime convocazioni</h3>${upcoming.map(m=>`<div class="item"><strong>${esc(m.opponent)} · ${esc(dateIt(m.match_date))}</strong><small>${esc(m.field_name||'')} · Appuntamento ${esc((m.meeting_time||'').slice(0,5))} · Inizio ${esc((m.kick_off_time||'').slice(0,5))}</small></div>`).join('')||'<p class="muted">Nessuna convocazione futura.</p>'}</section><section class="panel"><h3>🏟 Ultime partite</h3>${past.slice(0,5).map(m=>`<div class="item row"><div><strong>Volla United ${m.goals_for} – ${m.goals_against} ${esc(m.opponent)}</strong><small>${esc(dateIt(m.match_date))}</small></div><button class="btn alt sm" data-action="view-match" data-id="${m.id}">Apri</button></div>`).join('')||'<p class="muted">Nessuna convocazione precedente.</p>'}</section><div id="profile-match-detail"></div>`;
}
function bindFamily(){ $('#child-select')?.addEventListener('change',e=>{activeChild=e.target.value;render()}) }
function parentChildPicker(prefix, selectedIds=[]){
 const chosen=new Set(selectedIds);
 const sorted=players.slice().sort(sortPlayers);
 return `<div class="field"><label>Cerca bambino per nome, cognome o categoria</label><input type="search" id="${prefix}-search" placeholder="🔎 Es. Igea, Gabriele, 2017" autocomplete="off"><small id="${prefix}-count" class="muted">${chosen.size} bambini selezionati</small><div id="${prefix}-chosen" class="stack" style="margin:8px 0"></div><div id="${prefix}-results" style="max-height:260px;overflow:auto"></div></div>`;
}
function bindParentChildPicker(prefix, initial=[]){
 const selected=new Set(initial);
 const input=document.getElementById(prefix+'-search'), results=document.getElementById(prefix+'-results');
 const count=document.getElementById(prefix+'-count'),chosen=document.getElementById(prefix+'-chosen');
 if(!input||!results)return ()=>[...selected];
 const ordered=players.slice().sort(sortPlayers);
 const label=p=>fullName(p)+' · '+(cats.find(c=>c.id===p.category_id)?.name||'');
 function paint(){
  const terms=input.value.toLocaleLowerCase('it').trim().split(/\s+/).filter(Boolean);
  const filtered=terms.length?ordered.filter(p=>terms.every(t=>label(p).toLocaleLowerCase('it').includes(t))):[];
  count.textContent=selected.size+' bambini selezionati';
  chosen.innerHTML=[...selected].map(id=>{const p=players.find(x=>x.id===id);return p?`<div class="item row" style="gap:8px;align-items:center"><span>✓ ${esc(label(p))}</span><button type="button" class="btn alt sm" data-remove-child="${esc(id)}">✕</button></div>`:''}).join('');
  results.innerHTML=terms.length?filtered.slice(0,60).map(p=>`<label class="check" style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-search-child="${esc(p.id)}" ${selected.has(p.id)?'checked':''}><span>${esc(label(p))}</span></label>`).join('')||'<p class="muted">Nessun bambino trovato.</p>':'<p class="muted">Scrivi almeno una lettera per cercare tra tutti i calciatori.</p>';
  results.querySelectorAll('[data-search-child]').forEach(el=>el.addEventListener('change',()=>{if(el.checked)selected.add(el.dataset.searchChild);else selected.delete(el.dataset.searchChild);paint()}));
  chosen.querySelectorAll('[data-remove-child]').forEach(el=>el.addEventListener('click',()=>{selected.delete(el.dataset.removeChild);paint()}));
 }
 input.addEventListener('input',paint);paint();return ()=>[...selected];
}
let getNewParentChildren=()=>[];
function parentAdminPanel(){const parents=users.filter(u=>u.role==='parent');return `<div class="panel"><h3>👨‍👩‍👧‍👦 Crea account genitore</h3><form id="parentform" class="stack">${field('parent-name','Nome e cognome')}${field('parent-user','Username')}${parentChildPicker('new-parent')}<button class="btn">Crea genitore</button></form><div id="parent-credential">${lastParentCredentials?`<div class="item"><strong>Credenziali da consegnare privatamente</strong><p>Username: ${esc(lastParentCredentials.username)}</p><p>Password: <strong>${esc(lastParentCredentials.password)}</strong></p></div>`:''}</div></div><div class="panel"><h3>Gestisci genitori</h3>${parents.map(u=>`<div class="item row"><div><strong>${esc(u.full_name)}</strong><small>${esc(u.username)} · ${u.active?'Attivo':'Archiviato'}</small></div><div class="actions"><button class="btn alt sm" data-action="children-parent" data-id="${u.id}">Figli</button><button class="btn alt sm" data-action="edit-parent" data-id="${u.id}">Modifica</button>${u.active?`<button class="btn alt sm" data-action="reset-parent" data-id="${u.id}">Password</button><button class="btn alt sm" data-action="archive-parent" data-id="${u.id}">Archivia</button>`:`<button class="btn alt sm" data-action="restore-parent" data-id="${u.id}">Riattiva</button>`}</div></div>`).join('')||'<p class="muted">Nessun genitore registrato.</p>'}</div>`}
function bindParentsAdmin(){ getNewParentChildren=bindParentChildPicker('new-parent'); $('#parentform')?.addEventListener('submit',async e=>{e.preventDefault();const btn=$('#parentform button');btn.disabled=true;try{const ids=getNewParentChildren();if(!ids.length)throw Error('Seleziona almeno un figlio');const r=await adminCall({action:'create',role:'parent',username:val('parent-user'),full_name:val('parent-name')});lastParentCredentials={username:r.username,password:r.temporary_password};$('#parent-credential').innerHTML=`<div class="item"><strong>Credenziali da consegnare privatamente</strong><p>Username: ${esc(r.username)}</p><p>Password: <strong>${esc(r.temporary_password)}</strong></p></div>`;try{await adminCall({action:'set-children',user_id:r.user_id,player_ids:ids})}catch(err){toast('Account creato, ma associazione figli non riuscita: '+err.message);return}await load();toast('Genitore creato e figli associati')}catch(err){toast(err.message)}finally{btn.disabled=false}}) }
async function parentAdminAction(action,id){const u=users.find(x=>x.id===id&&x.role==='parent');if(!u)throw Error('Genitore non trovato');if(action==='children-parent'){const r=await adminCall({action:'get-children',user_id:id});const old=r.player_ids||[];const overlay=document.createElement('div');overlay.id='children-overlay';overlay.className='panel';overlay.style.cssText='position:fixed;inset:5%;overflow:auto;z-index:999;background:#211921;border:2px solid #c49a45;box-shadow:0 0 0 999px #000b';overlay.innerHTML=`<h3>Figli di ${esc(u.full_name)}</h3>${parentChildPicker('edit-parent',old)}<div class="actions"><button class="btn" id="save-children">Salva</button><button class="btn alt" id="close-children">Chiudi</button></div>`;document.body.appendChild(overlay);const getEditedChildren=bindParentChildPicker('edit-parent',old);$('#close-children').onclick=()=>overlay.remove();$('#save-children').onclick=async()=>{try{const ids=getEditedChildren();await adminCall({action:'set-children',user_id:id,player_ids:ids});overlay.remove();toast('Figli aggiornati')}catch(err){toast(err.message)}};return}if(action==='edit-parent'){const name=prompt('Nome e cognome:',u.full_name);if(name===null||!name.trim())return;const r=await sb.from('profiles').update({full_name:name.trim()}).eq('id',id);if(r.error)throw r.error;await load();return}if(action==='reset-parent'){if(!confirm('Generare una nuova password?'))return;const r=await adminCall({action:'reset',user_id:id});alert('Password temporanea: '+r.temporary_password);return}const active=action==='restore-parent';if(!confirm(`${active?'Riattivare':'Archiviare'} ${u.full_name}?`))return;await adminCall({action:'set-active',user_id:id,active});await load();toast('Account aggiornato')}

if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(console.warn);
if(sb){sb.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){me=null;page='home';editing=null;draft=null;selected=[];currentCat='';login()}});load()}else login();

// Quando l'utente lascia la PWA e torna, riparte dalla Home senza disconnetterlo.
let wasBackgrounded=false;
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){wasBackgrounded=true;return}
  if(document.visibilityState==='visible'&&wasBackgrounded){
    wasBackgrounded=false;if(vuRequestedMatch()||vuRequestedNotification()){vuOpenRequestedMatch();return}page='home';editing=null;draft=null;selected=[];
    if(me&&!me.must_change_password)render();
  }
});
window.addEventListener('pageshow',e=>{
  if(e.persisted){page='home';editing=null;draft=null;selected=[];if(me&&!me.must_change_password)render()}
});
