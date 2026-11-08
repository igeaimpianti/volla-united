import {openOffline, hasOffline, clearOffline} from './offline.js';
import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const $=s=>document.querySelector(s), app=$('#app'), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const configured=SUPABASE_URL.startsWith('https://')&&SUPABASE_ANON_KEY!=='INSERISCI_ANON_KEY';
const sb=configured?createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{experimental:{passkey:true}}}):null;
let me=null,access=[],page='home',cats=[],players=[],matches=[],users=[],currentCat='',editing=null,selected=[],draft=null;
let lastParentCredentials=null;
let matchScorers=[];
let vuCategoryStaff=[];
const vuStaffFor=cat=>[...new Map(vuCategoryStaff.filter(x=>x.category_id===cat).map(x=>[x.user_id,x])).values()];
const vuStaffChoices=(cat,selected,exclude='')=>vuStaffFor(cat).filter(x=>x.user_id!==exclude).map(x=>`<option value="${esc(x.full_name.toUpperCase())}" ${String(selected||'').toUpperCase()===x.full_name.toUpperCase()?'selected':''}>${esc(x.full_name.toUpperCase())}</option>`).join('');
function vuStaffDefault(cat){return vuStaffFor(cat)[0]?.full_name?.toUpperCase()||''}
function vuBindStaffSelectors(){const coach=$('#coaches'),dir=$('#dirigente');if(!coach||!dir)return;const currentCoach=draft?.coaches_text||vuStaffDefault(currentCat);const currentDir=draft?.dirigente_text||'';const draw=(preferredCoach,preferredDir)=>{const staff=vuStaffFor(currentCat);coach.innerHTML='<option value="">SELEZIONA MISTER</option>'+vuStaffChoices(currentCat,preferredCoach);if(!staff.some(x=>x.full_name.toUpperCase()===coach.value)&&staff.length)coach.value=staff[0].full_name.toUpperCase();dir.innerHTML='<option value="">NESSUN DIRIGENTE</option>'+vuStaffChoices(currentCat,preferredDir,staff.find(x=>x.full_name.toUpperCase()===coach.value)?.user_id);if(dir.value===coach.value)dir.value='';};draw(currentCoach,currentDir);coach.addEventListener('change',()=>draw(coach.value,dir.value));}

let vuMatchSaving=false;
let vuPendingMatchId=null;
let vuPlayerRequests=[];
let vuCallupResponses=[];
let vuResponsesLoaded=false;
let vuResponseSaving=false;

// Web Push: la chiave privata resta esclusivamente nei Secrets di Supabase.
const VU_VAPID_PUBLIC_KEY='BDEBTIz1Y5JOw4sv_XCTIz15de3yXzV8u7h92j47jktL2iBK_qM_b11fHqCZ3P8FO8zjBm9Jzg2i_y0aw8Na14I';
function vuDecodeVapid(s){const pad='='.repeat((4-s.length%4)%4);const raw=atob((s+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
let vuPushActive=false;
let vuDeviceSubscribed=false;
async function vuCheckPush(){
 vuPushActive=false;
 vuDeviceSubscribed=false;
 if(!['parent','coach','admin'].includes(me?.role)||!sb||!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)||Notification.permission!=='granted')return;
 try{
  const reg=await navigator.serviceWorker.ready;
  const sub=await reg.pushManager.getSubscription();
  if(!sub)return;
  vuDeviceSubscribed=true;
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
  vuDeviceSubscribed=true;
  toast('🔔 Notifiche push attivate su questo dispositivo');
  render();
 }catch(err){console.error('Web Push:',err);toast(err.message||'Impossibile attivare le notifiche')}finally{if(button?.isConnected)button.disabled=false}
}
const vuPushActivation=()=>vuDeviceSubscribed?'':`<section class="panel"><h3>🔔 Avvisi sul telefono</h3><p class="muted">Ricevi gli avvisi Volla United, inclusi i compleanni dei calciatori della tua categoria. Su iPhone apri la PWA dalla schermata Home.</p><button type="button" class="btn" id="vu-enable-push">🔔 Attiva notifiche</button></section>`;
function vuRequestedMatch(){return new URLSearchParams(location.search).get('vu_match')}
function vuRequestedNotification(){return new URLSearchParams(location.search).get('notification')}
function vuClearPushUrl(){const u=new URL(location.href);u.searchParams.delete('notification');u.searchParams.delete('vu_match');u.searchParams.delete('vu_player');u.searchParams.delete('notifications');window.history.replaceState(null,'',u.pathname+u.search+u.hash)}
async function vuOpenRequestedMatch(){
 if(!['parent','coach','admin'].includes(me?.role))return;
 const noticeId=vuRequestedNotification(),matchId=vuRequestedMatch(),openInbox=new URLSearchParams(location.search).has('notifications');
 if(!noticeId&&!matchId&&!openInbox)return;
 page='notifications';render();
 const notice=noticeId?vuNotifications.find(n=>n.id===noticeId):null;
 const match=matchId?matches.find(m=>m.id===matchId):null;
 const playerId=new URLSearchParams(location.search).get('vu_player');
 const eligibleMatch=match&&(me.role==='parent'
   ?match.player_ids?.some(id=>players.some(p=>p.id===id))
   :permitted().includes(match.category_id));
 if(notice)await vuOpenNotification(notice.id,playerId);
 else if(eligibleMatch)vuShowNotificationMatch(match,null,playerId);
 else if(noticeId||matchId)toast('Convocazione non disponibile. Controlla gli avvisi dalla campanella.');
 vuClearPushUrl();
}
function vuNotificationChild(m,n,playerId){
 const candidates=players.filter(p=>(m.player_ids||[]).includes(p.id));
 const requested=candidates.find(p=>p.id===playerId);
 if(requested)return requested;
 if(candidates.length===1)return candidates[0];
 const body=upper(n?.body||'');
 const matched=candidates.filter(p=>body.includes(upper(p.first_name+' '+p.last_name))||body.includes(upper(p.last_name+' '+p.first_name)));
 return matched.length===1?matched[0]:null;
}
function vuShowNotificationMatch(m,n=null,playerId=null){
 if(!m)return toast('Convocazione non trovata');
 if(me?.role==='parent'&&m.status!=='completed'){
  const candidates=players.filter(p=>(m.player_ids||[]).includes(p.id));
  const target=vuNotificationChild(m,n,playerId);
  if(target)return vuOpenParentCallup(m,target.id);
  if(!candidates.length)return toast('Convocazione non disponibile per questo account');
  page='notifications';render();
  const host=$('#notification-match-detail');if(!host)return;
  host.innerHTML=`<section class="panel"><h3>SELEZIONA IL FIGLIO CONVOCATO</h3>${candidates.map(p=>`<button type="button" class="btn alt" data-select-notification-child="${esc(p.id)}">${esc(upper(fullName(p)))}</button>`).join('')}</section>`;
  host.querySelectorAll('[data-select-notification-child]').forEach(b=>b.onclick=()=>vuOpenParentCallup(m,b.dataset.selectNotificationChild));
  host.scrollIntoView({block:'start'});return;
 }
 page='notifications';render();const host=$('#notification-match-detail');if(!host)return;
 host.innerHTML=m.status==='completed'?matchDetail(m):vuCallupRoster(m);vuWireCallupRefresh(host);
 host.scrollIntoView({block:'start'});
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


let playingFields=[];
const fieldName=n=>upper(n).trim().replace(/\s+/g,' ');
const validFieldUrl=u=>{try{const x=new URL(u);return x.protocol==='https:'&&(/(^|\.)google\.[a-z.]+$/.test(x.hostname)&&x.pathname.startsWith('/maps')||['maps.app.goo.gl','goo.gl','share.google','www.openstreetmap.org'].includes(x.hostname))}catch{return false}};
const fieldAliases={'CENTRO ESTER(BARRA)':'CENTRO ESTER - BARRA','AUDAX CASORIA':'AUDAX - CASORIA','MADRIGAL':'MADRIGAL - VOLLA','STADIO COMUNALE AGOSTINO DE CICCO':'STADIO DE CICCO - SANT’ANASTASIA'};
const canonicalField=n=>fieldAliases[fieldName(n)]||fieldName(n);
const fieldRecord=n=>playingFields.find(f=>f.name===canonicalField(n));
const fieldMapUrl=n=>fieldRecord(n)?.maps_url||'';
const fieldSlug=n=>fieldName(n).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const shortFieldAliases={'STADIO DE CICCO - SANT’ANASTASIA':'de-cicco','CENTRO ESTER - BARRA':'ester','MADRIGAL - VOLLA':'madrigal','BOYS NAPOLI - PONTICELLI':'boys','AUDAX - CASORIA':'audax','NEW MARGHERITA - ACERRA':'margherita'};
const fieldShortLink=m=>fieldLink(m)?'https://app.vollaunitedacademy.com/'+encodeURIComponent(shortFieldAliases[canonicalField(m.field_name)]||fieldSlug(canonicalField(m.field_name))):'';
const fieldLink=m=>{const url=fieldMapUrl(m?.field_name);return url&&validFieldUrl(url)?url:''};
const fieldDirections=(m,label='📍 INDICAZIONI PER IL CAMPO')=>{const url=fieldLink(m);return url?`<a class="btn alt sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:''};
async function loadPlayingFields(){const {data,error}=await sb.from('playing_fields').select('name,maps_url').order('name');if(error){console.warn('Campi:',error);return}playingFields=data||[];refreshFieldSuggestions(false)}
function refreshFieldSuggestions(show=true){
 const input=$('#fieldname'),box=$('#field-suggestions');if(!input||!box)return;
 const q=fieldName(input.value);const names=[...new Set([...playingFields.map(f=>f.name),...matches.map(m=>canonicalField(m.field_name)).filter(Boolean)])].sort();
 box.innerHTML=q.length>=2?names.filter(n=>n.includes(q)).slice(0,25).map(n=>`<button type="button" data-field="${esc(n)}" style="display:block;width:100%;text-align:left;padding:12px;background:#24151d;color:white;border:0;border-bottom:1px solid #54313e">${esc(n)}</button>`).join(''):'';
 box.style.display=show&&box.innerHTML?'block':'none';
 box.querySelectorAll('[data-field]').forEach(b=>{b.onpointerdown=e=>e.preventDefault();b.onclick=()=>{input.value=b.dataset.field;box.style.display='none';updateFieldLocationInput()}});
}
function updateFieldLocationInput(){const n=fieldName($('#fieldname')?.value);const rec=fieldRecord(n);const el=$('#field-maps-url');if(!el)return;el.value=rec?.maps_url||'';const hint=$('#field-location-hint');if(hint)hint.textContent=rec?.maps_url?'📍 POSIZIONE GIÀ SALVATA':'POSIZIONE FACOLTATIVA: INCOLLA IL LINK ESATTO DI GOOGLE MAPS';}
async function savePlayingField(name,url){
 const n=fieldName(name);if(!n)return;
 const u=(url||'').trim();
 if(u&&!validFieldUrl(u))throw Error('Link posizione non valido: usa un link Google Maps o OpenStreetMap HTTPS');
 const old=fieldRecord(n);
 if(old&&(!u||old.maps_url===u))return;
 const {error}=await sb.from('playing_fields').upsert({name:n,maps_url:u},{onConflict:'name'});
 if(error)throw Error('Campo non salvato nella rubrica: '+error.message);
 if(old)old.maps_url=u;else playingFields.push({name:n,maps_url:u});
}


let savedTournamentNames=[];
const tournamentName=n=>upper(n).trim().replace(/\s+/g,' ');
async function loadTournamentNames(){
 const {data,error}=await sb.from('tournament_names').select('name').order('name');
 if(error){console.warn('Nomi tornei:',error);return}
 savedTournamentNames=(data||[]).map(x=>x.name);
 refreshTournamentSuggestions(false);
}
function refreshTournamentSuggestions(show=true){
 const input=$('#tournamentname'),box=$('#tournament-suggestions');if(!input||!box)return;
 const q=tournamentName(input.value);
 const names=[...new Set([...savedTournamentNames,...matches.map(m=>tournamentName(m.tournament_name)).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'it'));
 box.innerHTML=q.length>=2?names.filter(n=>n.includes(q)).slice(0,25).map(n=>`<button type="button" data-tournament="${esc(n)}" style="display:block;width:100%;text-align:left;padding:13px;background:#24151d;color:#fff;border:0;border-bottom:1px solid #54313e;font:inherit">${esc(n)}</button>`).join(''):'';
 box.style.display=show&&box.innerHTML?'block':'none';
 box.querySelectorAll('[data-tournament]').forEach(b=>{b.onpointerdown=e=>e.preventDefault();b.onclick=()=>{input.value=b.dataset.tournament;box.style.display='none'}});
}
async function saveTournamentName(name){
 const n=tournamentName(name);if(!n||savedTournamentNames.includes(n))return;
 const {error}=await sb.from('tournament_names').upsert({name:n},{onConflict:'name',ignoreDuplicates:true});
 if(error)throw Error('Nome torneo non registrato nella rubrica: '+error.message);
 savedTournamentNames.push(n);
}

function bindMatchText(){
  if(!$('#matchform'))return;
  const toggleTournament=()=>{const t=val('kind')==='TORNEO';const custom=val('kind')==='ALTRO';const customInput=$('#customkind');if(customInput){customInput.closest('.field').style.display=custom?'':'none';customInput.required=custom}const venue=$('#vu-venue-field');if(venue)venue.style.display=t?'none':'';const el=$('#tournamentname');if(el){el.closest('.field').style.display=t?'':'none';el.required=t}const opp=$('#opponent');if(opp)opp.required=!t};$('#kind')?.addEventListener('change',toggleTournament);toggleTournament();
  opponentDropdownController.abort();opponentDropdownController=new AbortController();
  $('#matchform').querySelectorAll('input[type="text"], textarea').forEach(el=>{
    el.style.textTransform='uppercase';
    el.addEventListener('input',()=>{
      const a=el.selectionStart,b=el.selectionEnd;
      el.value=upper(el.value);
      try{el.setSelectionRange(a,b)}catch{}
      if(el.id==='opponent')refreshOpponentSuggestions(true);if(el.id==='tournamentname')refreshTournamentSuggestions(true);if(el.id==='fieldname'){refreshFieldSuggestions(true);updateFieldLocationInput()}
    });
    el.value=upper(el.value);
  });
  const tournamentInput=$('#tournamentname'),tournamentBox=$('#tournament-suggestions');if(tournamentInput&&tournamentBox){tournamentInput.addEventListener('focus',()=>{refreshTournamentSuggestions(true);loadTournamentNames()});tournamentInput.addEventListener('blur',()=>setTimeout(()=>tournamentBox.style.display='none',250));}
  const fieldInput=$('#fieldname'),fieldBox=$('#field-suggestions');if(fieldInput&&fieldBox){fieldInput.addEventListener('focus',()=>{refreshFieldSuggestions(true);loadPlayingFields()});fieldInput.addEventListener('blur',()=>setTimeout(()=>fieldBox.style.display='none',250));updateFieldLocationInput()}
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
const vuBell=()=>['parent','coach','admin'].includes(me?.role)?`<button type="button" class="vu-bell" data-action="open-notifications" aria-label="Notifiche, ${vuUnread()} non lette" title="Notifiche">🔔${vuUnread()?`<span class="vu-bell-count">${vuUnread()>99?'99+':vuUnread()}</span>`:''}</button>`:'';
async function vuLoadNotifications(){
 vuNotifications=[];vuNotificationError='';
 if(!['parent','coach','admin'].includes(me?.role))return;
 const {data,error}=await sb.from('notifications').select('id,title,body,match_id,player_request_id,created_at,read_at').eq('recipient_id',me.id).order('created_at',{ascending:false}).limit(100);
 if(error){vuNotificationError='Notifiche non disponibili: verifica lo script SQL su Supabase.';console.warn('Notifiche:',error);return}
 vuNotifications=data||[];
}
async function vuLoadCallupResponses(){
 const {data,error}=await sb.from('vu_callup_responses').select('match_id,player_id,response,responded_at');
 if(error){vuResponsesLoaded=false;console.warn('Conferme convocazioni:',error);return false}
 vuCallupResponses=data||[];vuResponsesLoaded=true;return true;
}
async function vuRefreshSingleResponse(matchId,playerId){
 const {data,error}=await sb.from('vu_callup_responses').select('match_id,player_id,response,responded_at').eq('match_id',matchId).eq('player_id',playerId).maybeSingle();
 if(error){vuResponsesLoaded=false;console.warn('Verifica conferma:',error);toast('Impossibile verificare la conferma. Riprova ad aggiornare.');return false}
 vuCallupResponses=vuCallupResponses.filter(r=>!(r.match_id===matchId&&r.player_id===playerId));
 if(data)vuCallupResponses.push(data);
 vuResponsesLoaded=true;return true;
}
function vuResponseFor(matchId,playerId){return vuCallupResponses.find(r=>r.match_id===matchId&&r.player_id===playerId)?.response||'none'}
function vuCallupSummary(m){
 const ids=m.player_ids||[],present=ids.filter(id=>vuResponseFor(m.id,id)==='present').length,absent=ids.filter(id=>vuResponseFor(m.id,id)==='absent').length,pending=ids.length-present-absent;
 return `<div class="vu-confirm-summary"><span>✅ ${present} CONFERMATI</span><span>❌ ${absent} ASSENTI</span><span>⏳ ${pending} IN ATTESA</span></div>`;
}
const vuResponseLabel=r=>r==='present'?'✅ PRESENZA CONFERMATA':r==='absent'?'❌ ASSENZA CONFERMATA':'⏳ IN ATTESA';
function vuCallupRoster(m){
 const ids=m.player_ids||[],groups=[['present','✅ CONFERMATI'],['absent','❌ ASSENTI'],['none','⏳ IN ATTESA']];
 return `<section class="panel vu-callup-manager" id="vu-callup-detail"><h3>👥 GESTIONE CONFERME</h3><p><strong>${esc(upper(isTournament(m)?m.tournament_name||'TORNEO':m.opponent||'PARTITA'))}</strong></p><p class="muted">${esc(dateIt(m.match_date))} · ${esc(upper(cats.find(c=>c.id===m.category_id)?.name||''))} · ${ids.length} CONVOCATI</p>${vuCallupSummary(m)}<p class="muted">LE CONFERME SONO LE RISPOSTE DEI GENITORI, NON LE PRESENZE EFFETTIVE IN CAMPO.</p>${groups.map(([status,title])=>{const group=ids.filter(id=>vuResponseFor(m.id,id)===status).map(id=>players.find(p=>p.id===id)).filter(Boolean).sort(sortPlayers);return `<div class="vu-confirm-group"><h4>${title} · ${group.length}</h4>${group.map(p=>`<div class="vu-confirm-player"><strong>${esc(upper(fullName(p)))}</strong><small>${esc(upper(cats.find(c=>c.id===p.category_id)?.name||''))} · ${esc(vuResponseLabel(status))}</small></div>`).join('')||'<p class="muted">NESSUN CALCIATORE</p>'}</div>`}).join('')}<button type="button" class="btn alt sm" data-refresh-callup="${esc(m.id)}">↻ AGGIORNA RISPOSTE</button></section>`;
}
function vuWireCallupRefresh(host){host?.querySelectorAll('[data-refresh-callup]').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{await vuLoadCallupResponses();const m=matches.find(x=>x.id===btn.dataset.refreshCallup);if(m){host.innerHTML=vuCallupRoster(m);vuWireCallupRefresh(host)}}finally{btn.disabled=false}})}
async function vuOpenParentCallup(m,playerId){
 if(me?.role!=='parent'||!m||!m.player_ids?.includes(playerId)||!players.some(p=>p.id===playerId))return toast('Convocazione non disponibile per questo bambino');
 if(!await vuRefreshSingleResponse(m.id,playerId))return;
 document.getElementById('vu-parent-callup-overlay')?.remove();
 activeChild=playerId;page='family';render();
 const p=players.find(x=>x.id===playerId),r=vuResponseFor(m.id,playerId);
 const overlay=document.createElement('div');overlay.className='vu-detail-overlay vu-parent-callup-fullscreen';overlay.id='vu-parent-callup-overlay';
 overlay.innerHTML=`<section class="vu-detail-dialog" role="dialog" aria-modal="true" aria-label="Conferma convocazione"><div class="vu-detail-head"><h2>⚽ CONFERMA CONVOCAZIONE</h2><button type="button" id="vu-close-parent-callup" aria-label="Chiudi">✕</button></div><div class="vu-detail-scroll"><h3>${esc(upper(fullName(p)))}</h3><p>${esc(upper(isTournament(m)?m.tournament_name||'TORNEO':m.opponent||'PARTITA'))}</p><p>📅 ${esc(dateIt(m.match_date))} · ${esc(upper(m.field_name||''))}</p><p>RADUNO: ${esc((m.meeting_time||'').slice(0,5)||'DA DEFINIRE')}</p>${fieldDirections(m,'📍 APRI MAPPA')}<p>STATO ATTUALE: <strong>${vuResponseLabel(r)}</strong></p>${r==='none'?`<p class="muted">LA RISPOSTA SARÀ DEFINITIVA DOPO IL SALVATAGGIO.</p><div class="actions"><button type="button" class="btn" id="vu-parent-present">✅ CONFERMO PRESENZA</button><button type="button" class="btn alt" id="vu-parent-absent">❌ COMUNICO ASSENZA</button></div>`:`<p class="muted">RISPOSTA REGISTRATA. NON È POSSIBILE MODIFICARLA.</p>`}<p id="vu-response-error" role="alert" class="error" hidden></p></div></section>`;
 document.body.appendChild(overlay);
 overlay.querySelector('#vu-close-parent-callup').onclick=()=>{overlay.remove();page='family';render()};
 for(const [id,response] of [['vu-parent-present','present'],['vu-parent-absent','absent']]){const action=overlay.querySelector('#'+id);if(!action)continue;action.onclick=async()=>{
  const buttons=[...overlay.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  const ok=await vuSetCallupResponse(m.id,playerId,response);
  if(ok){overlay.remove();return}
  if(!overlay.isConnected)return;
  buttons.forEach(b=>b.disabled=false);
  overlay.querySelector('#'+(r==='present'?'vu-parent-present':r==='absent'?'vu-parent-absent':'vu-no-button'))?.setAttribute('disabled','');
  const err=overlay.querySelector('#vu-response-error');err.textContent='RISPOSTA NON SALVATA. RIPROVA.';err.hidden=false;
 };}
}
async function vuSetCallupResponse(matchId,playerId,response){
 if(vuResponseSaving)return false;
 if(!await vuRefreshSingleResponse(matchId,playerId))return false;
 if(vuResponseFor(matchId,playerId)!=='none'){render();toast('Risposta già confermata e non modificabile');return false}
 if(me?.role!=='parent'||!players.some(p=>p.id===playerId)||!matches.some(m=>m.id===matchId&&m.player_ids?.includes(playerId))){toast('Convocazione non autorizzata');return false}
 vuResponseSaving=true;
 try{
  const {error}=await sb.rpc('vu_respond_callup',{p_match_id:matchId,p_player_id:playerId,p_response:response});
  if(error)throw error;
  vuCallupResponses=vuCallupResponses.filter(r=>!(r.match_id===matchId&&r.player_id===playerId));vuCallupResponses.push({match_id:matchId,player_id:playerId,response,responded_at:new Date().toISOString()});vuResponsesLoaded=true;render();toast(response==='absent'?'Assenza confermata':'Presenza confermata');return true;
 }catch(e){toast('Errore conferma: '+e.message);return false}finally{vuResponseSaving=false}
}
// Gli auguri WhatsApp sono disponibili solo ai mister/admin, mai ai genitori.
// Il nome viene letto dal testo generato dal server per il compleanno.
function vuBirthdayShareButton(n){
 if(!['coach','admin'].includes(me?.role)||!/Compleanno calciatore/i.test(String(n.title||'')))return '';
 const found=String(n.body||'').match(/compleanno di\s+(.+?)!(?:\s|$)/i);
 if(!found)return '';
 const name=found[1].trim();
 return `<button type="button" class="btn sm" data-birthday-share="${esc(n.id)}">🟢 Invia auguri a ${esc(name)} su WhatsApp</button>`;
}
function vuShareBirthday(id){
 const n=vuNotifications.find(x=>x.id===id);
 if(!n||!['coach','admin'].includes(me?.role)||!/Compleanno calciatore/i.test(String(n.title||'')))return;
 const found=String(n.body||'').match(/compleanno di\s+(.+?)!(?:\s|$)/i);
 if(!found)return toast('Nome del calciatore non disponibile');
 const name=found[1].trim();
 shareWhatsApp(`🎂⚽ Tanti auguri ${name}! 🎉❤️🖤\nTutta la Volla United Academy ti augura un fantastico compleanno! ⚽🏆`);
}
function vuNotificationsPage(){
 return `${vuPushActivation()}<section class="panel"><h2>🔔 Notifiche</h2>${vuNotificationError?`<p class="muted">${esc(vuNotificationError)}</p>`:''}<div class="actions"><button class="btn alt sm" type="button" data-action="read-all-notifications">Segna tutte come lette</button></div>${vuNotifications.map(n=>`<button type="button" class="vu-notification ${n.read_at?'':'vu-notification-new'}" data-notification="${esc(n.id)}"><strong>${esc(n.title)}</strong><span>${esc(n.body||'')}</span><small>${esc(new Date(n.created_at).toLocaleString('it-IT'))}${n.read_at?'':' · Da leggere'}</small></button>${vuBirthdayShareButton(n)}`).join('')||'<p class="muted">Non hai notifiche.</p>'}</section><div id="notification-match-detail"></div>`;
}
async function vuOpenNotification(id,playerId=null){
 const n=vuNotifications.find(x=>x.id===id);if(!n)return;
 if(!n.read_at){const {error}=await sb.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('recipient_id',me.id);if(error)console.warn('Aggiornamento lettura notifica:',error);else n.read_at=new Date().toISOString()}
 page='notifications';render();
 if(n.match_id)vuShowNotificationMatch(matches.find(x=>x.id===n.match_id),n,playerId);
}

async function vuOpenPlayerRequestFromNotification(id){
 if(!['coach','admin'].includes(me?.role))return;
 await vuLoadPlayerRequests();
 const request=vuPlayerRequests.find(r=>r.id===id);
 if(!request){toast('Richiesta non disponibile');return;}
 if(me.role==='admin'){
   page='home';render();
   const panel=document.getElementById('vu-player-approval-panel');
   panel?.scrollIntoView({behavior:'smooth',block:'start'});
   const target=document.querySelector(`[data-player-request-id="${id}"]`);
   if(target){target.style.outline='2px solid #ffb3c8';target.scrollIntoView({behavior:'smooth',block:'center'});}
 }else{
   page='players';currentCat=request.category_id;render();
   document.getElementById('vu-my-player-requests')?.scrollIntoView({behavior:'smooth',block:'start'});
   const target=document.querySelector(`[data-player-request-id="${id}"]`);
   if(target){target.style.outline='2px solid #ffb3c8';target.scrollIntoView({behavior:'smooth',block:'center'});}
 }
}
async function vuReadAllNotifications(){const ids=vuNotifications.filter(x=>!x.read_at).map(x=>x.id);if(!ids.length)return;const {error}=await sb.from('notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',me.id).in('id',ids);if(error)return toast(error.message);await vuLoadNotifications();render()}
const nav=()=>{const parent=me?.role==='parent';const items=parent?[['family','🏠','Area famiglie']]:[['notifications','🔔','Notifiche'],['home','🏠','Home'],['players','⚽','Calciatori'],['matches','📋','Convocazioni'],['callhistory','🗂','Storico convocazioni'],['history','🏆','Storico partite'],['attendance','✅','Presenze'],...(me?.role==='admin'?[['profile','🪪','Profilo calciatore']]:[]),...(me?.role==='admin'?[['admin','⚙️','Setup · Account e categorie']]:[])];return `<header class="top vu-header"><button type="button" class="vu-brand" data-page="${parent?'family':'home'}" aria-label="Torna alla Home"><img src="logo.png" alt="Volla United"><span><strong>VOLLA UNITED</strong><small>${parent?'AREA FAMIGLIE':'TEAM MANAGEMENT'}</small></span></button>${vuBell()}<details class="vu-account"><summary aria-label="Apri menu di ${esc(me?.full_name||'Utente')}">${esc(me?.full_name||'Mister')} <span>⌄</span></summary><nav class="vu-account-menu" aria-label="Menu principale"><div class="vu-account-role">${parent?'Genitore':me?.role==='admin'?'Amministratore':'Mister'}</div>${items.map(([p,i,t])=>`<button type="button" class="vu-account-link ${page===p?'active':''}" data-page="${p}"><span>${i}</span><span>${t}</span></button>`).join('')}<div class="vu-account-separator"></div><button type="button" class="vu-logout" data-action="logout">🚪 Esci dall’account</button></nav></details></header>`};
const vuStyles=`<style id="vu-nav-style">.vu-confirm-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:14px 0}.vu-confirm-summary span{background:#39212c;border:1px solid #704051;border-radius:10px;padding:11px 5px;text-align:center;font-size:11px;font-weight:800}.vu-confirm-group{margin:14px 0;border:1px solid #603747;border-radius:13px;padding:12px}.vu-confirm-group h4{margin:0 0 10px}.vu-confirm-player{display:flex;justify-content:space-between;gap:12px;align-items:center;border-top:1px solid #4b303c;padding:11px 0}.vu-confirm-player strong{font-size:12px}.vu-confirm-player small{font-size:10px;text-align:right;color:#eac4ce}@media(max-width:420px){.vu-confirm-summary span{font-size:9px}.vu-confirm-player{align-items:flex-start;flex-direction:column;gap:4px}.vu-confirm-player small{text-align:left}}.vu-parent-callup-fullscreen{position:fixed!important;inset:0!important;z-index:2147483000!important;background:#110e15!important;padding:calc(env(safe-area-inset-top,0px) + 20px) 16px calc(env(safe-area-inset-bottom,0px) + 20px)!important;align-items:center!important;justify-content:center!important}.vu-parent-callup-fullscreen .vu-detail-dialog{width:min(100%,480px)!important;max-height:85dvh!important;box-shadow:0 25px 80px #000b!important}.vu-parent-callup-fullscreen .actions{display:grid!important;gap:12px!important}.vu-parent-callup-fullscreen .actions button{min-height:56px!important;font-weight:850!important;font-size:15px!important}.vu-header{display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative;z-index:100}.vu-brand{display:flex;align-items:center;gap:10px;border:0;background:none;color:inherit;text-align:left;padding:0;cursor:pointer;min-width:0}.vu-brand img{width:52px;height:52px;object-fit:contain}.vu-brand span{display:flex;flex-direction:column;gap:3px}.vu-brand strong{font-size:16px;letter-spacing:.6px}.vu-brand small{font-size:10px;opacity:.7}.vu-bell{position:relative;flex:none;border:1px solid #7d3646;background:#25171e;color:#fff;border-radius:12px;padding:10px;font-size:20px;cursor:pointer}.vu-bell-count{position:absolute;right:-6px;top:-8px;border-radius:12px;background:#dc244e;color:#fff;font-size:10px;font-weight:800;min-width:18px;padding:3px}.vu-notification{display:flex;flex-direction:column;gap:7px;width:100%;text-align:left;margin:10px 0;padding:14px;background:#24151d;border:1px solid #54313e;border-radius:12px;color:#fff}.vu-notification-new{border-color:#e44b70;background:#351a29}.vu-notification span{font-size:13px}.vu-notification small{opacity:.65}.vu-account{position:relative;min-width:0;max-width:55%}.vu-account summary{cursor:pointer;list-style:none;border:1px solid #7d3646;border-radius:12px;padding:12px;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#25171e}.vu-account summary::-webkit-details-marker{display:none}.vu-account[open] summary{border-color:#cb3558;background:#431827}.vu-account-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:3000;background:#24151d;border:1px solid #7d3646;border-radius:15px;width:min(310px,calc(100vw - 32px));padding:10px;box-shadow:0 16px 40px #000b;max-height:min(75vh,650px);overflow-y:auto;-webkit-overflow-scrolling:touch}.vu-account-role{font-size:12px;opacity:.65;padding:9px 12px 12px}.vu-account-menu button{display:flex;align-items:center;gap:12px;width:100%;padding:12px;border:0;border-radius:9px;background:transparent;color:#fff;text-align:left;font-size:14px;cursor:pointer}.vu-account-menu button.active{background:#9e1d3a;font-weight:700}.vu-account-menu button:hover{background:#673043}.vu-account-menu button span:first-child{width:24px;text-align:center}.vu-account-separator{height:1px;background:#693343;margin:8px 3px}.vu-account-menu .vu-logout{color:#ffbeca}@media(max-width:650px){.shell{padding-bottom:18px}.vu-header{padding:8px 0}.vu-brand img{width:43px;height:43px}.vu-brand strong{font-size:13px}.vu-brand small{font-size:9px}.vu-account summary{font-size:12px;padding:11px}.vu-account-menu{max-height:75dvh}}</style>`;

function vuBindPasswordVisibility(){
 document.querySelectorAll('#loginform input[type="password"]').forEach(input=>{
  input.autocomplete=input.id==='password'?'current-password':'new-password';
  const control=document.createElement('div');
  const label=input.labels[0].textContent.toLowerCase();
  control.className='vu-password-control';
  input.replaceWith(control);
  const button=document.createElement('button');
  button.type='button';button.className='vu-password-toggle';
  button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/><path class="vu-eye-slash" d="m3 3 18 18"/></svg>';
  button.setAttribute('aria-controls',input.id);
  button.setAttribute('aria-label','Mostra '+label);
  button.setAttribute('aria-pressed','false');
  button.onclick=()=>{
   const visible=input.type==='password';
   input.type=visible?'text':'password';
   button.setAttribute('aria-pressed',String(visible));
  };
  control.append(input,button);
 });
}
function login(force=false){app.innerHTML=`<main class="login"><div class="loginbox"><img src="logo.png" alt="Volla United"><h1>VOLLA UNITED</h1><p class="sub">${force?'PRIMO ACCESSO · CAMBIO PASSWORD':'ACCESSO MISTER, GENITORI E ADMIN'}</p><form id="loginform" class="stack">${force?`<p class="muted">Devi scegliere una password personale prima di continuare.</p>${field('newpass','Nuova password','','password')}${field('confirm','Conferma password','','password')}`:`${field('username','Nome utente',rememberedUsername())}${field('password','Password','','password')}<label style="display:flex;align-items:center;gap:10px;font-size:15px;cursor:pointer"><input type="checkbox" id="remember-login" style="width:20px;height:20px;flex:none" ${rememberedUsername()?'checked':''}> Ricorda nome utente</label>`}<button class="btn">${force?'Salva password e accedi':'Accedi →'}</button></form><div id="autherror" class="error"></div>${!configured?'<p class="error">Configurazione Supabase mancante. Consulta README.md.</p>':''}</div></main>`;
vuBindPasswordVisibility();
if(!force && window.PublicKeyCredential && sb?.auth.signInWithPasskey){
  vuExtraButton($('#loginform'), /iPhone|iPad/.test(navigator.userAgent) ? 'Accedi con Face ID' :
    /Android/.test(navigator.userAgent) ? 'Accedi con impronta' : 'Accedi con passkey', async ()=>{
    const {error}=await sb.auth.signInWithPasskey();
    if(error)throw Error('Accesso con passkey non riuscito. Puoi usare la password.');
    page='home';editing=null;draft=null;selected=[];await load();
  });
}
if(!force && hasOffline())vuExtraButton($('#loginform'),'Apri archivio offline',()=>openOffline(app));
$('#loginform').onsubmit=async e=>{e.preventDefault();$('#autherror').textContent='';try{if(!sb)throw Error('Collega Supabase per attivare il login');if(force){if(val('newpass').length<8)throw Error('Password: almeno 8 caratteri');if(val('newpass')!==val('confirm'))throw Error('Le password non coincidono');await adminCall({action:'change-password',password:val('newpass')});page='home';editing=null;draft=null;selected=[];await load();}else{const uname=val('username').toLowerCase();const email=uname.includes('@')?uname:uname+'@users.volla.invalid';const {error}=await sb.auth.signInWithPassword({email,password:val('password')});if(error)throw Error('Credenziali non valide');try{if($('#remember-login')?.checked)localStorage.setItem(rememberedUserKey,uname);else localStorage.removeItem(rememberedUserKey)}catch{}page='home';editing=null;draft=null;selected=[];await load();}}catch(err){$('#autherror').textContent=err.message}}}
function vuExtraButton(host, label, action){
  const button=document.createElement('button');
  button.type='button';
  button.className='btn alt';
  button.textContent=label;
  button.onclick=async()=>{
    button.disabled=true;
    try{await action()}catch(error){toast(error.message)}
    finally{button.disabled=false}
  };
  host.append(button);
}
function vuAttendanceSnapshot(session){
  return Object.fromEntries(attendance.filter(row=>row.session_id===session?.id).map(row=>[row.player_id,row.present]));
}
function vuOfflineSnapshot(){
  const ids=permitted();
  const allowed=players.filter(p=>ids.includes(p.category_id));
  return {
    canEdit:me.role!=='parent',
    categories:cats.filter(c=>ids.includes(c.id)).map(({id,name})=>({id,name})),
    players:allowed.map(p=>({id:p.id,category:p.category_id,name:fullName(p)})),
    sessions:me.role==='parent'?[]:sessions.filter(t=>ids.includes(t.category_id)).map(t=>({
      id:t.id,category:t.category_id,date:t.training_date,rows:vuAttendanceSnapshot(t)
    })),
    matches:matches.filter(m=>ids.includes(m.category_id)&&m.status!=='completed'&&m.match_date>=vuRomeToday()
      && (me.role!=='parent'||m.player_ids.some(id=>allowed.some(p=>p.id===id))))
      .map(m=>({date:m.match_date,opponent:m.tournament_name||m.opponent,field:m.field_name,time:m.meeting_time||m.kick_off_time}))
  };
}
async function vuSendAttendance(row){
  const {data,error}=await sb.rpc('vu_sync_training_attendance',{
    p_category:row.category,p_date:row.date,p_session:row.session,p_base:row.base,p_rows:row.rows
  });
  if(error)throw error;
  return data;
}
function vuBindDeviceOptions(){
  const menu=$('.vu-account-menu');
  if(!menu)return;
  if(window.PublicKeyCredential && sb.auth.registerPasskey)vuExtraButton(menu,'Attiva Face ID / impronta',async()=>{
    const {error}=await sb.auth.registerPasskey();
    if(error)throw Error('Attivazione passkey non riuscita: '+error.message);
    toast('Passkey registrata');
  });
  vuExtraButton(menu,'Archivio offline',()=>{
    const owner=me.id;
    openOffline(app,{owner,snapshot:vuOfflineSnapshot(),send:async row=>{
      const {data,error}=await sb.auth.getUser();
      if(error||data.user?.id!==owner)throw Error('Accedi di nuovo con lo stesso account.');
      return vuSendAttendance(row);
    },refresh:async()=>{
      await loadAttendance();
      if(!vuAttendanceReady)throw Error('Registro online non disponibile.');
      return vuOfflineSnapshot();
    }});
  });
}
async function query(table,cols='*'){const {data,error}=await sb.from(table).select(cols);if(error)throw error;return data||[]}
async function load(){try{const {data:{user},error:authError}=await sb.auth.getUser();if(authError?.name==='AuthRetryableFetchError'){login();return false;}if(!user){me=null;login();return}const {data,error}=await sb.from('profiles').select('*').eq('id',user.id).single();if(error)throw error;me=data;if(!me.active){await sb.auth.signOut();me=null;login();toast('Account disattivato: contatta l’amministratore');return}if(me.must_change_password){page='home';login(true);return}const [newCats,newAccess,newPlayers,newMatches,newScorers,mp]=await Promise.all([query('categories'),me.role==='parent'?Promise.resolve([]):query('coach_categories'),query('players'),query('matches'),query('match_scorers'),query('match_players')]);cats=newCats;access=newAccess;players=newPlayers;matches=newMatches;matchScorers=newScorers;await Promise.all([loadPlayingFields(),loadTournamentNames()]);matches.forEach(m=>{const rows=mp.filter(x=>x.match_id===m.id).sort((a,b)=>a.sort_order-b.sort_order);m.player_ids=rows.map(x=>x.player_id);m.played_ids=rows.filter(x=>x.played).map(x=>x.player_id)});const [newUsers,newStaff]=await Promise.all([me.role==='admin'?query('profiles'):Promise.resolve([]),me.role==='parent'?Promise.resolve([]):sb.rpc('vu_category_staff').then(({data,error})=>{if(error)throw error;return data||[]}),vuLoadPlayerRequests(),me.role!=='parent'?loadPlayerDetails():Promise.resolve(),loadAttendance(),loadFamilyData(),me.role==='parent'?loadParentMatchDetails():Promise.resolve(),vuLoadNotifications(),vuLoadCallupResponses(),vuLoadFilters(),vuCheckPush(),me.role!=='parent'?loadOpponents():Promise.resolve()]);users=newUsers;vuCategoryStaff=newStaff;if(me.role==='parent')playerDetails=[];if(!permitted().includes(currentCat))currentCat=permitted()[0]||'';if(me.role==='parent'){if(page!=='notifications')page='family';if(!players.some(p=>p.id===activeChild))activeChild=players[0]?.id||''}render();await vuOpenRequestedMatch();const requestedPlayer=new URLSearchParams(location.search).get('player');if(requestedPlayer&&/^[0-9a-f-]{36}$/i.test(requestedPlayer)){const p=players.find(x=>x.id===requestedPlayer);if(p){if(me.role==='parent'){activeChild=p.id;page='family';render()}else if((me.role==='admin'||me.role==='coach')&&permitted().includes(p.category_id)){profilePlayerId=p.id;page='profile';render()}else toast('Profilo non autorizzato')}else toast('Profilo non disponibile per questo account');const u=new URL(location.href);u.searchParams.delete('player');history.replaceState(null,'',u.pathname+u.search+u.hash)}return true}catch(e){toast(e.message);console.error(e);return false}}
// Pull to Refresh disponibile in tutte le sezioni e per tutti i ruoli.
// Protegge le modifiche non salvate senza bloccare intere pagine.
let vuRefreshing=false,vuPullStart=null,vuPullDistance=0,vuFormDirty=false;
const vuEditableForms='#matchform,#playerformreal,#attendanceform,#adminform,form';
document.addEventListener('input',e=>{if(e.target.closest?.(vuEditableForms)&&!e.target.closest('#loginform'))vuFormDirty=true},true);
document.addEventListener('change',e=>{if(e.target.closest?.(vuEditableForms)&&!e.target.closest('#loginform'))vuFormDirty=true},true);
function vuPullAllowed(target){
 if(!me||vuRefreshing||window.scrollY>3||document.querySelector('.vu-detail-overlay'))return false;
 if(target?.closest?.('input,textarea,select,button,[contenteditable],.vu-account-menu'))return false;
 if(vuFormDirty)return false;
 // Le convocazioni in fase di compilazione conservano le selezioni anche prima del salvataggio.
 if(page==='matches'&&(editing||draft||selected.length||vuPendingMatchId))return false;
 return true;
}
function vuPullIndicator(){
 let el=document.getElementById('vu-pull-indicator');
 if(!el){el=document.createElement('div');el.id='vu-pull-indicator';el.setAttribute('aria-live','polite');el.style.cssText='position:fixed;top:env(safe-area-inset-top,0px);left:50%;transform:translate(-50%,-120%);z-index:99998;background:#321a26;color:#fff;border:1px solid #ba4566;border-radius:24px;padding:10px 18px;font-size:12px;font-weight:800;box-shadow:0 5px 20px #0006;pointer-events:none;transition:transform .16s';document.body.appendChild(el)}
 return el;
}
document.addEventListener('touchstart',e=>{vuPullStart=vuPullAllowed(e.target)?e.touches[0].clientY:null;vuPullDistance=0},{passive:true});
document.addEventListener('touchmove',e=>{
 if(vuPullStart===null||e.touches.length!==1)return;
 const d=e.touches[0].clientY-vuPullStart;
 if(d<=0||window.scrollY>3){vuPullStart=null;vuPullIndicator().style.transform='translate(-50%,-120%)';return}
 vuPullDistance=Math.min(d,120);const el=vuPullIndicator();el.textContent=d>=85?'↻ RILASCIA PER AGGIORNARE':'↓ TIRA GIÙ PER AGGIORNARE';el.style.transform=`translate(-50%,${Math.min(12,d/4)}px)`;
},{passive:true});
document.addEventListener('touchend',async()=>{
 if(vuPullStart===null)return;
 const shouldRefresh=vuPullDistance>=85&&vuPullAllowed(null);
 vuPullStart=null;vuPullDistance=0;
 const el=vuPullIndicator();
 if(!shouldRefresh){el.style.transform='translate(-50%,-120%)';return}
 vuRefreshing=true;el.textContent='↻ AGGIORNAMENTO IN CORSO…';
 try{const ok=await load();el.textContent=ok?'✓ AGGIORNATO':'AGGIORNAMENTO NON RIUSCITO';}catch(err){console.error(err);el.textContent='AGGIORNAMENTO NON RIUSCITO';}
 finally{vuRefreshing=false;setTimeout(()=>{el.style.transform='translate(-50%,-120%)'},900)}
},{passive:true});
document.addEventListener('touchcancel',()=>{vuPullStart=null;vuPullDistance=0;const el=document.getElementById('vu-pull-indicator');if(el)el.style.transform='translate(-50%,-120%)'},{passive:true});
function render(){vuFormDirty=false;document.getElementById('opponent-suggestions')?.remove();app.innerHTML=`<main class="shell">${vuStyles}${page==='home'?vuDashStyles:''}${nav()}<div id="content"></div><footer class="foot">#weL⚽ve VOLLAUNITED 🔥</footer></main>`;let c=$('#content');if(me?.role==='parent'){if(page!=='notifications')page='family';c.innerHTML=page==='notifications'?vuNotificationsPage():familyPage();}else if(page==='home')c.innerHTML=home();if(page==='notifications'&&me?.role!=='parent')c.innerHTML=vuNotificationsPage();if(page==='players')c.innerHTML=roster();if(page==='matches')c.innerHTML=matchEditor();if(page==='history')c.innerHTML=history();if(page==='callhistory')c.innerHTML=callHistory();if(page==='attendance')c.innerHTML=attendancePage();if(page==='admin')c.innerHTML=admin();if(page==='profile')c.innerHTML=profilePage();bind();vuBindDeviceOptions()}

async function vuLoadPlayerRequests(){vuPlayerRequests=[];if(!['coach','admin'].includes(me?.role))return;const r=await sb.from('player_requests').select('*').order('created_at',{ascending:false}).limit(200);if(r.error){console.warn('Richieste rosa:',r.error);return;}vuPlayerRequests=r.data||[];}
function vuPlayerApprovalPanel(){const pending=vuPlayerRequests.filter(r=>r.status==='pending');return `<div id="vu-player-approval-panel" class="vu-dash-heading"><h2>📨 RICHIESTE ROSA DA APPROVARE</h2><span>${pending.length} IN ATTESA</span></div><section class="vu-dash-panel">${pending.map(r=>{const p=players.find(p=>p.id===r.player_id),d=r.player_data||{},name=r.request_type==='add'?`${d.last_name||''} ${d.first_name||''}`:p?fullName(p):'CALCIATORE NON DISPONIBILE';const requester=users.find(u=>u.id===r.requested_by);return `<div class="vu-dash-category" data-player-request-id="${esc(r.id)}" style="display:block"><strong>${r.request_type==='add'?'➕ INSERIMENTO':'➖ RIMOZIONE'} · ${esc(upper(name))}</strong><small>${esc(upper(cats.find(c=>c.id===r.category_id)?.name||''))} · MISTER: ${esc(upper(requester?.full_name||'NON DISPONIBILE'))}</small><div class="actions" style="margin-top:10px"><button class="btn sm" data-review-player="${esc(r.id)}" data-approve="yes">✓ APPROVA</button><button class="btn alt sm" data-review-player="${esc(r.id)}" data-approve="no">✕ RIFIUTA</button></div></div>`}).join('')||'<div class="vu-dash-empty">NESSUNA RICHIESTA IN ATTESA</div>'}</section>`}
async function vuReviewPlayerRequest(id,approve){if(me?.role!=='admin')return;const r=vuPlayerRequests.find(x=>x.id===id&&x.status==='pending');if(!r)return;if(!confirm(approve?'Approvare questa modifica alla rosa?':'Rifiutare questa richiesta?'))return;const result=await sb.rpc('review_player_request',{p_request_id:id,p_approve:approve});if(result.error){toast(result.error.message);return;}await load();toast(approve?'Richiesta approvata':'Richiesta rifiutata')}

const vuDashDate=d=>d?new Date(d+'T12:00:00'):null;
const vuDashToday=()=>new Date().toLocaleDateString('en-CA');
const vuDashScore=m=>isFigc(m)&&Array.isArray(m.figc_periods)&&m.figc_periods.length?figcScore(m.figc_periods):[Number(m.goals_for),Number(m.goals_against)];
function vuDashHome(){
 const admin=me.role==='admin',ids=permitted(),today=vuDashToday();
 const scope=matches.filter(m=>ids.includes(m.category_id));
 const completed=scope.filter(m=>m.status==='completed').sort((a,b)=>String(b.match_date).localeCompare(String(a.match_date)));
 const upcoming=scope.filter(m=>m.status!=='completed'&&m.match_date>=today).sort((a,b)=>String(a.match_date).localeCompare(String(b.match_date))||String(a.kick_off_time||'').localeCompare(String(b.kick_off_time||'')));
 const tournaments=completed.filter(isTournament);
 const normal=completed.filter(m=>!isTournament(m)&&m.goals_for!=null&&m.goals_against!=null&&Number.isFinite(vuDashScore(m)[0])&&Number.isFinite(vuDashScore(m)[1]));
 const wins=normal.filter(m=>vuDashScore(m)[0]>vuDashScore(m)[1]).length;
 const draws=normal.filter(m=>vuDashScore(m)[0]===vuDashScore(m)[1]).length;
 const losses=normal.filter(m=>vuDashScore(m)[0]<vuDashScore(m)[1]).length;
 const registered=players.filter(p=>ids.includes(p.category_id)&&p.active!==false).length;
 const thisWeekStart=new Date();thisWeekStart.setHours(0,0,0,0);thisWeekStart.setDate(thisWeekStart.getDate()-((thisWeekStart.getDay()+6)%7));
 const weekKey=thisWeekStart.toLocaleDateString('en-CA');
 const weekSessions=sessions.filter(x=>ids.includes(x.category_id)&&x.training_date>=weekKey&&x.training_date<=today);
 const sessionIds=new Set(weekSessions.map(x=>x.id));
 const weekAttendance=attendance.filter(x=>sessionIds.has(x.session_id));
 const weekPct=weekAttendance.length?Math.round(100*weekAttendance.filter(x=>x.present).length/weekAttendance.length):null;
 const weekMatches=normal.filter(m=>m.match_date>=weekKey&&m.match_date<=today);
 const quick=[['attendance','✅','REGISTRA PRESENZE'],['matches','📋','NUOVA CONVOCAZIONE'],['callhistory','🗂️','CONVOCAZIONI'],['history','🏆','RISULTATI'],['players','👥','CALCIATORI'],...(admin?[['profile','🪪','PROFILI']]:[]),...(admin?[['admin','⚙️','AMMINISTRAZIONE']]:[])];
 const next=upcoming[0];
 const catName=id=>upper(cats.find(c=>c.id===id)?.name||'CATEGORIA');
 return `<div class="vu-dash">
 <section class="vu-dash-hero"><div class="vu-dash-eyebrow">VOLLA UNITED ACADEMY · ${admin?'ACADEMY CONTROL CENTER':'COACH CENTER'}</div><div class="vu-dash-hero-row"><img src="logo.png" alt="Volla United"><div><div class="vu-dash-welcome">BENVENUTO, ${admin?'ADMIN':'MISTER'}</div><h1>${esc(upper(me.full_name||''))}</h1><div class="vu-dash-caption">${admin?'PANORAMICA GENERALE DELLA SOCIETÀ':'LA TUA SQUADRA. IL TUO CENTRO OPERATIVO.'}</div></div></div></section>
 <div class="vu-dash-heading"><h2>⚡ ACCESSO RAPIDO</h2></div><div class="vu-dash-actions">${quick.map(([p,i,t])=>`<button data-page="${p}"><span>${i}</span><b>${t}</b></button>`).join('')}</div>
 <div class="vu-dash-heading"><h2>📊 ${admin?'ACADEMY IN NUMERI':'LA TUA SQUADRA'}</h2><span>DATI REALI</span></div>
 <div class="vu-dash-stats">
 ${[[registered,'CALCIATORI','👥','players'],[normal.length,'PARTITE DISPUTATE','🏟️','matches'],[wins,'VITTORIE','🏆','wins'],[weekPct===null?'—':weekPct+'%','PRESENZE SETTIMANA','📈','attendance']].map(([n,t,i,k])=>`<button type="button" class="vu-dash-stat" data-dash-detail="${k}" aria-label="Apri dettaglio ${t}"><span>${i} ${t}</span><strong>${n}</strong><small>TOCCA PER I DETTAGLI ›</small></button>`).join('')}
 </div>
 <div class="vu-dash-heading"><h2>🏆 TORNEI</h2><span>SEZIONE SEPARATA</span></div>
 <div class="vu-dash-stats">${[[tournaments.length,'TORNEI DISPUTATI','🏆','tournaments'],[tournaments.filter(m=>Number(m.tournament_position)===1).length,'PRIMI POSTI','🥇','first']].map(([n,t,i,k])=>`<button type="button" class="vu-dash-stat" data-dash-detail="${k}" aria-label="Apri dettaglio ${t}"><span>${i} ${t}</span><strong>${n}</strong><small>TOCCA PER I DETTAGLI ›</small></button>`).join('')}</div>
 ${admin?vuPlayerApprovalPanel():''}
 <div class="vu-dash-heading"><h2>⚽ PROSSIMO IMPEGNO</h2><span>${upcoming.length} IN PROGRAMMA</span></div>
 ${next?`<section class="vu-dash-feature"><div class="vu-dash-tag">${esc(catName(next.category_id))} · ${esc(upper(next.match_type||'PARTITA'))}</div><div class="vu-dash-opponent">${esc(upper(isTournament(next)?next.tournament_name||'TORNEO':next.opponent||'AVVERSARIO DA DEFINIRE'))}</div><div class="vu-dash-meta">📅 ${esc(dateIt(next.match_date))} · ⏰ ${esc((next.kick_off_time||'').slice(0,5)||'DA DEFINIRE')}</div><div class="vu-dash-meta">🏟️ ${esc(upper(next.field_name||'CAMPO DA DEFINIRE'))}</div><button class="vu-dash-link" data-page="callhistory">APRI CONVOCAZIONI →</button></section>`:`<section class="vu-dash-feature"><div class="vu-dash-opponent">NESSUNA PARTITA IN PROGRAMMA</div><div class="vu-dash-meta">LE PROSSIME CONVOCAZIONI APPARIRANNO QUI.</div><button class="vu-dash-link" data-page="matches">CREA CONVOCAZIONE →</button></section>`}

 <div class="vu-dash-heading"><h2>📅 RIEPILOGO SETTIMANALE</h2></div>
 <section class="vu-dash-panel"><div class="vu-dash-trio"><div><strong>${weekMatches.length}</strong><span>PARTITE</span></div><div><strong>${weekMatches.filter(m=>!isTournament(m)&&vuDashScore(m)[0]>vuDashScore(m)[1]).length}</strong><span>VITTORIE</span></div><div><strong>${weekSessions.length}</strong><span>ALLENAMENTI</span></div></div><div class="vu-dash-footnote">${weekPct===null?'NESSUNA PRESENZA REGISTRATA QUESTA SETTIMANA':'PRESENZA MEDIA REGISTRATA: '+weekPct+'%'}</div></section>
 <div class="vu-dash-heading"><h2>🏟️ ULTIMI RISULTATI</h2></div><section class="vu-dash-panel">${normal.slice(0,4).map(m=>`<div class="vu-dash-result"><div><strong>${esc(upper(vuAtHome(m)?'VOLLA UNITED – '+(m.opponent||'AVVERSARIO'):(m.opponent||'AVVERSARIO')+' – VOLLA UNITED'))}</strong><small>${esc(catName(m.category_id))} · ${esc(dateIt(m.match_date))}</small></div><b>${esc((vuAtHome(m)?vuDashScore(m):[...vuDashScore(m)].reverse()).join(' – '))}</b></div>`).join('')||'<div class="vu-dash-empty">NESSUN RISULTATO ANCORA REGISTRATO</div>'}<button class="vu-dash-link" data-page="history">VEDI STORICO COMPLETO →</button></section>
 <div class="vu-dash-heading"><h2>🏆 ULTIMI PIAZZAMENTI TORNEI</h2></div><section class="vu-dash-panel">${tournaments.slice(0,5).map(m=>`<div class="vu-dash-result"><div><strong>${esc(upper(m.tournament_name||'TORNEO'))}</strong><small>${esc(catName(m.category_id))} · ${esc(dateIt(m.match_date))}</small></div><b>${esc(m.tournament_position?`${m.tournament_position}° POSTO${m.tournament_band?` · ${upper(m.tournament_band)}`:''}`:'PIAZZAMENTO NON DISPONIBILE')}</b></div>`).join('')||'<div class="vu-dash-empty">NESSUN TORNEO CONCLUSO</div>'}<button class="vu-dash-link" data-page="history">VEDI STORICO TORNEI →</button></section>
 <div class="vu-dash-heading"><h2>🛡️ ${admin?'TUTTE LE CATEGORIE':'LE TUE CATEGORIE'}</h2></div><section class="vu-dash-panel">${cats.filter(c=>ids.includes(c.id)).map(c=>`<div class="vu-dash-category"><div><strong>${esc(upper(c.name))}</strong><small>${players.filter(p=>p.category_id===c.id&&p.active!==false).length} CALCIATORI · ${allowed(c.id,'convocate')?'PUOI CONVOCARE':'SOLO VISUALIZZAZIONE'}</small></div><span>⚽</span></div>`).join('')||'<div class="vu-dash-empty">NESSUNA CATEGORIA ASSEGNATA</div>'}</section>
 <div class="vu-dash-footnote">RISULTATI FIGC CALCOLATI PER TEMPI · TORNEI E PIAZZAMENTI SEPARATI DALLE STATISTICHE PARTITE.</div>
 <div id="vu-dash-detail-host"></div></div>`;
}
const vuDashStyles=`<style id="vu-dashboard-style">
.vu-dash{display:grid;gap:13px;padding:8px 0 25px;color:#fff}
.vu-dash-hero{border:1px solid #9e4656;border-radius:20px;padding:22px 17px;background:linear-gradient(130deg,#4e1125,#1b1019 66%,#351322);box-shadow:0 12px 30px #0004}
.vu-dash-eyebrow{font-size:10px;letter-spacing:1.6px;color:#f5b8c4;font-weight:800}
.vu-dash-hero-row{display:flex;align-items:center;gap:14px;margin-top:16px}
.vu-dash-hero img{width:76px;height:76px;object-fit:contain;flex:none}
.vu-dash-welcome{font-size:11px;letter-spacing:1px;color:#f1b8c3;font-weight:800}
.vu-dash-hero h1{font-size:clamp(19px,5vw,29px);margin:6px 0;line-height:1.12;overflow-wrap:anywhere}
.vu-dash-caption{font-size:10px;letter-spacing:.6px;color:#d7bac3;line-height:1.5}
.vu-dash-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px}
.vu-dash-heading h2{font-size:14px;letter-spacing:.5px;margin:0}
.vu-dash-heading>span{font-size:10px;color:#e9a5b5;font-weight:800;white-space:nowrap}
.vu-dash-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.vu-dash-stat,.vu-dash-panel{background:linear-gradient(155deg,#291820,#1b141b);border:1px solid #613142;border-radius:16px;padding:15px}
.vu-dash-stat{color:#fff;text-align:left;cursor:pointer;font:inherit;width:100%;min-width:0}.vu-dash-stat:focus-visible{outline:3px solid #f7afc2;outline-offset:2px}.vu-dash-stat>small{display:block;font-size:9px;color:#d69aaa;margin-top:5px;font-weight:800}.vu-dash-stat span{font-size:10px;display:block;line-height:1.5;color:#e6b5c2;font-weight:800;letter-spacing:.3px}
.vu-dash-stat strong{font-size:34px;line-height:1.3;display:block;margin-top:8px;font-variant-numeric:tabular-nums}
.vu-dash-feature{border:1px solid #bb5269;border-radius:17px;padding:18px;background:linear-gradient(120deg,#5b1730,#25151f)}
.vu-dash-tag{font-size:10px;color:#f6c5cf;font-weight:800;letter-spacing:1px}
.vu-dash-opponent{font-size:22px;font-weight:900;margin:13px 0;line-height:1.15;overflow-wrap:anywhere}
.vu-dash-meta{font-size:12px;margin:8px 0;color:#f4dbe2}
.vu-dash-link{margin-top:12px;padding:11px 12px;background:#a82b4b;color:#fff;border:1px solid #d65c7b;border-radius:10px;font-size:11px;font-weight:900;letter-spacing:.4px;cursor:pointer}
.vu-dash-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.vu-dash-actions button{display:flex;align-items:center;gap:9px;text-align:left;padding:14px 10px;background:#291820;border:1px solid #633345;color:#fff;border-radius:12px;cursor:pointer;min-height:65px}
.vu-dash-actions span{font-size:23px}.vu-dash-actions b{font-size:10px;line-height:1.3;overflow-wrap:anywhere}
.vu-dash-trio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));text-align:center;gap:5px}
.vu-dash-trio>div{display:grid;gap:5px}.vu-dash-trio strong{font-size:26px}.vu-dash-trio span{font-size:9px;color:#e3b7c2;font-weight:800}
.vu-dash-footnote{font-size:10px;color:#caa4b0;line-height:1.5;margin-top:10px}
.vu-dash-result,.vu-dash-category{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #55303e}
.vu-dash-result:last-of-type,.vu-dash-category:last-child{border-bottom:0}
.vu-dash-result strong,.vu-dash-category strong{display:block;font-size:12px;overflow-wrap:anywhere}
.vu-dash-result small,.vu-dash-category small{display:block;font-size:10px;color:#cda6b3;margin-top:5px}
.vu-dash-result>b{font-size:14px;text-align:right;max-width:48%;overflow-wrap:anywhere}
.vu-dash-empty{font-size:12px;color:#d7b0bc;padding:10px 0}
.vu-roster-group{border:1px solid #744052;border-radius:12px;margin:10px 0;overflow:hidden;background:#2b1923}.vu-roster-group>summary{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:15px 12px;cursor:pointer;font-size:13px;font-weight:800;list-style:none}.vu-roster-group>summary::-webkit-details-marker{display:none}.vu-roster-group>summary span{font-size:10px;color:#f0b4c4;white-space:nowrap}.vu-roster-group[open]>summary{background:#512538}.vu-roster-members{padding:0 12px 8px}.vu-detail-overlay{position:fixed;inset:0;z-index:99999;background:#000d;display:flex;align-items:center;justify-content:center;padding:14px}.vu-detail-dialog{background:#21151d;border:1px solid #9e4656;border-radius:18px;width:min(100%,600px);max-height:90dvh;display:flex;flex-direction:column;padding:15px;color:#fff}.vu-detail-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.vu-detail-head button{background:#80304a;color:white;border:0;border-radius:8px;padding:10px}.vu-detail-scroll{overflow-y:auto;min-height:0;flex:1}.vu-detail-row{display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #603547;padding:12px 3px}.vu-detail-row strong,.vu-detail-row small{display:block}.vu-detail-row small{font-size:10px;color:#d6aab8;margin-top:4px}.vu-detail-row b{font-size:13px}.vu-detail-player{background:transparent;border:0;color:#fff;text-align:left;width:100%;cursor:pointer}.vu-detail-summary{padding:12px;background:#4a2635;border-radius:10px;margin:8px 0}@media(max-width:360px){.vu-dash-hero img{width:55px;height:55px}.vu-dash-actions b{font-size:9px}}
</style>`;
function vuDashDetail(kind){
 if(!['players','matches','wins','attendance','tournaments','first'].includes(kind)||!['admin','coach'].includes(me?.role))return;
 const host=document.getElementById('vu-dash-detail-host');if(!host)return;
 const ids=permitted(),today=vuDashToday();
 const completed=matches.filter(m=>ids.includes(m.category_id)&&m.status==='completed').sort((a,b)=>String(b.match_date).localeCompare(String(a.match_date)));
 const games=completed.filter(m=>!isTournament(m)&&m.goals_for!=null&&m.goals_against!=null&&vuDashScore(m).every(Number.isFinite));
 const tournaments=completed.filter(isTournament);
 const cat=id=>upper(cats.find(c=>c.id===id)?.name||'CATEGORIA');
 const row=(title,sub,right='')=>`<div class="vu-detail-row"><div><strong>${esc(title)}</strong><small>${esc(sub)}</small></div>${right?`<b>${esc(right)}</b>`:''}</div>`;
 const game=m=>{const score=vuDashScore(m),home=vuAtHome(m);return row(upper(home?'VOLLA UNITED – '+(m.opponent||'AVVERSARIO'):(m.opponent||'AVVERSARIO')+' – VOLLA UNITED'),`${cat(m.category_id)} · ${dateIt(m.match_date)} · ${upper(m.field_name||'CAMPO NON INDICATO')}`,(home?score:[...score].reverse()).join(' – '))};
 const tour=m=>row(upper(m.tournament_name||'TORNEO'),`${cat(m.category_id)} · ${dateIt(m.match_date)}`,`${m.tournament_position||'—'}° POSTO${m.tournament_band?' · '+upper(m.tournament_band):''}`);
 let title='',body='';
 if(kind==='players'){
    title='👥 CALCIATORI PER CATEGORIA';
    const visible=players.filter(p=>ids.includes(p.category_id)&&p.active!==false);
    const groups=cats.filter(c=>ids.includes(c.id)).sort((a,b)=>a.name.localeCompare(b.name,'it',{numeric:true}));
    body=`<div class="vu-detail-summary">${visible.length} CALCIATORI · ${groups.length} CATEGORIE · SELEZIONA UNA CATEGORIA PER APRIRE LA ROSA</div>`;
    body+=groups.map(c=>{
      const ps=visible.filter(p=>p.category_id===c.id).sort((a,b)=>(a.last_name||'').localeCompare(b.last_name||'','it',{sensitivity:'base'})||(a.first_name||'').localeCompare(b.first_name||'','it',{sensitivity:'base'}));
      return `<details class="vu-roster-group"><summary>⚽ ${esc(upper(c.name))}<span>${ps.length} CALCIATORI ▾</span></summary><div class="vu-roster-members">${ps.map(p=>`<button type="button" class="vu-detail-row vu-detail-player" data-dash-player="${esc(p.id)}"><span><strong>${esc(upper(fullName(p)))}</strong><small>${esc(upper(p.primary_role||'RUOLO NON INDICATO'))}</small></span><b>${p.jersey_number!=null?'#'+esc(p.jersey_number):'›'}</b></button>`).join('')||'<p class="vu-dash-empty">NESSUN CALCIATORE IN QUESTA CATEGORIA</p>'}</div></details>`;
    }).join('');
  }
 if(kind==='matches'){title='🏟️ PARTITE DISPUTATE';body=games.map(game).join('')}
 if(kind==='wins'){title='🏆 PARTITE VINTE';body=games.filter(m=>vuDashScore(m)[0]>vuDashScore(m)[1]).map(game).join('')}
 if(kind==='tournaments'){title='🏆 TORNEI DISPUTATI';body=tournaments.map(tour).join('')}
 if(kind==='first'){title='🥇 PRIMI POSTI';body=tournaments.filter(m=>Number(m.tournament_position)===1).map(tour).join('')}
 if(kind==='attendance'){
   title='📈 PRESENZE DELLA SETTIMANA';
   const monday=new Date();monday.setHours(0,0,0,0);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));const from=monday.toLocaleDateString('en-CA');
   const week=sessions.filter(x=>ids.includes(x.category_id)&&x.training_date>=from&&x.training_date<=today).sort((a,b)=>String(b.training_date).localeCompare(String(a.training_date)));
   const weekIds=new Set(week.map(x=>x.id)),rows=attendance.filter(a=>weekIds.has(a.session_id));const yes=rows.filter(a=>a.present).length;
   body=`<div class="vu-detail-summary">${week.length} ALLENAMENTI · ${yes} PRESENZE · ${rows.length-yes} ASSENZE · ${rows.length?Math.round(100*yes/rows.length)+'%':'—'} MEDIA REGISTRATA</div>`;
   body+=week.map(x=>{const records=rows.filter(a=>a.session_id===x.id),present=records.filter(a=>a.present).length;return row(`${cat(x.category_id)} · ${dateIt(x.training_date)}`,`${present} PRESENTI · ${records.length-present} ASSENTI`,records.length?Math.round(100*present/records.length)+'%':'—')}).join('');
   if(rows.length){const perPlayer=new Map();for(const a of rows){const p=players.find(p=>p.id===a.player_id);if(!p)continue;const k=p.id,v=perPlayer.get(k)||{p,total:0,present:0};v.total++;if(a.present)v.present++;perPlayer.set(k,v)}body+='<h3>DETTAGLIO CALCIATORI</h3>'+[...perPlayer.values()].sort((a,b)=>sortPlayers(a.p,b.p)).map(x=>row(upper(fullName(x.p)),`${cat(x.p.category_id)} · ${x.present} PRESENTE/I SU ${x.total}`,Math.round(x.present*100/x.total)+'%')).join('')}
 }
 host.innerHTML=`<div class="vu-detail-overlay" role="presentation"><section class="vu-detail-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="vu-detail-head"><h2>${title}</h2><button type="button" data-dash-close aria-label="Chiudi">✕</button></div><div class="vu-detail-scroll">${body||'<p class="vu-dash-empty">NESSUN DATO DISPONIBILE</p>'}</div><button type="button" class="vu-dash-link" data-dash-close>CHIUDI</button></section></div>`;
 host.querySelectorAll('[data-dash-player]').forEach(b=>b.onclick=()=>{profilePlayerId=b.dataset.dashPlayer;profileSearch='';page='profile';render();document.getElementById('profile-detail')?.scrollIntoView({block:'start'})});
 host.querySelectorAll('[data-dash-close]').forEach(b=>b.onclick=()=>host.replaceChildren());
 host.querySelector('.vu-detail-overlay').addEventListener('click',e=>{if(e.target.classList.contains('vu-detail-overlay'))host.replaceChildren()});
 host.querySelector('.vu-detail-dialog').focus();
}
const home=()=>vuDashHome();
const catSelector=(ids=permitted())=>`<div class="field"><label>Categoria</label><select id="category">${categoryOptions(ids)}</select></div>`;
const detailOf=id=>playerDetails.find(d=>d.player_id===id)||{};
async function loadPlayerDetails(){const r=await sb.from('player_details').select('*');if(r.error){console.warn('Dettagli giocatori:',r.error);playerDetails=[];toast('Configura la tabella player_details su Supabase');return}playerDetails=r.data||[]}
const roster=()=>`<div class="row sectionhead"><h2>⚽ Calciatori</h2><button class="btn sm" data-action="new-player">${me?.role==='coach'?'📨 Richiedi inserimento':'+ Nuovo'}</button></div>${catSelector()}<div id="playerform"></div><section class="panel"><div class="actions"><button type="button" class="btn" data-action="export-roster">📄 Scarica lista completa PDF</button></div><div class="row" style="align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><h3 style="margin:0">Rosa ${esc(selectedCategory()?.name||'')}</h3><strong style="font-size:14px;white-space:nowrap">Iscritti ${players.filter(p=>p.category_id===currentCat).length} Calciatori</strong></div>${players.filter(p=>p.category_id===currentCat).sort(sortPlayers).map(p=>`<div class="item row"><div><strong>${esc(p.last_name)} ${esc(p.first_name)} ${p.jersey_number?'#'+esc(p.jersey_number):''}</strong><small>${esc(p.primary_role||'Ruolo non indicato')}${p.secondary_role?' · '+esc(p.secondary_role):''}${detailOf(p.id).team_role==='captain'?' · CAPITANO':detailOf(p.id).team_role==='vice'?' · VICECAPITANO':''}</small></div><div class="actions">${me?.role==='admin'?`<button class="btn alt sm" data-action="edit-player" data-id="${p.id}">Modifica</button>`:''}${me?.role==='admin'? `<button class="btn alt sm" data-action="toggle-player-active" data-id="${p.id}">${p.active===false?'RIATTIVA':'DISATTIVA'}</button><button class="btn alt sm" data-action="delete-player" data-id="${p.id}" style="border-color:#c44;color:#f77">ELIMINA DEFINITIVAMENTE</button>` : `<button class="btn alt sm" data-action="delete-player" data-id="${p.id}">📨 Richiedi rimozione</button>`}</div></div>`).join('')||'<p class="empty">Nessun calciatore presente</p>'}</section>${vuCoachRequestsPanel()}`;
function vuCoachRequestsPanel(){if(me?.role!=='coach')return '';const own=vuPlayerRequests.filter(r=>r.requested_by===me.id).slice(0,30);return `<section class="panel" id="vu-my-player-requests"><h3>📨 LE MIE RICHIESTE ROSA</h3>${own.map(r=>{const d=r.player_data||{},p=players.find(x=>x.id===r.player_id);return `<div class="item" data-player-request-id="${esc(r.id)}"><strong>${r.request_type==='add'?'➕ INSERIMENTO':'➖ RIMOZIONE'} · ${esc(upper(r.request_type==='add'?`${d.last_name||''} ${d.first_name||''}`:p?fullName(p):'CALCIATORE'))}</strong><small>${esc(upper(cats.find(c=>c.id===r.category_id)?.name||''))} · ${r.status==='approved'?'✅ APPROVATA':r.status==='rejected'?'❌ RIFIUTATA':'⏳ IN ATTESA'}</small></div>`}).join('')||'<p class="muted">NESSUNA RICHIESTA PRESENTE</p>'}</section>`}
const roles=['Portiere','Difensore','Centrocampista','Attaccante','Jolly'];
// Ordine fisso per ruolo, poi cognome e nome (italiano).
const roleOrder=['Portiere','Difensore','Centrocampista','Attaccante'];
const sortPlayers=(a,b)=>{
  const rank=p=>{const n=roleOrder.indexOf(p.primary_role);return n<0?roleOrder.length:n};
  return rank(a)-rank(b) || (a.last_name||'').localeCompare(b.last_name||'','it',{sensitivity:'base'}) || (a.first_name||'').localeCompare(b.first_name||'','it',{sensitivity:'base'});
};

const playerForm=p=>`<form id="playerformreal" class="panel"><h3>${p?'Modifica':'Nuovo'} calciatore</h3><div class="fields">${p&&me?.role==='admin'?`<div class="field"><label for="player-category">GRUPPO DEL CALCIATORE</label><select id="player-category">${cats.map(c=>`<option value="${esc(c.id)}" ${c.id===p.category_id?'selected':''}>${esc(upper(c.name))}</option>`).join('')}</select></div>`:''}${field('firstname','Nome',p?.first_name)}${field('surname','Cognome',p?.last_name)}${field('birthday','Data di nascita',p?.birth_date,'date')}${field('shirt','Numero maglia',p?.jersey_number,'number')}<div class="field"><label>Ruolo principale</label><select id="role">${roles.map(r=>`<option ${p?.primary_role===r?'selected':''}>${r}</option>`).join('')}</select></div><div class="field"><label>Ruolo secondario</label><select id="role2"><option value="">Nessuno</option>${roles.map(r=>`<option ${p?.secondary_role===r?'selected':''}>${r}</option>`).join('')}</select></div><div class="field"><label>Qualifica</label><select id="teamrole">${[['none','Calciatore'],['captain','Capitano (CAP)'],['vice','Vicecapitano (V.CAP)']].map(([v,t])=>`<option value="${v}" ${((p&&detailOf(p.id).team_role)||'none')===v?'selected':''}>${t}</option>`).join('')}</select></div>${field('identitynumber','Numero carta identità',p?detailOf(p.id).identity_number:'')}${field('figcnumber','Matricola FIGC',p?detailOf(p.id).figc_number:'')}${field('fiscalcode','Codice fiscale',p?(p.fiscal_code||p.codice_fiscale||''):'')}${p?`<div class="field"><label>Foto del calciatore</label>${photoOf(p.id)?`<img src="${esc(photoOf(p.id))}" alt="Foto profilo" style="max-height:150px;max-width:100%;object-fit:contain">`:''}<input type="file" id="playerphoto" accept="image/jpeg,image/png,image/webp"><p class="muted">La foto caricata sarà visualizzata nel profilo del bambino e nell’area genitori.</p></div>`:''}</div><div class="actions"><button class="btn">Salva calciatore</button><button type="button" class="btn alt" data-action="close-player">Annulla</button></div></form>`;
const vuYear=c=>String(c?.name||'').match(/(?:19|20)\d{2}/)?.[0]||'';
const vuExternalPlayers=()=>{const year=vuYear(selectedCategory());return year?players.filter(p=>p.category_id!==currentCat&&vuYear(cats.find(c=>c.id===p.category_id))===year&&p.active!==false).sort(sortPlayers):[]};
const vuExternalCount=()=>selected.filter(id=>players.some(p=>p.id===id&&p.category_id!==currentCat)).length;
function vuValidateCallup(ids){const year=vuYear(selectedCategory());if(!year)throw Error('Annata della categoria non riconosciuta');const unique=[...new Set(ids)];if(unique.length!==ids.length)throw Error('Calciatore duplicato');const external=unique.map(id=>players.find(p=>p.id===id)).filter(p=>p&&p.category_id!==currentCat);if(unique.some(id=>!players.some(p=>p.id===id)))throw Error('Calciatore non disponibile');if(external.some(p=>vuYear(cats.find(c=>c.id===p.category_id))!==year))throw Error('Puoi convocare solo calciatori della stessa annata');if(me?.role!=='admin'&&external.length>3)throw Error('Hai raggiunto il limite massimo di 3 calciatori di altri gruppi.');}
// Explicit exceptions apply only to this editor and this match week.
let vuAttendanceReady=false,vuEligibilityContext='',vuAttendanceExceptions=new Set();
const vuRomeToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function vuCallupWeek(date){
 const d=new Date(date+'T12:00:00Z');if(isNaN(+d))return null;
 d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
 const start=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+6);
 return {start,end:d.toISOString().slice(0,10)};
}
function vuEligibilityDate(){return $('#matchform #date')?.value||draft?.match_date||vuRomeToday()}
function vuEligibilityScope(){
 const week=vuCallupWeek(vuEligibilityDate());
 const key=[me?.id,editing||'new',currentCat,week?.start].join('|');
 if(key!==vuEligibilityContext){vuEligibilityContext=key;vuAttendanceExceptions.clear()}
 return week;
}
function vuTrainingCount(id){
 const week=vuEligibilityScope();if(!vuAttendanceReady||!week)return null;
 const end=[week.end,vuRomeToday(),vuEligibilityDate()].sort()[0];
 const sessionDates=new Map(sessions.filter(s=>s.training_date>=week.start&&s.training_date<=end).map(s=>[s.id,s.training_date]));
 return new Set(attendance.filter(a=>a.player_id===id&&a.present===true&&sessionDates.has(a.session_id)).map(a=>sessionDates.get(a.session_id))).size;
}
function vuEligibilityRow(p,external=false){
 const count=vuTrainingCount(p.id),exception=vuAttendanceExceptions.has(p.id),blocked=count===null||count<2;
 return `<div class="check" style="flex-wrap:wrap"><input type="checkbox" id="p${esc(p.id)}" data-player="${esc(p.id)}" ${selected.includes(p.id)?'checked':''} ${blocked&&!exception&&!selected.includes(p.id)?'disabled':''}><label for="p${esc(p.id)}">${esc(upper(fullName(p)))} <span class="muted">· ${esc(upper(external?cats.find(c=>c.id===p.category_id)?.name||'':p.primary_role||''))}</span><small style="display:block">${count===null?'PRESENZE NON DISPONIBILI':count+' / 2 ALLENAMENTI'}${exception?' · DEROGA CONFERMATA':''}</small></label>${blocked?`<button type="button" class="btn alt sm" data-training-info="${esc(p.id)}" aria-label="Informazioni allenamenti di ${esc(fullName(p))}">ⓘ</button>`:''}</div>`;
}
function vuRefreshEligibility(){
 const host=$('#vu-callup-players');if(!host)return;
 host.innerHTML=players.filter(p=>p.category_id===currentCat).sort(sortPlayers).map(p=>vuEligibilityRow(p)).join('')||'<p class="empty">Inserisci prima i calciatori della categoria.</p>';
 const external=$('#vu-external-players');if(external)external.innerHTML=vuExternalPlayers().map(p=>vuEligibilityRow(p,true)).join('')||'<p class="muted">Nessun altro gruppo disponibile della stessa annata.</p>';
 const week=vuEligibilityScope();$('#vu-training-week').textContent=week?`MINIMO 2 PRESENZE · SETTIMANA ${dateIt(week.start)} – ${dateIt(week.end)} · SOLO ALLENAMENTI GIÀ SVOLTI`:'SELEZIONA LA DATA DELLA PARTITA';
 host.closest('form').querySelectorAll('[data-player]').forEach(el=>el.onchange=()=>{
  const ids=[...document.querySelectorAll('[data-player]:checked')].map(x=>x.dataset.player);
  try{if(el.checked&&(vuTrainingCount(el.dataset.player)===null||vuTrainingCount(el.dataset.player)<2)&&!vuAttendanceExceptions.has(el.dataset.player))throw Error('Apri le informazioni e scegli CONVOCA UGUALMENTE');vuValidateCallup(ids);selected=ids}catch(err){el.checked=false;selected=ids.filter(id=>id!==el.dataset.player);toast(err.message)}
  $('#count').textContent=selected.length;$('#vu-external-count').textContent=vuExternalCount();vuRefreshEligibility();
 });
 // I pulsanti informativi sono gestiti tramite delega, anche dopo il ridisegno della lista.
}
// Intercetta il tap prima dei gestori di riga/form: funziona anche sui pulsanti ricreati.
document.addEventListener('click',function vuTrainingInfoClick(event){
 const button=event.target.closest?.('[data-training-info]');
 if(!button)return;
 event.preventDefault();
 event.stopPropagation();
 try{vuShowTrainingInfo(button.dataset.trainingInfo,button)}catch(error){console.error('Apertura info allenamenti',error);alert('ERRORE INFO ALLENAMENTI: '+error.message)}
},true);
function vuShowTrainingInfo(id,anchor){
 const p=players.find(p=>p.id===id);if(!p)return;
 document.querySelectorAll('.vu-training-popover').forEach(x=>x.remove());
 const count=vuTrainingCount(id);
 const panel=document.createElement('div');
 panel.className='vu-training-popover';
 panel.setAttribute('role','dialog');
 panel.setAttribute('aria-label','Informazioni convocabilità');
 panel.style.cssText='position:fixed!important;z-index:2147483647!important;box-sizing:border-box;width:min(340px,calc(100vw - 24px));max-height:70dvh;overflow-y:auto;padding:17px;border:1px solid rgba(225,95,120,.45);border-radius:16px;background:rgba(37,20,31,.94);color:#fff;box-shadow:0 12px 36px rgba(0,0,0,.42);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);font-size:14px;line-height:1.45';
 panel.innerHTML=`<strong style="display:block;margin-bottom:9px;font-size:15px">${esc(upper(fullName(p)))}</strong><p style="margin:0 0 8px">${count===null?'PRESENZE AGLI ALLENAMENTI NON DISPONIBILI.':'IL CALCIATORE NON HA RAGGIUNTO IL MINIMO DI 2 ALLENAMENTI.'}</p><p style="margin:0 0 14px;opacity:.8">${count===null?'VERIFICA LE PRESENZE PRIMA DI PROCEDERE.':count+' PRESENZE SU 2 RICHIESTE NELLA SETTIMANA DELLA PARTITA.'}</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-override style="flex:1 1 auto">CONVOCA UGUALMENTE</button><button type="button" class="btn alt sm" data-close>CHIUDI</button></div>`;
 const close=()=>{panel.remove();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escapeKey)};
 const outside=e=>{if(!panel.contains(e.target)&&!e.target.closest?.('[data-training-info]'))close()};
 const escapeKey=e=>{if(e.key==='Escape')close()};
 panel.querySelector('[data-close]').onclick=close;
 panel.querySelector('[data-override]').onclick=()=>{
  try{
   const ids=[...new Set([...selected,id])];
   vuValidateCallup(ids);
   vuEligibilityScope();
   vuAttendanceExceptions.add(id);
   selected=ids;
   $('#count').textContent=selected.length;
   $('#vu-external-count').textContent=vuExternalCount();
   close();vuRefreshEligibility();
  }catch(err){toast(err.message)}
 };
 document.body.appendChild(panel);
 const rect=anchor?.getBoundingClientRect?.()||{left:12,right:40,top:innerHeight/2,bottom:innerHeight/2};
 const width=panel.offsetWidth,height=panel.offsetHeight;
 const left=Math.max(12,Math.min(rect.right-width,innerWidth-width-12));
 const below=rect.bottom+8,above=rect.top-height-8;
 const top=below+height<=innerHeight-12?below:above>=12?above:Math.max(12,Math.min(below,innerHeight-height-12));
 panel.style.left=left+'px';panel.style.top=top+'px';
 document.addEventListener('pointerdown',outside,true);
 document.addEventListener('keydown',escapeKey);
}

function vuValidateTraining(ids){
 vuEligibilityScope();
 const blocked=ids.filter(id=>{const n=vuTrainingCount(id);return (n===null||n<2)&&!vuAttendanceExceptions.has(id)});
 if(blocked.length)throw Error('ALLENAMENTI INSUFFICIENTI: '+blocked.map(id=>fullName(players.find(p=>p.id===id))).join(', ')+'. APRI ⓘ E SCEGLI CONVOCA UGUALMENTE.');
}
const matchEditor=()=>{let ids=convocable();if(editing&&me.role==='admin'&&!ids.includes(currentCat))ids=[...ids,currentCat];if(!ids.includes(currentCat))currentCat=ids[0]||'';if(!ids.length)return'<h2>📋 Convocazioni</h2><div class="panel empty">Non sei autorizzato a creare convocazioni per nessuna categoria.</div>';const ps=players.filter(p=>p.category_id===currentCat).sort(sortPlayers);return`<h2 class="sectionhead">📋 ${editing?'Modifica':'Nuova'} convocazione</h2>${catSelector(ids)}<div id="historydetail"></div><form id="matchform" class="panel"><div class="fields"><div class="field"><label>Tipologia gara</label><select id="kind">${['AMICHEVOLE','FIGC','NEXT GEN','CAMPIONATO','RAGAZZI D’ORO','TORNEO','TRIANGOLARE',...new Set(matches.map(m=>m.match_type).filter(t=>t&&!['TORNEO FIGC','AMICHEVOLE','FIGC','NEXT GEN','CAMPIONATO','RAGAZZI D’ORO','TORNEO','TRIANGOLARE','ALTRO'].includes(t))),'ALTRO'].map(x=>`<option ${(draft?.match_type==='TORNEO FIGC'&&x==='FIGC')||draft?.match_type===x?'selected':''}>${x}</option>`).join('')}</select></div>${field('customkind','Se ALTRO, specifica',draft?.custom_kind||((draft?.match_type&&!['AMICHEVOLE','TORNEO FIGC','FIGC','NEXT GEN','CAMPIONATO','RAGAZZI D’ORO','TORNEO','TRIANGOLARE'].includes(draft.match_type))?draft.match_type:''))}${field('tournamentname','Nome torneo',draft?.tournament_name||'').replace('</div>','<div id="tournament-suggestions" role="listbox" style="display:none;max-height:180px;overflow-y:auto;border:1px solid #54313e;border-radius:10px"></div></div>')}${field('fieldname','Campo da gioco',draft?.field_name||'MADRIGAL - VOLLA').replace('</div>','<div id="field-suggestions" style="display:none;max-height:180px;overflow:auto;border:1px solid #54313e;border-radius:10px"></div></div>')}<div class="field"><label for="field-maps-url">LINK POSIZIONE CAMPO (GOOGLE MAPS)</label><input id="field-maps-url" type="url" placeholder="https://maps.app.goo.gl/..." value="${esc(fieldMapUrl(draft?.field_name||'MADRIGAL'))}"><small id="field-location-hint">FACOLTATIVO · SALVA UNA VOLTA, RIUTILIZZA SEMPRE</small></div>${draft?.match_type==='TORNEO'?'':`<div class="field" id="vu-venue-field"><label for="vu-venue">CASA O TRASFERTA</label><select id="vu-venue"><option value="auto" ${!draft?.home_away?'selected':''}>AUTOMATICO (MADRIGAL = CASA)</option><option value="home" ${draft?.home_away==='home'?'selected':''}>🏠 CASA</option><option value="away" ${draft?.home_away==='away'?'selected':''}>🚌 TRASFERTA</option></select><small>LA SCELTA MANUALE PREVALE SEMPRE SUL CAMPO.</small></div>`}${field('opponent','Avversario',draft?.opponent).replace('<input id="opponent"','<input id="opponent" autocomplete="off"').replace('</div>','<div id="opponent-suggestions" role="listbox" style="display:none;position:static;width:100%;max-height:180px;overflow-y:auto;border:1px solid #54313e;border-radius:10px;background:#24151d;z-index:100;box-shadow:0 10px 25px #0008"></div></div>')}${field('date','Data',draft?.match_date||new Date().toLocaleDateString('en-CA'),'date')}${field('meet','Ora convocazione',draft?.meeting_time||'17:35','time')}${field('start','Inizio partita',draft?.kick_off_time||'17:50','time')}${field('shirtcolor','Maglia',draft?.jersey_color||'ROSSO-NERA')}${field('shorts','Pantaloncini',draft?.shorts_color||'NERO')}${field('socks','Calzerotti',draft?.socks_color||'NERO')}</div><div class="field" style="margin-top:13px"><label>Avviso ai genitori</label><textarea id="notice">${esc(draft?.notice||'Comunicare tempestivamente ogni tipo di assenza IN PRIVATO.')}</textarea></div><div class="field" style="margin-top:13px"><label>Mister responsabile della categoria</label><select id="coaches"></select></div><div class="field" style="margin-top:13px"><label>Dirigente (secondo mister, se presente)</label><select id="dirigente"></select></div><h3 class="sectionhead">Seleziona i convocati · <span id="count">${selected.length}</span></h3><p class="muted" id="vu-training-week"></p><div class="stack" id="vu-callup-players"></div><details class="panel" style="margin-top:14px" id="vu-external-panel" ${vuExternalCount()?'open':''}><summary style="cursor:pointer;font-weight:700">➕ Calciatori di altri gruppi · <span id="vu-external-count">${vuExternalCount()}</span>/3</summary><p class="muted">Solo gruppi della stessa annata. Massimo 3 calciatori esterni per convocazione.</p><div id="vu-external-players"></div></details><div class="actions"><button class="btn" type="submit">💾 Salva convocazione</button><button class="btn alt" type="button" data-action="preview">👁 Anteprima WhatsApp</button></div></form><div id="previewarea"></div>`};
function getDraft(){return{category_id:currentCat,match_type:upper(val('kind')==='ALTRO'?val('customkind'):val('kind')),tournament_name:val('kind')==='TORNEO'?upper(val('tournamentname')):null,field_name:upper(val('fieldname')),home_away:val('kind')==='TORNEO'?null:({'home':'home','away':'away'}[val('vu-venue')]||null),opponent:upper(val('opponent')),match_date:val('date'),meeting_time:val('meet'),kick_off_time:val('start'),jersey_color:upper(val('shirtcolor')),shorts_color:upper(val('shorts')),socks_color:upper(val('socks')),notice:upper(val('notice')),coaches_text:upper(val('coaches')),dirigente_text:upper(val('dirigente')),player_ids:selected}}
const callHistory=()=>`<h2>🗂 Storico convocazioni</h2>${catSelector()}<section class="panel">${matches.filter(m=>m.category_id===currentCat&&m.status!=='completed').sort((a,b)=>b.match_date.localeCompare(a.match_date)||String(b.kick_off_time||'').localeCompare(String(a.kick_off_time||''))).map(m=>`<div class="item"><strong>${esc(isTournament(m)?m.tournament_name||'TORNEO':m.opponent)} · ${esc(dateIt(m.match_date))}</strong><small>${esc(m.match_type||'')} · ${esc(m.field_name||'')} · Mister: ${esc(matchCoachName(m))}</small>${vuCallupSummary(m)}<div class="actions"><button type="button" class="btn alt sm" data-action="view-callup" data-id="${m.id}">👥 PRESENTI / ASSENTI</button><button type="button" class="btn alt sm" data-action="edit-match" data-id="${m.id}">✏️ Modifica</button><button type="button" class="btn sm" data-action="distinta" data-id="${m.id}">📄 Distinta</button><button type="button" class="btn alt sm" data-action="share-match" data-id="${m.id}">🟢 WhatsApp</button><button type="button" class="btn sm" data-action="result-match" data-id="${m.id}">🏁 Inserisci risultato</button><button type="button" class="btn alt sm" data-action="delete-match" data-id="${m.id}">🗑 Elimina</button></div></div>`).join('')||'<p class="empty">Nessuna convocazione salvata in attesa del risultato.</p>'}</section><div id="historydetail"></div>`;
const history=()=>`<h2>🏟 Storico partite</h2>${catSelector()}<section class="panel">${matches.filter(m=>m.category_id===currentCat&&m.status==='completed').sort((a,b)=>b.match_date.localeCompare(a.match_date)).map(m=>`<div class="item row"><div><strong>${esc(matchLabel(m))}</strong><small>${esc(dateIt(m.match_date))} · ${esc(m.match_type)} · Mister: ${esc(matchCoachName(m))}</small></div><button class="btn alt sm" data-action="view-match" data-id="${m.id}">Apri</button></div>`).join('')||'<p class="empty">Nessuna partita conclusa.</p>'}</section><div id="historydetail"></div>`;
const isTournament=m=>m.match_type==='TORNEO';
const vuBandsDefault=['PLATINO','ORO','ARGENTO','BRONZO'];
const vuBandsFor=m=>Array.isArray(m.tournament_bands)&&m.tournament_bands.length?m.tournament_bands:[];
const vuTournamentPlace=m=>m.tournament_position?`${m.tournament_position}° POSTO${m.tournament_band?' '+m.tournament_band:''}`:'';
function vuTournamentFields(m){
 const bands=vuBandsFor(m),mode=bands.length?(bands.join('|')==='PLATINO|ORO|ARGENTO|BRONZO'?'four':bands.join('|')==='ORO|ARGENTO|BRONZO'?'three':'custom'):'general';
 return `<div class="field"><label>TIPO DI CLASSIFICA</label><select id="vu-band-mode"><option value="general" ${mode==='general'?'selected':''}>CLASSIFICA GENERALE</option><option value="four" ${mode==='four'?'selected':''}>PLATINO · ORO · ARGENTO · BRONZO</option><option value="three" ${mode==='three'?'selected':''}>ORO · ARGENTO · BRONZO</option><option value="custom" ${mode==='custom'?'selected':''}>PERSONALIZZA FASCE</option></select></div><div id="vu-custom-bands" style="display:none"><label>FASCE PERSONALIZZATE (UNA PER RIGA)</label><textarea id="vu-band-names" rows="4" style="text-transform:uppercase">${esc((bands.length?bands:vuBandsDefault).join('\n'))}</textarea></div><div class="field" id="vu-band-field"><label>FASCIA RAGGIUNTA</label><select id="vu-band-selected"></select></div><div class="field"><label>POSIZIONE FINALE</label><select id="tournament-position">${Array.from({length:30},(_,i)=>i+1).map(n=>`<option value="${n}" ${m.tournament_position===n?'selected':''}>${n}° POSTO</option>`).join('')}</select></div><p id="vu-band-preview" class="muted"></p>`;
}
function vuBindTournamentFields(m){
 const mode=$('#vu-band-mode'),names=$('#vu-band-names'),sel=$('#vu-band-selected'),pos=$('#tournament-position');if(!mode)return;
 const draw=()=>{const kind=mode.value;$('#vu-custom-bands').style.display=kind==='custom'?'':'none';let bands=kind==='four'?vuBandsDefault:kind==='three'?vuBandsDefault.slice(1):kind==='custom'?names.value.split(/[\n,;]+/).map(x=>upper(x).trim()).filter(Boolean):[];bands=[...new Set(bands)];const prior=sel.value||m.tournament_band||'';sel.innerHTML=bands.map(b=>`<option value="${esc(b)}" ${b===prior?'selected':''}>${esc(b)}</option>`).join('');$('#vu-band-field').style.display=bands.length?'':'none';pos.querySelectorAll('option').forEach(o=>o.hidden=bands.length&&Number(o.value)>4);if(bands.length&&Number(pos.value)>4)pos.value='1';$('#vu-band-preview').textContent=`RISULTATO: ${pos.value}° POSTO${bands.length?' '+sel.value:''}`;};
 mode.onchange=draw;names.oninput=()=>{const a=names.selectionStart,b=names.selectionEnd;names.value=upper(names.value);names.setSelectionRange(a,b);draw()};sel.onchange=draw;pos.onchange=draw;draw();
}

const isFigc=m=>['TORNEO FIGC','FIGC'].includes(m.match_type);
const figcScore=periods=>periods.reduce((a,p)=>[a[0]+(p[0]>=p[1]?1:0),a[1]+(p[1]>=p[0]?1:0)], [0,0]);
const figcGoals=periods=>periods.reduce((a,p)=>[a[0]+p[0],a[1]+p[1]],[0,0]);
const ordinalPlace=n=>n===1?'primo':n===2?'secondo':n===3?'terzo':n===4?'quarto':n===5?'quinto':`${n}°`;
const vuAtHome=m=>m.home_away==='home'?true:m.home_away==='away'?false:canonicalField(m.field_name)==='MADRIGAL - VOLLA';
const matchLabel=m=>{
 if(isTournament(m))return `${m.tournament_name||'TORNEO'}${m.tournament_position?' · '+vuTournamentPlace(m):''}`;
 const figc=isFigc(m)&&Array.isArray(m.figc_periods)&&m.figc_periods.length;
 const [gf,ga]=figc?figcScore(m.figc_periods):[m.goals_for,m.goals_against];
 return vuAtHome(m)?`Volla United ${gf} – ${ga} ${m.opponent}${figc?' (FIGC)':''}`:`${m.opponent} ${ga} – ${gf} Volla United${figc?' (FIGC)':''}`;
};
const matchScorersFor=m=>matchScorers.filter(x=>x.match_id===m.id);
const matchCoachName=m=>String(m?.coaches_text||vuStaffDefault(m?.category_id)||'Non indicato').trim();
function matchDetail(m){return `<section class="panel"><h3>🏟 ${esc(matchLabel(m))}</h3><p>${esc(dateIt(m.match_date))} · ${esc(m.match_type)} · Mister: ${esc(matchCoachName(m))}</p>${isFigc(m)&&Array.isArray(m.figc_periods)&&m.figc_periods.length?`<h3>⏱ Tempi FIGC</h3>${m.figc_periods.map((p,i)=>`<div class="item">${i+1}° tempo: ${p[0]}–${p[1]}</div>`).join('')}<p>Gol effettivi: ${figcGoals(m.figc_periods).join('–')}</p>`:''}<h3>⚽ Marcatori</h3>${matchScorersFor(m).map(x=>{const p=players.find(p=>p.id===x.player_id);const display=p?fullName(p):(x.display_name||m.public_players?.find(y=>y.player_id===x.player_id)?.display_name||'Calciatore');return `<div class="item">${esc(display)} · ${x.goals} ${x.goals===1?'gol':'gol'}</div>`}).join('')||'<p class="muted">Nessun marcatore registrato.</p>'}<h3>👥 Convocati</h3>${(m.player_ids||[]).map(id=>{const p=players.find(p=>p.id===id);const display=p?fullName(p):(m.public_players?.find(y=>y.player_id===id)?.display_name||'Calciatore');return `<div class="item row"><span>${esc(display)}</span><small>${m.played_ids?.includes(id)?'✅ Ha giocato':'Assente'}</small></div>`}).join('')}</section>`}
function resultForm(m){const played=m.status==='completed'?(m.played_ids||[]):(m.player_ids||[]);const tournament=isTournament(m);const figc=isFigc(m);const periods=Array.isArray(m.figc_periods)&&m.figc_periods.length?m.figc_periods:[[0,0],[0,0],[0,0]];return `<section class="panel"><h3>🏁 ${esc(tournament?m.tournament_name||'TORNEO':m.opponent)}</h3><p class="muted">Tutti i convocati sono considerati giocanti. Spunta soltanto gli assenti.</p>${tournament?`${vuTournamentFields(m)}`:`${figc?'':`<div class="fields">${field('goals-for','Gol Volla United',m.goals_for??0,'number')}${field('goals-against','Gol avversari',m.goals_against??0,'number')}</div>`}`}${figc?`<h3>⏱ Risultato per tempi FIGC</h3><div class="field"><label>Numero tempi</label><select id="figc-count"><option value="3" ${periods.length===3?'selected':''}>3 tempi</option><option value="4" ${periods.length===4?'selected':''}>4 tempi</option></select></div><div id="figc-periods"></div><p id="figc-preview"></p>`:''}<h3>Assenti ${tournament?'al torneo':'alla partita'}</h3>${(m.player_ids||[]).map(id=>{const p=players.find(p=>p.id===id);const goals=matchScorersFor(m).find(x=>x.player_id===id)?.goals||0;return `<div class="item"><label class="check"><input type="checkbox" data-absent="${id}" ${!played.includes(id)?'checked':''}> Assente · ${esc(p?fullName(p):'Calciatore')}</label><div class="field"><label>Gol segnati ${tournament?'nel torneo':'nella partita'}</label><input type="number" min="0" step="1" data-goals="${id}" value="${goals}"></div></div>`}).join('')}<div class="actions"><button class="btn" id="save-result">💾 Salva ${tournament?'piazzamento':'risultato'}</button><button class="btn alt" id="cancel-result">Annulla</button></div></section>`}
function vuSelectNumericOnFocus(host){host.querySelectorAll('input[type="number"]').forEach(input=>{input.addEventListener('focus',()=>{if(input.value==='0')input.select()});input.addEventListener('click',()=>{if(input.value==='0')input.select()});});}
function openResult(m){const host=$('#historydetail');if(!host)return;host.innerHTML=resultForm(m);vuSelectNumericOnFocus(host);if(isTournament(m))vuBindTournamentFields(m);if(isFigc(m)){const initial=Array.isArray(m.figc_periods)&&m.figc_periods.length?m.figc_periods:[[0,0],[0,0],[0,0],[0,0]];const draw=()=>{const n=Number(val('figc-count'));$('#figc-periods').innerHTML=Array.from({length:n},(_,i)=>`<div class="fields"><div class="field"><label>${i+1}° tempo · Volla</label><input type="number" min="0" step="1" data-figc-for="${i}" value="${initial[i]?.[0]??0}"></div><div class="field"><label>${i+1}° tempo · Avversario</label><input type="number" min="0" step="1" data-figc-against="${i}" value="${initial[i]?.[1]??0}"></div></div>`).join('');vuSelectNumericOnFocus($('#figc-periods'));$('#figc-periods').oninput=preview;preview()};const preview=()=>{const n=Number(val('figc-count'));const periods=Array.from({length:n},(_,i)=>[Number(document.querySelector(`[data-figc-for="${i}"]`)?.value),Number(document.querySelector(`[data-figc-against="${i}"]`)?.value)]);const [a,b]=figcScore(periods),[gf,ga]=figcGoals(periods);$('#figc-preview').textContent=`Risultato FIGC: ${a}–${b} · Gol reali: ${gf}–${ga}`};$('#figc-count').onchange=draw;draw()}host.scrollIntoView({behavior:'smooth'});$('#cancel-result').onclick=()=>host.innerHTML='';$('#save-result').onclick=async()=>{const btn=$('#save-result');btn.disabled=true;try{const absent=[...document.querySelectorAll('[data-absent]:checked')].map(x=>x.dataset.absent);const played=(m.player_ids||[]).filter(id=>!absent.includes(id));let error;if(isTournament(m)){const position=Number(val('tournament-position'));if(!Number.isInteger(position)||position<1)throw Error('Posizione non valida');const bandMode=val('vu-band-mode');const bands=bandMode==='four'?vuBandsDefault:bandMode==='three'?vuBandsDefault.slice(1):bandMode==='custom'?[...new Set(val('vu-band-names').split(/[\n,;]+/).map(x=>upper(x).trim()).filter(Boolean))]:[];const band=bandMode==='general'?null:val('vu-band-selected');if(bandMode==='custom'&&(!bands.length||bands.length>12||bands.some(x=>x.length>40)))throw Error('Inserisci da 1 a 12 fasce, massimo 40 caratteri ciascuna');if(bands.length&&(!bands.includes(band)||position>4))throw Error('Fascia o posizione non valida');const scorers=[...document.querySelectorAll('[data-goals]')].map(x=>({player_id:x.dataset.goals,goals:Number(x.value)})).filter(x=>x.goals>0||!Number.isInteger(x.goals)||x.goals<0);if(scorers.some(x=>!played.includes(x.player_id)||!Number.isInteger(x.goals)||x.goals<0))throw Error('Gol non validi: un assente non può segnare');const total=scorers.reduce((a,x)=>a+x.goals,0);if(!confirm(`Confermi il ${position}° posto${band?" "+band:""}?\nGol individuali: ${total}\nPartecipanti: ${played.length}\nAssenti: ${absent.length}`))return;({error}=await sb.rpc('vu_save_tournament_bands',{p_match_id:m.id,p_position:position,p_played_ids:played,p_scorers:scorers,p_bands:bands,p_band:band}));}else{const figc=isFigc(m);const periods=figc?Array.from({length:Number(val('figc-count'))},(_,i)=>[Number(document.querySelector(`[data-figc-for="${i}"]`)?.value),Number(document.querySelector(`[data-figc-against="${i}"]`)?.value)]):null;if(figc&&periods.some(p=>p.some(v=>!Number.isInteger(v)||v<0)))throw Error('Gol dei tempi non validi');const [gf,ga]=figc?figcGoals(periods):[Number(val('goals-for')),Number(val('goals-against'))];if(!Number.isInteger(gf)||!Number.isInteger(ga)||gf<0||ga<0)throw Error('Risultato non valido');const scorers=[...document.querySelectorAll('[data-goals]')].map(x=>({player_id:x.dataset.goals,goals:Number(x.value)})).filter(x=>x.goals>0||!Number.isInteger(x.goals));if(scorers.some(x=>!played.includes(x.player_id)||!Number.isInteger(x.goals)))throw Error('Marcatori non validi');if(scorers.reduce((a,x)=>a+x.goals,0)>gf)throw Error('I marcatori superano i gol segnati');if(!confirm(`Confermi il risultato?\nGiocanti: ${played.length}\nAssenti: ${absent.length}`))return;({error}=await sb.rpc(figc?'vu_complete_figc_match':'vu_complete_match',figc?{p_match_id:m.id,p_periods:periods,p_played_ids:played,p_scorers:scorers}:{p_match_id:m.id,p_goals_for:gf,p_goals_against:ga,p_played_ids:played,p_scorers:scorers}));}if(error)throw error;await load();page='history';currentCat=m.category_id;render();toast('Salvato nello storico partite')}catch(e){toast(e.message)}finally{if(btn.isConnected)btn.disabled=false}}}

function formatMessage(m){const dt=new Date(m.match_date+'T12:00:00');const date=isNaN(+dt)?m.match_date:dt.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).toUpperCase();const names=(m.player_ids||[]).map(id=>players.find(p=>p.id===id)).filter(Boolean).sort(sortPlayers);return`ⒸⓄⓃⓋⓄⒸⒶⓏⒾⓄⓃⒺ\n\n⚽️ 𝚃𝙸𝙿𝙾𝙻𝙾𝙶𝙸𝙰 𝙶𝙰𝚁𝙰: ${m.match_type}\n🏟 𝙲𝙰𝙼𝙿𝙾 𝙳𝙰 𝙶𝙸𝙾𝙲𝙾: ${m.field_name}\n${fieldShortLink(m)?'📍 POSIZIONE: '+fieldShortLink(m)+'\n':''}🗓 𝙳𝙰𝚃A: ${date}\n${isTournament(m)?'🏆 TORNEO: '+m.tournament_name:( '🥅 𝙰𝚅𝚅𝙴𝚁𝚂𝙰𝚁𝙸𝙾: '+m.opponent)}\n⏱ 𝙾𝚛𝚊 𝚌𝚘𝚗𝚟𝚘𝚌𝚊𝚣𝚒𝚘𝚗𝚎: ${(m.meeting_time||'').slice(0,5).replace(':',',')}\n⏱ inizio partita : ${(m.kick_off_time||'').slice(0,5).replace(':',',')}\n🎽 𝙲𝚘𝚖𝚙𝚕𝚎𝚝𝚘 𝚐𝚊𝚛𝚊:\n𝑴𝒂𝒈𝒍𝒊𝒂 𝐆𝐀𝐑𝐀  ${m.jersey_color}\n𝑷𝒂𝒏𝒕𝒂𝒍𝒐𝒏𝒄𝒊𝒏𝒊 ${m.shorts_color}\n𝑪𝒂𝒍𝒛𝒆𝒓𝒐𝒕𝒕𝒊 ${m.socks_color}\n⚠️ 𝐀𝐓𝐓𝐄𝐍𝐙𝐈𝐎𝐍𝐄\n${m.notice}\nℂ𝕆ℕ𝕍𝕆ℂ𝔸𝕋𝕀\n${names.map((p,i)=>`${i+1}. ${upper(p.last_name)} ${upper(p.first_name)}`).join('\n')}\n🖋 𝙼𝚒𝚜𝚝𝚎𝚛\n${m.coaches_text}\n#𝚠𝚎𝙻⚽️𝚟𝚎 VOLLAUNITED🔥`}
function preview(m,target){
  const text=formatMessage(m);
  const area=$(target);if(!area)return;
  area.innerHTML=`<section class="panel"><h3>Anteprima WhatsApp</h3><div class="preview">${esc(text)}</div><div class="actions"><button class="btn" type="button" data-action="copy">📋 Copia convocazione completa</button><button class="btn" type="button" data-action="whatsapp">🟢 Condividi WhatsApp</button></div></section>`;
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
async function shareWhatsApp(message){
  if(!message)return toast('Nessun messaggio da condividere');
  // Passa l'intero testo come payload di condivisione, senza url separato:
  // iOS/WhatsApp può altrimenti trasformare la condivisione nel solo collegamento.
  if(navigator.share){
    try{await navigator.share({text:message});return}
    catch(e){if(e.name==='AbortError')return;console.warn('Condivisione nativa:',e)}
  }
  // Fallback per browser che non supportano Web Share.
  window.location.href='https://wa.me/?text='+encodeURIComponent(message);
}


// PRESENZE ALLENAMENTI - una sessione per categoria e data.
async function loadAttendance(){
  vuAttendanceReady=false;
  const [a,b]=await Promise.all([sb.from('training_sessions').select('*').order('training_date',{ascending:false}),sb.from('training_attendance').select('*')]);
  if(a.error||b.error){console.error(a.error||b.error);sessions=[];attendance=[];toast('Configura le tabelle presenze su Supabase');return}
  sessions=a.data||[];attendance=b.data||[];vuAttendanceReady=true;
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
      const rows=Object.fromEntries(ps.map(p=>[p.id,!!document.querySelector(`[data-attend="${p.id}"]`)?.checked]));
      const result=await vuSendAttendance({category:currentCat,date:attendanceDate,session:sess?.id??null,base:vuAttendanceSnapshot(sess),rows});
      if(result==='conflict')throw Error('Registro modificato su un altro dispositivo. Aggiorna le presenze e riprova.');
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

const admin=()=>`<h2>⚙️ Pannello amministratore</h2>${vuFilterAdmin()}<div class="panel"><h3>Categorie</h3><form id="catform" class="row"> <input id="catname" placeholder="Es. 2021 o Under 12" required><button class="btn">+ Aggiungi</button></form>${cats.map(c=>`<div class="item row"><strong>${esc(c.name)}</strong><button type="button" class="btn alt sm" data-action="rename-category" data-id="${c.id}">✏️ Rinomina</button></div>`).join('')}</div><div class="panel"><h3>Crea account mister</h3><form id="userform" class="stack">${field('newname','Nome e cognome')}${field('newuser','Nome utente (lettere, numeri e punti)')}<div class="field"><label>Categorie da assegnare al mister</label>${cats.map(c=>`<div class="row" style="padding:7px 0"><strong>${esc(c.name)}</strong><label><input type="checkbox" style="width:auto" data-newcat="${esc(c.id)}"> Vedi</label><label><input type="checkbox" style="width:auto" data-newcall="${esc(c.id)}"> Convoca</label></div>`).join('')}</div><button class="btn">Genera accesso temporaneo</button></form><div id="credential"></div></div><div class="panel"><h3>Gestisci mister e autorizzazioni</h3><p class="muted">Elimina mister = archivia l’account, senza cancellare convocazioni, allenamenti e presenze.</p>${users.filter(u=>u.role==='coach'&&u.active!==false).map(u=>`<div class="item"><div class="row"><div><strong>${esc(u.full_name)}</strong><small>${esc(u.username)} · ${esc(u.role)}</small></div><div class="actions"><button class="btn alt sm" data-action="edit-coach" data-id="${u.id}">✏️ Modifica</button><button class="btn alt sm" data-action="reset-pass" data-id="${u.id}">Reset password</button>${u.role==='coach'?`<button class="btn alt sm" data-action="delete-coach" data-id="${u.id}">📦 Archivia</button>`:''}</div></div><div style="margin-top:12px">${cats.map(c=>{let a=access.find(a=>a.user_id===u.id&&a.category_id===c.id);return`<div class="row" style="padding:7px 0"><small>${esc(c.name)}</small><label><input type="checkbox" style="width:auto" data-access="${u.id}|${c.id}|view" ${a?'checked':''}> Vedi</label><label><input type="checkbox" style="width:auto" data-access="${u.id}|${c.id}|convocate" ${a?.can_call_up?'checked':''}> Convoca</label></div>`}).join('')}</div></div>`).join('')}</div>${parentAdminPanel()}<div class="panel"><h3>📦 Mister archiviati</h3><p class="muted">Gli account archiviati non vengono cancellati. Tutti i dati storici rimangono nel database.</p>${users.filter(u=>u.role==='coach'&&u.active===false).map(u=>`<div class="item row"><div><strong>${esc(u.full_name)}</strong><small>${esc(u.username)} · Disattivato</small></div><button type="button" class="btn alt sm" data-action="restore-coach" data-id="${u.id}">↩ Riattiva</button></div>`).join('')||'<p class="empty">Nessun mister archiviato.</p>'}</div><p class="muted">Le password temporanee sono visibili soltanto quando vengono generate: consegnale privatamente ai mister.</p>`;
async function save(table,obj,id){let q=id?sb.from(table).update(obj).eq('id',id):sb.from(table).insert(obj);const {error}=await q;if(error)throw error;await load()}
async function adminCall(body){const {data:{session}}=await sb.auth.getSession();const r=await fetch(`${SUPABASE_URL}/functions/v1/manage-users`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,apikey:SUPABASE_ANON_KEY},body:JSON.stringify(body)});const x=await r.json();if(!r.ok)throw Error(x.error||'Operazione non riuscita');return x}

const fmtItalian=d=>d?d.split('-').reverse().join('/') : '';
function distintaForm(m){
 const values={heading:'VOLLA UNITED - '+(m.opponent||''),competition:m.match_type||'',place:m.field_name||'',date:m.match_date||'',time:(m.kick_off_time||'').slice(0,5),assistant:'',assistant_doc:'',accompanying:m.dirigente_text||'',accompanying_doc:'',referee_officer:'',referee_officer_doc:'',coach:matchCoachName(m)==='Non indicato'?'':matchCoachName(m),coach_doc:'',doctor:'',doctor_doc:'',masseur:'',masseur_doc:''};
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
function bind(){document.querySelectorAll('[data-download-player-photo]').forEach(b=>b.addEventListener('click',()=>vuDownloadPlayerPhoto(b.dataset.downloadPlayerPhoto,b)));document.querySelectorAll('[data-callup-response]').forEach(b=>b.onclick=()=>vuSetCallupResponse(b.dataset.matchId,b.dataset.playerId,b.dataset.callupResponse));document.querySelectorAll('[data-action="view-callup"]').forEach(b=>b.onclick=async()=>{await vuLoadCallupResponses();const m=matches.find(x=>x.id===b.dataset.id),host=$('#historydetail');if(m&&host){host.innerHTML=vuCallupRoster(m);vuWireCallupRefresh(host);host.scrollIntoView({behavior:'smooth'})}});document.querySelectorAll('[data-review-player]').forEach(b=>b.onclick=()=>vuReviewPlayerRequest(b.dataset.reviewPlayer,b.dataset.approve==='yes'));document.querySelectorAll('[data-dash-detail]').forEach(b=>b.addEventListener('click',()=>vuDashDetail(b.dataset.dashDetail)));if(me?.role==='admin'&&page==='admin')vuBindFilterAdmin();document.querySelector('#vu-enable-push')?.addEventListener('click',vuEnablePush);document.querySelector('[data-action="open-notifications"]')?.addEventListener('click',()=>{page='notifications';render()});document.querySelector('[data-action="read-all-notifications"]')?.addEventListener('click',vuReadAllNotifications);document.querySelectorAll('[data-birthday-share]').forEach(b=>b.addEventListener('click',()=>vuShareBirthday(b.dataset.birthdayShare)));document.querySelectorAll('[data-notification]').forEach(b=>b.addEventListener('click',()=>vuOpenNotification(b.dataset.notification)));document.querySelectorAll('[data-action="vu-more"]').forEach(b=>b.onclick=()=>{const m=$('#vu-more-menu');if(m)m.hidden=!m.hidden});document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{vuEligibilityContext='';vuAttendanceExceptions.clear();page=b.dataset.page;editing=null;draft=null;selected=[];render()});document.querySelectorAll('[data-action]').forEach(b=>{if(!['open-notifications','read-all-notifications','view-callup'].includes(b.dataset.action))b.onclick=()=>act(b.dataset.action,b.dataset.id)});$('#category')?.addEventListener('change',e=>{currentCat=e.target.value;selected=[];draft=null;render()});document.querySelectorAll('[data-player]').forEach(el=>el.onchange=()=>{const ids=[...document.querySelectorAll('[data-player]:checked')].map(x=>x.dataset.player);try{vuValidateCallup(ids);selected=ids}catch(err){el.checked=false;selected=[...document.querySelectorAll('[data-player]:checked')].map(x=>x.dataset.player);toast(err.message)}$('#count').textContent=selected.length;const n=$('#vu-external-count');if(n)n.textContent=vuExternalCount()});if(page==='attendance')bindAttendance();if(page==='family')bindFamily();if(page==='profile')bindProfile();if(page==='admin')bindParentsAdmin();if($('#playerformreal'))bindPlayer();if($('#matchform')){bindMatchText();vuBindStaffSelectors();vuRefreshEligibility();$('#date')?.addEventListener('change',vuRefreshEligibility)}if($('#matchform'))$('#matchform').onsubmit=async e=>{e.preventDefault();if(vuMatchSaving)return;vuMatchSaving=true;const saveButton=e.currentTarget.querySelector('button[type=submit]');if(saveButton){saveButton.disabled=true;saveButton.textContent='⏳ SALVATAGGIO IN CORSO...';}try{let m=getDraft();if(!m.match_date)throw Error('Inserisci la data');if(!m.match_type)throw Error('Specifica la tipologia gara');if(!m.coaches_text)throw Error('Seleziona il mister assegnato alla categoria');if(m.dirigente_text&&m.dirigente_text===m.coaches_text)throw Error('Mister e dirigente devono essere persone diverse');if(m.match_type==='TORNEO'){if(!m.tournament_name)throw Error('Inserisci il nome del torneo')}else if(!m.opponent)throw Error('Inserisci avversario');const ids=m.player_ids;await loadAttendance();vuValidateCallup(ids);vuValidateTraining(ids);delete m.player_ids;await savePlayingField(m.field_name,$('#field-maps-url')?.value);if(!editing)m.created_by=me.id;let result=editing?await sb.from('matches').update(m).eq('id',editing).select('id').single():vuPendingMatchId?await sb.from('matches').update(m).eq('id',vuPendingMatchId).select('id').single():await sb.from('matches').insert(m).select('id').single();if(result.error)throw result.error;if(!editing)vuPendingMatchId=result.data.id;let tournamentSaveError=null;if(m.match_type==='TORNEO'){try{await saveTournamentName(m.tournament_name)}catch(e){tournamentSaveError=e.message}}rememberOpponent(m.opponent);let opponentSaveError=null;try{await saveOpponentToSupabase(m.opponent)}catch(e){opponentSaveError=e.message}const matchId=result.data.id;const rosterSave=await sb.rpc('vu_replace_match_players',{p_match_id:matchId,p_player_ids:ids});if(rosterSave.error)throw rosterSave.error;page='callhistory';editing=null;draft=null;selected=[];vuPendingMatchId=null;
await load();render();if(tournamentSaveError)toast(tournamentSaveError);
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
toast(opponentSaveError||'Convocazione salvata')}catch(err){toast(err.message)}finally{vuMatchSaving=false;if(saveButton?.isConnected){saveButton.disabled=false;saveButton.textContent='💾 Salva convocazione';}}};if($('#catform'))$('#catform').onsubmit=async e=>{e.preventDefault();try{await save('categories',{name:val('catname')});toast('Categoria aggiunta')}catch(err){toast(err.message)}};if($('#userform'))$('#userform').onsubmit=async e=>{e.preventDefault();const button=$('#userform button[type=submit], #userform button.btn');button.disabled=true;try{const assignments=cats.filter(c=>document.querySelector(`[data-newcat="${c.id}"]`)?.checked||document.querySelector(`[data-newcall="${c.id}"]`)?.checked).map(c=>({category_id:c.id,can_call_up:!!document.querySelector(`[data-newcall="${c.id}"]`)?.checked}));let r=await adminCall({action:'create',username:val('newuser'),full_name:val('newname')});if(!r.temporary_password||!r.user_id)throw Error('Account creato, ma risposta incompleta: non riprovare la creazione. Usa Reset password.');$('#credential').innerHTML=`<div class="item"><strong>Credenziali da consegnare privatamente</strong><p>Utente: ${esc(r.username)}</p><p>Password temporanea: <b>${esc(r.temporary_password)}</b></p><p>Consegna subito la password al mister: non sarà mostrata nuovamente.</p></div>`;if(assignments.length){try{await adminCall({action:'set-categories',user_id:r.user_id,assignments})}catch(err){toast('Account creato, ma categorie non assegnate: '+err.message)}}users=await query('profiles');access=await query('coach_categories');toast('Account creato. Conserva la password temporanea.')}catch(err){toast(err.message)}finally{button.disabled=false}};document.querySelectorAll('[data-access]').forEach(x=>x.onchange=async()=>{const [user_id,category_id,kind]=x.dataset.access.split('|');if(users.find(u=>u.id===user_id)?.role!=='coach'){x.checked=!x.checked;return toast('I permessi admin non si modificano da questa schermata')}if(kind==='convocate'&&x.checked){const view=document.querySelector(`[data-access="${user_id}|${category_id}|view"]`);if(view)view.checked=true}if(kind==='view'&&!x.checked){const call=document.querySelector(`[data-access="${user_id}|${category_id}|convocate"]`);if(call)call.checked=false}const group=[...document.querySelectorAll('[data-access]')].filter(el=>el.dataset.access.startsWith(user_id+'|'));const assignments=cats.filter(c=>{const view=group.find(el=>el.dataset.access===`${user_id}|${c.id}|view`);const call=group.find(el=>el.dataset.access===`${user_id}|${c.id}|convocate`);return view?.checked||call?.checked}).map(c=>({category_id:c.id,can_call_up:!!group.find(el=>el.dataset.access===`${user_id}|${c.id}|convocate`)?.checked}));try{await adminCall({action:'set-categories',user_id,assignments});access=await query('coach_categories');render();toast('Permessi aggiornati')}catch(err){toast(err.message);x.checked=!x.checked}})}
function bindPlayer(){ const cf=$('#fiscalcode');if(cf){cf.maxLength=16;cf.autocomplete='off';cf.style.textTransform='uppercase';cf.addEventListener('input',()=>{cf.value=upper(cf.value).replace(/[^A-Z0-9]/g,'').slice(0,16)})} $('#playerformreal').onsubmit=async e=>{e.preventDefault();const btn=$('#playerformreal button[type="submit"],#playerformreal button.btn');if(btn)btn.disabled=true;try{
 if(!val('firstname')||!val('surname'))throw Error('Nome e cognome obbligatori');
 const role=val('teamrole')||'none';const current=window._editPlayer;
 const targetCat=current&&me?.role==='admin'&&$('#player-category')?val('player-category'):currentCat;
 if(!cats.some(c=>c.id===targetCat))throw Error('Gruppo non valido');
 const conflict=playerDetails.find(d=>d.player_id!==current&&d.team_role===role&&players.some(p=>p.id===d.player_id&&p.category_id===targetCat));
 if(role!=='none'&&conflict)throw Error(`Esiste già un ${role==='captain'?'capitano':'vicecapitano'} in questa categoria: modificalo prima.`);
 const fiscalCode=upper(val('fiscalcode')).replace(/\s+/g,'');
 if(fiscalCode&&!/^[A-Z0-9]{16}$/.test(fiscalCode))throw Error('Il codice fiscale deve contenere 16 caratteri alfanumerici');
 if(fiscalCode&&players.some(p=>p.id!==current&&upper(String(p.fiscal_code||p.codice_fiscale||'').trim())===fiscalCode))throw Error('Codice fiscale già associato a un altro calciatore');
 const obj={category_id:targetCat,first_name:val('firstname'),last_name:val('surname'),birth_date:val('birthday')||null,jersey_number:val('shirt')?Number(val('shirt')):null,primary_role:val('role'),secondary_role:val('role2')||null,fiscal_code:fiscalCode||null};
 if(me?.role==='coach'){if(current)throw Error('La modifica dei dati è riservata all’Admin');const {error}=await sb.rpc('submit_player_request',{p_category_id:targetCat,p_request_type:'add',p_player_id:null,p_player_data:obj});if(error)throw error;window._editPlayer=null;await vuLoadPlayerRequests();render();toast('Richiesta inviata all’Admin');return;}
 const q=current?sb.from('players').update(obj).eq('id',current):sb.from('players').insert(obj);
 const r=await q.select('id').single();if(r.error)throw r.error;
 const d=await sb.from('player_details').upsert({player_id:r.data.id,category_id:targetCat,team_role:role,identity_number:val('identitynumber')||null,figc_number:val('figcnumber')||null},{onConflict:'player_id'});
 if(d.error)throw Error('Calciatore salvato, ma dettagli non salvati: '+d.error.message);
 if($('#playerphoto')?.files?.length){await uploadPlayerPhoto(r.data.id,$('#playerphoto').files[0]);toast('Foto del calciatore caricata')}window._editPlayer=null;currentCat=targetCat;await load();toast('Calciatore salvato');
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
if(action==='export-roster'){await exportRosterPdf();return}if(action==='logout'){if(hasOffline()&&!confirm('Uscendo elimini da questo dispositivo l’archivio offline e le presenze ancora in attesa di invio. Continuare?'))return;await sb.auth.signOut();me=null;page='home';editing=null;draft=null;selected=[];currentCat='';login();return}if(action==='new-player'||action==='edit-player'){if(me?.role==='coach'&&action==='edit-player')throw Error('Modifica riservata all’Admin');let p=players.find(p=>p.id===id);window._editPlayer=p?.id||null;$('#playerform').innerHTML=playerForm(p);bindPlayer();$('#playerform').scrollIntoView({behavior:'smooth'});$('#playerform [data-action="close-player"]').onclick=()=>$('#playerform').innerHTML='';return}if(action==='close-player'){$('#playerform').innerHTML='';return}if(action==='toggle-player-active'){if(me?.role!=='admin')throw Error('Operazione riservata all’amministratore');const p=players.find(x=>x.id===id);if(!p)throw Error('Calciatore non trovato');const next=p.active===false;if(!confirm((next?'Riattivare ':'Disattivare ')+fullName(p)+'? Lo storico verrà conservato.'))return;const r=await sb.rpc('vu_admin_set_player_active',{p_player_id:id,p_active:next});if(r.error)throw r.error;await load();render();toast(next?'Calciatore riattivato':'Calciatore disattivato');return}
if(action==='delete-player'){const p=players.find(x=>x.id===id);if(!p)throw Error('Calciatore non trovato');if(me?.role==='coach'){if(!permitted().includes(p.category_id))throw Error('Calciatore non autorizzato');if(!confirm('Inviare richiesta di rimozione di '+fullName(p)+' all’Admin?'))return;const r=await sb.rpc('submit_player_request',{p_category_id:p.category_id,p_request_type:'remove',p_player_id:p.id,p_player_data:{}});if(r.error)throw r.error;await vuLoadPlayerRequests();toast('Richiesta di rimozione inviata');return;}if(me?.role!=='admin')throw Error('Eliminazione riservata all’amministratore');const name=fullName(p);const category=cats.find(c=>c.id===p.category_id)?.name||'';if(!confirm('ELIMINAZIONE DEFINITIVA\\n'+name+' — '+category+'\\nSaranno cancellati anche convocazioni, presenze, statistiche e collegamenti personali. Continuare?'))return;const typed=prompt('ULTIMA CONFERMA: scrivi ELIMINA per cancellare definitivamente '+name);if(typed!=='ELIMINA'){toast('Eliminazione annullata');return;}const r=await sb.rpc('vu_admin_delete_player',{p_player_id:id});if(r.error)throw r.error;await load();render();toast('Calciatore e dati collegati eliminati');return}
if(action==='preview'){preview(getDraft(),'#previewarea');return}if(action==='edit-match'){const m=matches.find(x=>x.id===id);if(!m||m.status==='completed'||!(me.role==='admin'||allowed(m.category_id,'convocate')))return toast('Modifica non autorizzata');vuEligibilityContext='';vuAttendanceExceptions.clear();editing=m.id;currentCat=m.category_id;draft={...m};selected=[...(m.player_ids||[])];page='matches';render();const cat=$('#category');if(cat){cat.disabled=true;cat.title='La categoria non può essere modificata per una convocazione già salvata'}return;}if(action==='result-match'){const m=matches.find(x=>x.id===id);if(!m||!(me.role==='admin'||allowed(m.category_id,'convocate')))return toast('Non autorizzato');openResult(m);return}if(action==='view-match'){const m=matches.find(x=>x.id===id);if(!m)return;const host=$('#historydetail')||$('#profile-match-detail');if(!host)return;host.innerHTML=matchDetail(m)+(me.role!=='parent'?`<div class="actions"><button class="btn alt" id="edit-result">Modifica risultato</button><button class="btn alt" id="delete-result">Elimina partita</button></div>`:'');host.scrollIntoView({behavior:'smooth'});if(me.role!=='parent'){const edit=$('#edit-result');if(edit)edit.onclick=()=>{if(me.role!=='admin'&&!allowed(m.category_id,'convocate'))return toast('Non autorizzato');page='history';currentCat=m.category_id;render();openResult(m)};const del=$('#delete-result');if(del)del.onclick=async()=>{if(me.role!=='admin'&&!allowed(m.category_id,'convocate'))return toast('Non autorizzato');if(!confirm('Eliminare definitivamente la partita e tutte le statistiche collegate?'))return;const r=await sb.from('matches').delete().eq('id',m.id);if(r.error)return toast(r.error.message);await load()}}return}if(action==='delete-match'){const m=matches.find(x=>x.id===id);if(!m||!(me.role==='admin'||allowed(m.category_id,'convocate')))return toast('Non autorizzato');if(!confirm('Eliminare definitivamente questa convocazione?'))return;const r=await sb.from('matches').delete().eq('id',id);if(r.error)throw r.error;await load();return}if(action==='copy'){await copyMessage(window._previewText);return}if(action==='whatsapp'){shareWhatsApp(window._previewText);return}if(action==='edit-parent'||action==='archive-parent'||action==='restore-parent'||action==='reset-parent'||action==='children-parent'){await parentAdminAction(action,id);return}if(action==='rename-category'){
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
const vuPhotoUrlCache=new Map();
async function loadFamilyData(){
  const {data,error}=await sb.from('player_photos').select('*');
  if(error)throw error;
  playerPhotos=data||[];
  parentChildIds=me.role==='parent'?players.map(p=>p.id):[];
  photoUrls={};
  await Promise.all(playerPhotos.map(async p=>{
    if(!p.storage_path)return;
    const cached=vuPhotoUrlCache.get(p.storage_path);
    if(cached&&cached.expires>Date.now()){photoUrls[p.player_id]=cached.url;return}
    const {data:signed,error:signError}=await sb.storage.from('volla-player-photos').createSignedUrl(p.storage_path,3600);
    if(!signError&&signed?.signedUrl){photoUrls[p.player_id]=signed.signedUrl;vuPhotoUrlCache.set(p.storage_path,{url:signed.signedUrl,expires:Date.now()+50*60*1000})}
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

// Filtri animati: sulla sezione superiore del profilo ufficiale.
const vuFilterNames={off:'Nessuno',christmas:'❄️ Natale',newyear:'🎆 Capodanno',easter:'🐣 Pasqua',mother:'💗 Festa della mamma',father:'💙 Festa del papà',summer:'☀️ Estate',halloween:'🎃 Halloween',carnival:'🎭 Carnevale',birthday:'🎂 Compleanno'};
let vuFilterSettings={mode:'auto',filter:'off'},vuFilterPreview=null;
function vuEaster(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;return new Date(y,Math.floor(n/31)-1,n%31+1)}
function vuFilterToday(p){const now=new Date(),y=now.getFullYear(),mo=now.getMonth()+1,day=now.getDate(),bd=String(p.birth_date||'').slice(5);if(bd===`${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`)return 'birthday';if((mo===12&&day===31)||(mo===1&&day===1))return 'newyear';if(mo===12||(mo===1&&day<=6))return 'christmas';const easter=vuEaster(y),delta=Math.round((new Date(y,mo-1,day)-easter)/86400000);if(delta>=-2&&delta<=1)return 'easter';if(mo===5&&day===new Date(y,4,8+(7-new Date(y,4,8).getDay())%7).getDate())return 'mother';if(mo===3&&day===19)return 'father';if(mo>=6&&mo<=8)return 'summer';if(mo===10&&day>=25&&day<=31)return 'halloween';if(delta===-47||delta===-46)return 'carnival';return 'off'}
function vuActiveFilter(p){const today=vuFilterToday(p);if(today==='birthday')return today;if(vuFilterPreview!==null&&me?.role==='admin')return vuFilterPreview;return vuFilterSettings.mode==='manual'?vuFilterSettings.filter:today}
async function vuLoadFilters(){try{const {data,error}=await sb.from('vu_photo_filter_settings').select('mode,filter').eq('id',1).maybeSingle();if(error)throw error;if(data)vuFilterSettings=data}catch(e){console.warn('Filtri foto: eseguire SQL di configurazione',e)}}
function vuFilterAdmin(){return `<section class="panel"><h3>🎨 Filtri foto animati</h3><p class="muted">Effetti sulla parte superiore dei profili calciatore. Il compleanno di ogni bambino è sempre automatico.</p><div class="field"><label>Modalità</label><select id="vu-filter-mode"><option value="auto" ${vuFilterSettings.mode==='auto'?'selected':''}>Automatica (calendario)</option><option value="manual" ${vuFilterSettings.mode==='manual'?'selected':''}>Manuale</option></select></div><div class="field"><label>Filtro manuale / prova</label><select id="vu-filter-select">${Object.entries(vuFilterNames).map(([v,n])=>`<option value="${v}" ${vuFilterSettings.filter===v?'selected':''}>${n}</option>`).join('')}</select></div><div class="actions"><button type="button" class="btn alt" id="vu-filter-test">👁 Prova sul mio dispositivo</button><button type="button" class="btn" id="vu-filter-save">💾 Salva per tutti</button><button type="button" class="btn alt" id="vu-filter-clear">Termina prova</button></div><p class="muted">Per provare, scegli il filtro e apri Profilo calciatore. La prova non modifica le impostazioni degli altri utenti.</p></section>`}
function vuBindFilterAdmin(){const test=document.querySelector('#vu-filter-test'),save=document.querySelector('#vu-filter-save'),clear=document.querySelector('#vu-filter-clear');if(test)test.onclick=()=>{vuFilterPreview=document.querySelector('#vu-filter-select').value;toast('Prova attiva: apri Profilo calciatore')};if(clear)clear.onclick=()=>{vuFilterPreview=null;toast('Prova terminata')};if(save)save.onclick=async()=>{save.disabled=true;try{const mode=document.querySelector('#vu-filter-mode').value,filter=document.querySelector('#vu-filter-select').value;const {error}=await sb.from('vu_photo_filter_settings').upsert({id:1,mode,filter});if(error)throw error;vuFilterSettings={mode,filter};vuFilterPreview=null;toast('Filtri salvati per tutti')}catch(e){toast('Errore salvataggio: '+e.message)}finally{save.disabled=false}}}
const vuFilterMessages={christmas:'🎄 BUON NATALE!',newyear:'🎆 BUON ANNO!',easter:'🐣 BUONA PASQUA!',mother:'💗 AUGURI A TUTTE LE MAMME!',father:'💙 AUGURI A TUTTI I PAPÀ!',summer:'☀️ BUONA ESTATE!',halloween:'🎃 BUON HALLOWEEN!',carnival:'🎭 BUON CARNEVALE!',birthday:'🎂 BUON COMPLEANNO!'};
const vuFilterCss=`<style>
.vu-photo-frame{position:relative;display:table;max-width:min(100%,420px);margin:18px auto;overflow:hidden;border-radius:16px;background:#171219;isolation:isolate}
.vu-photo-frame .vu-player-photo{display:block;width:100%;max-width:100%;max-height:540px;margin:0;border-radius:0}
.vu-photo-overlay{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:2}
.vu-photo-particle{position:absolute;left:var(--x);top:-12%;font-size:var(--sz);line-height:1;opacity:0;will-change:transform,opacity;animation:vu-photo-fall var(--dur) linear infinite;animation-delay:var(--delay);filter:none;backface-visibility:hidden;contain:layout style paint}
@keyframes vu-photo-fall{0%{transform:translate3d(0,-30px,0) rotate(0);opacity:0}12%{opacity:.92}85%{opacity:.92}100%{transform:translate3d(var(--drift),var(--vu-fall-distance,650px),0) rotate(280deg);opacity:0}}
.vu-photo-overlay[data-filter="newyear"] .vu-photo-particle{top:var(--y);animation:vu-photo-firework var(--dur) ease-in-out infinite;animation-delay:var(--delay);filter:drop-shadow(0 0 5px #ffe18b)}
@keyframes vu-photo-firework{0%,100%{transform:translate3d(0,0,0) scale(.2);opacity:0}22%{opacity:0}45%{transform:translate3d(var(--drift),-18px,0) scale(1.5);opacity:1}65%{transform:translate3d(calc(var(--drift) * -1),15px,0) scale(.8);opacity:.95}85%{opacity:0}}
.vu-photo-overlay[data-filter="summer"] .vu-photo-particle{top:var(--y);animation:vu-photo-summer var(--dur) ease-in-out infinite;animation-delay:var(--delay);filter:drop-shadow(0 0 6px #ffe17c)}
@keyframes vu-photo-summer{0%,100%{transform:translate3d(-10px,18px,0) scale(.65);opacity:.15}45%{transform:translate3d(12px,-22px,0) scale(1.35);opacity:1}70%{opacity:.75}}
.vu-photo-overlay[data-filter="summer"]:before{content:'';position:absolute;inset:0;background:linear-gradient(125deg,transparent 12%,#ffe98b24 34%,transparent 55%,#fff1b31c 72%,transparent 90%);animation:vu-photo-rays 5s ease-in-out infinite alternate}
@keyframes vu-photo-rays{from{transform:translateX(-22%);opacity:.3}to{transform:translateX(22%);opacity:.9}}
.vu-photo-greeting{position:absolute;bottom:5%;left:5%;right:5%;z-index:3;text-align:center;color:#fff;font-size:clamp(12px,3.5vw,19px);font-weight:900;letter-spacing:.5px;text-shadow:0 2px 5px #000,0 0 12px #000;animation:vu-photo-greeting 3s ease-in-out infinite alternate;pointer-events:none}
.vu-photo-greeting span{display:inline-block;max-width:100%;padding:8px 12px;border-radius:12px;background:#170e17a8;border:1px solid #ffffff55}
@keyframes vu-photo-greeting{from{transform:scale(.97);opacity:.85}to{transform:scale(1.04);opacity:1}}
.vu-club-hero>.vu-photo-overlay{z-index:4;inset:0;border-radius:inherit}
.vu-club-hero>.vu-photo-greeting{z-index:5;bottom:14px;left:14px;right:14px;font-size:clamp(13px,3.5vw,18px);animation:none}
.vu-club-hero:has(>.vu-photo-greeting){padding-bottom:88px!important}
.vu-club-hero>.vu-photo-greeting span{display:block;width:100%;box-sizing:border-box;padding:12px 8px;background:linear-gradient(100deg,#3b071eeb,#78152aeb,#3b071eeb);border:1px solid #f3cb8588;border-radius:12px;box-shadow:0 0 18px #ffba3838;text-shadow:0 2px 5px #000;letter-spacing:1px}
.vu-fireworks-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
.vu-club-hero>.vu-photo-overlay .vu-photo-particle{animation-name:vu-hero-fall}
.vu-club-hero>.vu-photo-overlay[data-filter="newyear"] .vu-photo-particle{animation-name:vu-photo-firework}
.vu-club-hero>.vu-photo-overlay[data-filter="summer"] .vu-photo-particle{animation-name:vu-photo-summer}
@keyframes vu-hero-fall{0%{transform:translate3d(0,-20px,0) rotate(0);opacity:0}12%{opacity:.92}85%{opacity:.92}100%{transform:translate3d(var(--drift),var(--vu-fall-distance,650px),0) rotate(280deg);opacity:0}}
@media(prefers-reduced-motion:reduce){.vu-photo-particle,.vu-photo-greeting,.vu-photo-overlay[data-filter="summer"]:before{animation:none;opacity:.65}}
</style>`;
function vuPhotoParticles(filter){
 const symbols={christmas:['❄','❅','❆'],newyear:['✦','✨','✧','✷','✹','🎆'],easter:['🌸','🦋','🌼'],mother:['💗','🌸','💕'],father:['💙','⭐','✨'],summer:['✦','✨','☀','✧','🌟'],halloween:['🦇','🎃','✦'],carnival:['🎊','✦','●'],birthday:['🎈','🎉','🎊']}[filter];
 if(!symbols)return '';
 const count=filter==='newyear'?0:70; // 70 elementi; Capodanno usa Canvas
 const particles=Array.from({length:count},(_,i)=>{
  const x=(i*47+13)%96,y=8+(i*29)%78,sz=12+(i*7)%15,dur=filter==='newyear'?2.3+(i%6)*.4:filter==='summer'?3+(i%7)*.6:4+(i%8)*.7,delay=-(i*.83)%9,drift=(i%2?1:-1)*(15+(i*13)%80);
  return `<span class="vu-photo-particle" style="--x:${x}%;--y:${y}%;--sz:${sz}px;--dur:${dur}s;--delay:${delay}s;--drift:${drift}px">${symbols[i%symbols.length]}</span>`;
 }).join('');
 return `<div class="vu-photo-overlay" data-filter="${filter}" aria-hidden="true">${filter==='newyear'?'<canvas class="vu-fireworks-canvas" aria-hidden="true"></canvas>':''}${particles}</div><div class="vu-photo-greeting" aria-label="${esc(vuFilterMessages[filter])}"><span>${esc(vuFilterMessages[filter])}</span></div>`;
}
// Fuochi d'artificio Canvas: razzi, scie, esplosioni e gravita, confinati al profilo.
const vuFireworksRunning=new WeakMap();
function vuStartFireworks(canvas){
 if(!canvas||vuFireworksRunning.has(canvas))return;
 const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return;
 let width=0,height=0,rockets=[],sparks=[],frame=0,last=0,launchAt=0,alive=true;
 const palette=['#ffcc69','#ffe7ad','#fff9eb','#ff425d','#ff7c49','#f8c331','#ffffff'];
 const random=(a,b)=>a+Math.random()*(b-a);
 function resize(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;const dpr=Math.min(window.devicePixelRatio||1,2);width=r.width;height=r.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
 function launch(){if(width<10||height<10)return;const x=random(width*.15,width*.85),targetY=random(height*.12,height*.57);rockets.push({x,y:height+8,px:x,py:height+8,vx:random(-.65,.65),vy:random(-10.8,-8.2),targetY,hue:palette[Math.floor(random(0,palette.length))],trail:[]})}
 function burst(r){if(sparks.length>850)sparks.splice(0,sparks.length-850);const n=80+Math.floor(Math.random()*31),power=random(2.2,4.9),base=palette[Math.floor(random(0,palette.length))];for(let i=0;i<n;i++){const a=Math.PI*2*i/n+random(-.13,.13),speed=power*random(.48,1.23),color=Math.random()<.68?base:palette[Math.floor(random(0,palette.length))];sparks.push({x:r.x,y:r.y,px:r.x,py:r.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:random(42,85),max:85,color,size:random(.8,2.1),drag:random(.969,.988)})}}
 function draw(t){if(!alive)return;if(!canvas.isConnected){alive=false;vuFireworksRunning.delete(canvas);return}if(document.hidden){last=t;requestAnimationFrame(draw);return}if(!width||!height)resize();if(!width||!height){requestAnimationFrame(draw);return}const dt=Math.min(2.0,(t-last||16.7)/16.7);last=t;frame+=dt;ctx.clearRect(0,0,width,height);ctx.globalCompositeOperation='lighter';
 if(t>=launchAt){launch();if(Math.random()<.42)launch();launchAt=t+random(330,650)}
 for(let i=rockets.length-1;i>=0;i--){const r=rockets[i];r.px=r.x;r.py=r.y;r.x+=r.vx*dt;r.y+=r.vy*dt;r.vy+=.09*dt;r.trail.push({x:r.x,y:r.y});if(r.trail.length>14)r.trail.shift();for(let j=1;j<r.trail.length;j++){const a=r.trail[j-1],b=r.trail[j];ctx.strokeStyle=`rgba(255,207,122,${j/r.trail.length*.78})`;ctx.lineWidth=1.6*j/r.trail.length;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.fillStyle='#fff5d9';ctx.beginPath();ctx.arc(r.x,r.y,2.5,0,Math.PI*2);ctx.fill();if(r.y<=r.targetY||r.vy>=-1){burst(r);rockets.splice(i,1)}}
 for(let i=sparks.length-1;i>=0;i--){const s=sparks[i];s.px=s.x;s.py=s.y;s.x+=s.vx*dt;s.y+=s.vy*dt;s.vx*=Math.pow(s.drag,dt);s.vy=s.vy*Math.pow(s.drag,dt)+.058*dt;s.life-=dt;if(s.life<=0){sparks.splice(i,1);continue}const a=Math.min(1,s.life/24);ctx.globalAlpha=a;ctx.strokeStyle=s.color;ctx.lineWidth=s.size;ctx.beginPath();ctx.moveTo(s.px,s.py);ctx.lineTo(s.x,s.y);ctx.stroke();if(i%4===0){ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(s.x,s.y,s.size*.8,0,Math.PI*2);ctx.fill()}}
 ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';requestAnimationFrame(draw)}
 resize();vuFireworksRunning.set(canvas,true);requestAnimationFrame(draw);
}
function vuInitProfileFireworks(){
 document.querySelectorAll('.vu-club-hero .vu-fireworks-canvas').forEach(vuStartFireworks);
 document.querySelectorAll('.vu-club-hero > .vu-photo-overlay, .vu-photo-frame > .vu-photo-overlay').forEach(overlay=>{
  const h=overlay.getBoundingClientRect().height;
  if(h>0)overlay.style.setProperty('--vu-fall-distance',Math.ceil(h*1.22+50)+'px');
 });
}
if(typeof document!=='undefined'){
 const vuWatchFireworks=()=>{vuInitProfileFireworks();const observer=new MutationObserver(()=>vuInitProfileFireworks());observer.observe(document.body,{childList:true,subtree:true})};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',vuWatchFireworks,{once:true});else vuWatchFireworks();
}
const vuProfilePhotoCss=`<style>
.vu-photo-download-wrap{display:flex;justify-content:center;padding:12px 12px 18px}
.vu-photo-download{display:inline-flex;align-items:center;justify-content:center;gap:10px;width:min(100%,360px);padding:13px 18px;border:1px solid #bb566c;border-radius:13px;background:linear-gradient(135deg,#601a31,#27141f);color:#fff;font-size:12px;font-weight:800;letter-spacing:.65px;box-shadow:0 6px 20px #0003;cursor:pointer}
.vu-photo-download span{font-size:21px;line-height:1}
.vu-photo-download:disabled{opacity:.65;cursor:wait}
.vu-photo-download:focus-visible{outline:3px solid #ffc5d2;outline-offset:3px}
/* Download allineato sotto la fotografia, nella colonna sinistra del profilo */
.vu-club-stage>.vu-photo-download-wrap{grid-column:1!important;grid-row:2!important;display:flex!important;align-items:flex-start!important;justify-content:stretch!important;padding:9px 0 0!important;margin:0!important;min-width:0!important;position:relative;z-index:4}
.vu-club-stage>.vu-photo-download-wrap .vu-photo-download{width:100%!important;min-width:0!important;padding:11px 5px!important;border-radius:10px!important;font-size:clamp(8px,1.8vw,11px)!important;letter-spacing:0!important;gap:5px!important;line-height:1.25!important;white-space:normal!important}
.vu-club-stage>.vu-photo-download-wrap .vu-photo-download span{font-size:17px!important}
.vu-club-stage>.vu-club-number-wrap{grid-row:1 / span 2!important}


.vu-player-photo{display:block;width:100%;max-width:420px;max-height:540px;object-fit:contain;object-position:center;margin:18px auto;border-radius:16px;background:#171219}
.vu-player-photo-empty{max-width:420px;min-height:180px;margin:18px auto;display:flex;align-items:center;justify-content:center;border:1px dashed #876d77;border-radius:16px;color:#bfaeb6;text-align:center;padding:18px}
</style>`;
function playerProfilePhoto(p){const src=photoOf(p.id);return src?`${vuFilterCss}<div class="vu-photo-frame"><img class="vu-player-photo" src="${esc(src)}" alt="Foto di ${esc(fullName(p))}">${vuPhotoParticles(vuActiveFilter(p))}</div>`:'<div class="vu-player-photo-empty">Foto non ancora caricata dal mister o dall’amministratore.</div>'}
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

function vuIsUpcomingCallup(m,playerId,today){
 return m.player_ids?.includes(playerId)&&m.status!=='completed'&&m.match_date>=today;
}
function familyPage(){
 const p=players.find(x=>x.id===activeChild);
 if(!p)return `<section class="panel"><h2>👨‍👩‍👧‍👦 Area famiglie</h2><p>Nessun bambino associato a questo account. Contatta l'amministratore.</p></section>`;
 const hasCallup=matches.some(m=>vuIsUpcomingCallup(m,p.id,vuDashToday()));
 return `${vuProfilePhotoCss}${hasCallup?'':vuPushActivation()}<h2>👨‍👩‍👧‍👦 I miei figli</h2>${players.length>1?`<div class="field"><label>Seleziona bambino</label><select id="child-select">${players.map(x=>`<option value="${x.id}" ${x.id===p.id?'selected':''}>${esc(x.first_name+' '+x.last_name)}</option>`).join('')}</select></div>`:''}${playerFamilyContent(p)}`;
}
// Riepilogo della stagione sportiva: dal 1 settembre al 31 agosto.
function vuSeasonSummary(p){
 const today=new Date(),startYear=today.getMonth()>=8?today.getFullYear():today.getFullYear()-1;
 const start=`${startYear}-09-01`,end=`${startYear+1}-08-31`;
 const completed=matches.filter(m=>m.status==='completed'&&m.match_date>=start&&m.match_date<=end);
 const played=completed.filter(m=>m.played_ids?.includes(p.id));
 const training=sessions.filter(s=>s.category_id===p.category_id&&s.training_date>=start&&s.training_date<=end);
 const entries=training.map(s=>attendance.find(a=>a.session_id===s.id&&a.player_id===p.id)).filter(Boolean);
 const present=entries.filter(a=>a.present).length;
 const goals=id=>completed.filter(m=>m.played_ids?.includes(id)).reduce((sum,m)=>sum+(matchScorersFor(m).find(x=>x.player_id===id)?.goals||0),0);
 const myGoals=goals(p.id),keeper=p.primary_role==='Portiere';
 const categoryPlayers=players.filter(x=>x.category_id===p.category_id&&x.primary_role!=='Portiere');
 const best=Math.max(0,...categoryPlayers.map(x=>goals(x.id)));
 const topScorer=!keeper&&myGoals>0&&myGoals===best;
 // Clean sheet di squadra: nessun gol subito nella partita giocata.
 // Per i tornei con solo piazzamento non esiste un risultato difensivo verificabile.
 const cleanSheets=played.filter(m=>!isTournament(m)&&Number(m.goals_against)===0).length;
 const tournaments=played.filter(isTournament);
 return `<section class="panel"><h3>🏆 Riepilogo stagione ${startYear}/${startYear+1}</h3>
 ${topScorer?'<p style="font-weight:800;color:#ffcf65">🥇 Capocannoniere della categoria</p>':''}
 <div class="grid"><div class="item"><strong>${played.length}</strong><small>Partite giocate</small></div>
 <div class="item"><strong>${present}/${entries.length}</strong><small>Allenamenti presenti</small></div>
 <div class="item"><strong>${entries.length?Math.round(100*present/entries.length):0}%</strong><small>Presenza allenamenti</small></div>
 <div class="item"><strong>${keeper?cleanSheets:myGoals}</strong><small>${keeper?'Clean sheet di squadra':'Gol segnati'}</small></div>
 <div class="item"><strong>${tournaments.length}</strong><small>Tornei disputati</small></div></div>
 ${keeper?'<p class="muted">Clean sheet conteggiati solo nelle partite giocate con zero gol subiti dalla squadra. Non attestano i minuti effettivi in porta.</p>':''}
 </section>`;
}
const vuLuxuryProfileCss=`<style>
.vu-club{overflow:hidden;border:1px solid #632536;border-radius:22px;background:#0d0d12;color:#fff;box-shadow:0 16px 42px #0007;margin:12px 0 18px}
.vu-club *{box-sizing:border-box}
.vu-club-hero{position:relative;overflow:hidden;min-height:440px;padding:23px 18px 22px;background:radial-gradient(ellipse at 92% 32%,#9b173a 0%,#421325 39%,#11131c 76%);display:flex;flex-direction:column;justify-content:space-between}
.vu-club-hero:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(132deg,transparent 0 70px,#0002 71px 89px,transparent 90px 160px);pointer-events:none}
.vu-club-brand{position:relative;z-index:3;display:flex;align-items:center;gap:10px;font-size:10px;letter-spacing:1.7px;font-weight:850;color:#f5e6eb}
.vu-club-brand img{width:45px;height:45px;object-fit:contain}
.vu-club-stage{position:relative;flex:1;display:flex;align-items:flex-start;min-height:480px}
.vu-club-number{position:absolute;right:-2px;top:13px;font-size:clamp(100px,31vw,165px);line-height:1;font-weight:950;letter-spacing:-12px;color:transparent;-webkit-text-stroke:2px #ffffff60;text-shadow:0 0 30px #ed264e44}
.vu-club-number-wrap{position:absolute;right:0;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;width:43%;z-index:2}.vu-club-number-wrap .vu-club-number{position:static;font-size:clamp(76px,24vw,135px);letter-spacing:-6px}.vu-club-surname{font-size:clamp(13px,3.7vw,23px);font-weight:950;letter-spacing:1.3px;color:transparent;-webkit-text-stroke:1px #f7e5e9;text-align:center;overflow-wrap:anywhere;line-height:1.1;text-shadow:0 0 15px #eb2b5155}.vu-club-bio{display:flex;flex-direction:column;gap:10px;width:100%;margin-top:16px;padding:13px 3px 0;border-top:1px solid #ffffff42;text-align:center}.vu-club-bio-item{display:flex;flex-direction:column;gap:4px}.vu-club-bio-item span{font-size:9px;letter-spacing:1px;color:#d6b7c0;font-weight:750}.vu-club-bio-item strong{font-size:11px;font-weight:850;color:#fff;overflow-wrap:anywhere}
.vu-club-person{position:relative;z-index:1;width:61%;max-height:400px;object-fit:contain;object-position:left top;filter:drop-shadow(0 12px 18px #0009);margin:0;align-self:flex-start}
.vu-club-identity{position:relative;z-index:2;margin-top:-4px;text-shadow:0 3px 12px #000a}
.vu-club-identity strong{display:block;font-size:clamp(31px,8vw,48px);line-height:.98;letter-spacing:-1.5px;font-weight:950;overflow-wrap:anywhere}
.vu-club-identity small{display:block;margin-top:13px;font-size:12px;font-weight:800;letter-spacing:1.2px;color:#f3e0e5}
.vu-club-line{height:3px;width:90px;background:linear-gradient(90deg,#ff244f,#f0c4ca);margin:14px 0}
.vu-club-section{padding:20px 17px;border-top:1px solid #59202e;background:linear-gradient(110deg,#171218,#0c0d12)}
.vu-club-title{font-size:15px;font-weight:900;letter-spacing:.7px;margin-bottom:15px;display:flex;align-items:center;gap:10px}
.vu-club-title span{color:#f3c86b}
.vu-club-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0}
.vu-club-stat{text-align:center;padding:8px 4px;border-right:1px solid #ffffff29}
.vu-club-stat:last-child{border-right:0}
.vu-club-stat strong{display:block;font-size:clamp(27px,8vw,40px);font-weight:900;line-height:1.15;font-variant-numeric:tabular-nums}
.vu-club-stat small{display:block;margin-top:8px;color:#d9c7cc;font-size:9px;font-weight:750;letter-spacing:.5px}
.vu-club-award{border:1px solid #9a743a;border-radius:13px;padding:14px;background:linear-gradient(120deg,#3d2818,#17131a 72%);color:#ffdf93;font-size:12px;font-weight:850;text-align:center;letter-spacing:.5px}
.vu-club-sub{font-size:11px;color:#b9a8ae;margin-top:10px}
.vu-club-tag{display:inline-block;margin-top:12px;background:#2a1821;border:1px solid #ffffff4a;border-radius:30px;padding:7px 11px;font-size:10px;font-weight:800;letter-spacing:.6px}
@media(min-width:720px){.vu-club-hero{min-height:480px}.vu-club-person{max-height:390px;width:54%}.vu-club-number{font-size:135px}.vu-club-section{padding:24px 27px}}
@media(prefers-reduced-motion:no-preference){.vu-club{animation:vuClubAppear .45s ease-out both}@keyframes vuClubAppear{from{opacity:.5;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}}

/* PROFILO V3: impaginazione stabile su iPhone, senza spazi vuoti */
.vu-club-hero{min-height:0!important;display:block!important;padding:18px 14px 22px!important}
.vu-club-brand{margin-bottom:14px}
.vu-club-stage{display:grid!important;grid-template-columns:minmax(0,1.12fr) minmax(0,.88fr)!important;align-items:start!important;gap:12px!important;min-height:0!important;flex:none!important}
.vu-club-person{grid-column:1;grid-row:1;position:relative!important;width:100%!important;max-height:none!important;height:auto!important;object-fit:contain!important;object-position:top center!important;align-self:start!important;display:block!important;margin:0!important;border-radius:5px}
.vu-club-number-wrap{grid-column:2;grid-row:1;position:relative!important;right:auto!important;top:auto!important;transform:none!important;width:100%!important;max-width:none!important;z-index:2;display:flex!important;flex-direction:column!important;justify-content:flex-start!important;align-items:center!important;gap:0!important;min-width:0}
.vu-club-number-wrap .vu-club-number{position:static!important;display:block!important;width:100%;font-family:Arial,Helvetica,sans-serif!important;font-size:clamp(56px,17vw,110px)!important;font-weight:900!important;font-style:normal!important;letter-spacing:-3px!important;line-height:1!important;text-align:center!important;color:#fff!important;-webkit-text-stroke:0!important;text-shadow:0 3px 14px #0006!important}
.vu-club-surname{font-family:Arial,Helvetica,sans-serif!important;font-size:clamp(12px,3.4vw,20px)!important;letter-spacing:.6px!important;line-height:1.2!important;color:#fff!important;-webkit-text-stroke:0!important;text-shadow:none!important;font-weight:850!important;margin:4px 0 10px!important;overflow-wrap:anywhere}
.vu-club-bio{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:9px!important;margin:0!important;padding:12px 0 0!important;border-top:1px solid #ffffff55!important;text-align:center!important}
.vu-club-bio-item{display:flex!important;flex-direction:column!important;gap:2px!important;min-width:0}
.vu-club-bio-item span{font-size:clamp(8px,2vw,10px)!important;letter-spacing:.35px!important;line-height:1.3!important}
.vu-club-bio-item strong{font-size:clamp(10px,2.6vw,13px)!important;line-height:1.3!important;overflow-wrap:anywhere}
.vu-club-identity{margin-top:14px!important}
.vu-club-identity strong{font-size:clamp(29px,7.5vw,44px)!important}
@media(min-width:720px){.vu-club-stage{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:25px!important}.vu-club-person{max-height:500px!important}.vu-club-number-wrap .vu-club-number{font-size:130px!important}.vu-club-bio{gap:13px!important}}
</style>`;
function vuLuxuryHero(p,playedCount,goalsCount,attendancePct,trainingPresent=0){
 const category=upper(cats.find(c=>c.id===p.category_id)?.name||'');
 const role=upper(p.primary_role||'CALCIATORE');
 const isKeeper=p.primary_role==='Portiere';
 const src=photoOf(p.id);
 const qualification=detailOf(p.id).team_role;
 const birth=p.birth_date?dateIt(p.birth_date):"NON INDICATA";
 // Compatibilità con il nome effettivo del campo importato in Supabase.
 const fiscal=String(p.codice_fiscale||p.fiscal_code||p.tax_code||p.codicefiscale||detailOf(p.id).codice_fiscale||detailOf(p.id).fiscal_code||detailOf(p.id).tax_code||'').trim();
 const identity=String(detailOf(p.id).identity_number||p.identity_number||'').trim();
 const year=new Date().getMonth()>=8?new Date().getFullYear():new Date().getFullYear()-1;
 const completed=matches.filter(m=>m.status==='completed'&&m.match_date>=`${year}-09-01`&&m.match_date<=`${year+1}-08-31`);
 const goalCount=id=>completed.filter(m=>m.played_ids?.includes(id)).reduce((n,m)=>n+(matchScorersFor(m).find(x=>x.player_id===id)?.goals||0),0);
 const teammates=players.filter(x=>x.category_id===p.category_id&&x.primary_role!=='Portiere');
 const top=!isKeeper&&goalsCount>0&&goalsCount===Math.max(0,...teammates.map(x=>goalCount(x.id)));
 const cleanSheets=completed.filter(m=>m.played_ids?.includes(p.id)&&!isTournament(m)&&Number(m.goals_against)===0).length;
 const roleTitles={'Portiere':'GUARDIANO ROSSONERO','Difensore':'PILASTRO DELLA DIFESA','Centrocampista':'MOTORE DEL CENTROCAMPO','Attaccante':'BOMBER ROSSONERO','Jolly':'JOLLY ROSSONERO'};
 const titles=[[roleTitles[p.primary_role]||'CUORE ROSSONERO','TITOLO DEL RUOLO · VOLLA UNITED ACADEMY']];
 if(top)titles.push(['CAPOCANNONIERE '+category,'MAGGIOR NUMERO DI GOL NELLA CATEGORIA']);
 if(isKeeper&&cleanSheets>=1)titles.push(['MURO ROSSONERO',`${cleanSheets} PARTITE A PORTA INVIOLATA REGISTRATE`]);
 if(playedCount>=10)titles.push(['PRESENZA ROSSONERA',`${playedCount} PARTITE GIOCATE · TRAGUARDO DI PARTECIPAZIONE`]);
 if(trainingPresent>=10)titles.push(['COSTANZA ROSSONERA',`${trainingPresent} ALLENAMENTI FREQUENTATI`]);
 if(qualification==='captain')titles.push(['CAPITANO','QUALIFICA UFFICIALE DELLA SQUADRA']);
 if(qualification==='vice')titles.push(['VICECAPITANO','QUALIFICA UFFICIALE DELLA SQUADRA']);

 return `${vuLuxuryProfileCss}${vuFilterCss}<article class="vu-club" aria-label="PROFILO UFFICIALE ${esc(fullName(p))}">
 <div class="vu-club-hero">${vuPhotoParticles(vuActiveFilter(p))}<div class="vu-club-brand"><img src="logo.png" alt="VOLLA UNITED"><span>VOLLA UNITED<br>ACADEMY · PROFILO UFFICIALE</span></div>
 <div class="vu-club-stage"><div class="vu-club-number-wrap" aria-hidden="true"><div class="vu-club-number">${esc(p.jersey_number??'')}</div><div class="vu-club-surname">${esc(upper(p.last_name))}</div><div class="vu-club-bio"><div class="vu-club-bio-item"><span>NOME</span><strong>${esc(upper(p.first_name))}</strong></div><div class="vu-club-bio-item"><span>COGNOME</span><strong>${esc(upper(p.last_name))}</strong></div><div class="vu-club-bio-item"><span>DATA DI NASCITA</span><strong>${esc(birth)}</strong></div><div class="vu-club-bio-item"><span>RUOLO</span><strong>${esc(role)}</strong></div><div class="vu-club-bio-item"><span>CATEGORIA</span><strong>${esc(category)}</strong></div><div class="vu-club-bio-item"><span>NUMERO MAGLIA</span><strong>${esc(p.jersey_number??"—")}</strong></div>${identity?`<div class="vu-club-bio-item"><span>CARTA D’IDENTITÀ</span><strong style="overflow-wrap:anywhere">${esc(upper(identity))}</strong></div>`:''}${fiscal?`<div class="vu-club-bio-item"><span>CODICE FISCALE</span><strong style="font-size:clamp(9px,2.1vw,12px);overflow-wrap:anywhere">${esc(upper(fiscal))}</strong></div>`:''}${String(detailOf(p.id).figc_number||'').trim()?`<div class="vu-club-bio-item"><span>MATRICOLA FIGC</span><strong style="overflow-wrap:anywhere">${esc(upper(String(detailOf(p.id).figc_number).trim()))}</strong></div>`:''}</div></div>${src?`<img class="vu-club-person" src="${esc(src)}" alt="FOTO UFFICIALE ${esc(fullName(p))}" loading="lazy">`:`<div class="vu-player-photo-empty">FOTO UFFICIALE NON ANCORA CARICATA</div>`}${vuPhotoDownloadButton(p)}</div>
 <div class="vu-club-identity"><strong>${esc(upper(p.first_name))}<br>${esc(upper(p.last_name))}</strong><div class="vu-club-line"></div><small>${esc(role)} · CATEGORIA ${esc(category)}</small>${p.jersey_number!=null&&p.jersey_number!==''?`<div class="vu-club-tag">N° ${esc(p.jersey_number)} · MAGLIA UFFICIALE</div>`:''}${qualification==='captain'?'<div class="vu-club-tag">CAPITANO</div>':qualification==='vice'?'<div class="vu-club-tag">VICECAPITANO</div>':''}</div></div>
 <section class="vu-club-section"><div class="vu-club-title"><span>▥</span> LA MIA STAGIONE</div><div class="vu-club-stats"><div class="vu-club-stat"><strong>${playedCount}</strong><small>PARTITE</small></div><div class="vu-club-stat"><strong>${isKeeper?cleanSheets:goalsCount}</strong><small>${isKeeper?'CLEAN SHEET':'GOL'}</small></div><div class="vu-club-stat"><strong>${attendancePct}%</strong><small>ALLENAMENTI</small></div></div></section>
 <section class="vu-club-section"><div class="vu-club-title"><span>🏆</span> I MIEI RICONOSCIMENTI</div>${titles.length?titles.map(([name,reason])=>`<div class="vu-club-award" style="margin-top:9px">✦ ${esc(name)}<div class="vu-club-sub">${esc(reason)}</div></div>`).join(''):'<p class="vu-club-sub">I PRIMI RICONOSCIMENTI ARRIVERANNO CON I TRAGUARDI DELLA STAGIONE.</p>'}</section>
 </article>`;
}
// Download esclusivamente del file originale custodito in Supabase Storage.
// La verifica lato client si aggiunge alle policy RLS/Storage, non le sostituisce.
function vuCanDownloadPlayerPhoto(p){
 if(!p||!me||!photoOf(p.id))return false;
 if(me.role==='parent')return players.some(x=>x.id===p.id);
 return me.role==='admin'||(me.role==='coach'&&permitted().includes(p.category_id));
}
function vuPhotoDownloadButton(p){
 if(!vuCanDownloadPlayerPhoto(p))return '';
 return `<div class="vu-photo-download-wrap"><button type="button" class="vu-photo-download" data-download-player-photo="${esc(p.id)}" aria-label="Scarica foto originale di ${esc(fullName(p))}"><span aria-hidden="true">↓</span> SCARICA FOTO ORIGINALE</button></div>`;
}
async function vuDownloadPlayerPhoto(playerId,button){
 const p=players.find(x=>x.id===playerId);
 if(!vuCanDownloadPlayerPhoto(p))return toast('Non autorizzato a scaricare questa foto');
 const record=playerPhotos.find(x=>x.player_id===playerId);
 if(!record?.storage_path)return toast('Foto originale non disponibile');
 if(button.disabled)return;
 button.disabled=true;
 const old=button.innerHTML;
 button.textContent='⏳ PREPARAZIONE FOTO...';
 try{
  const {data:blob,error}=await sb.storage.from('volla-player-photos').download(record.storage_path);
  if(error)throw error;
  if(!blob)throw Error('File non disponibile');
  const ext=(record.storage_path.split('.').pop()||'jpg').toLowerCase();
  const safeExt=['jpg','jpeg','png','webp'].includes(ext)?ext:'jpg';
  const name=`VOLLA_UNITED_${upper(p.last_name||'CALCIATORE').replace(/[^A-Z0-9]+/g,'_')}_${upper(p.first_name||'').replace(/[^A-Z0-9]+/g,'_')}.${safeExt}`;
  const file=new File([blob],name,{type:blob.type||({png:'image/png',webp:'image/webp'}[safeExt]||'image/jpeg')});
  // Su iOS il foglio di condivisione consente "Salva immagine" quando supportato.
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
   try{await navigator.share({files:[file],title:'Foto originale Volla United'});return}
   catch(e){if(e.name==='AbortError')return;console.warn('Condivisione foto:',e)}
  }
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  toast('Foto pronta per il download');
 }catch(e){console.error('Download foto originale:',e);toast('Impossibile scaricare la foto: '+(e.message||'errore'))}
 finally{if(button.isConnected){button.disabled=false;button.innerHTML=old}}
}
function playerFamilyContent(p,staffView=false){
 const now=new Date().toLocaleDateString('en-CA');
 const childMatches=matches.filter(m=>m.player_ids?.includes(p.id)).sort((a,b)=>a.match_date.localeCompare(b.match_date)||String(a.meeting_time||a.kick_off_time||'99:99').localeCompare(String(b.meeting_time||b.kick_off_time||'99:99')));
 const upcoming=childMatches.filter(m=>vuIsUpcomingCallup(m,p.id,now)),past=childMatches.filter(m=>m.status==='completed'&&m.played_ids?.includes(p.id)).reverse();
 const goalHistory=past.map(m=>({m,goals:matchScorersFor(m).find(x=>x.player_id===p.id)?.goals||0})).filter(x=>x.goals>0);
 const goalHistoryHtml=`<section class="panel"><h3>⚽ Storico gol</h3>${goalHistory.map(({m,goals})=>`<div class="item row"><div><strong>${esc(isTournament(m)?m.tournament_name||'TORNEO':m.opponent||m.match_type)}</strong><small>${esc(dateIt(m.match_date))} · ${esc(m.match_type)}${isTournament(m)&&m.tournament_position?' · '+esc(vuTournamentPlace(m)):''}</small></div><strong>${goals} ${goals===1?'gol':'gol'}</strong></div>`).join('')||'<p class="muted">Nessun gol registrato.</p>'}</section>`;
 const trainings=sessions.filter(s=>s.category_id===p.category_id).sort((a,b)=>b.training_date.localeCompare(a.training_date));
 const records=trainings.map(s=>({s,a:attendance.find(a=>a.session_id===s.id&&a.player_id===p.id)})).filter(x=>x.a);
 const present=records.filter(x=>x.a.present).length;
 const callups=`<section class="panel vu-family-callups"><h3>📅 Prossime convocazioni</h3>${upcoming.map((m,index)=>`<div class="item${index===0?' vu-family-next':''}" data-family-match-id="${esc(m.id)}">${index===0?'<small class="vu-family-next-label">PROSSIMA CONVOCAZIONE</small>':''}<strong>${esc(isTournament(m)?m.tournament_name||'TORNEO':m.opponent||'PARTITA')} · ${esc(dateIt(m.match_date))}</strong><small>${esc(m.field_name||'')} · Raduno ${esc((m.meeting_time||'').slice(0,5))} · Inizio ${esc((m.kick_off_time||'').slice(0,5))}</small>${fieldDirections(m,'📍 APRI MAPPA')}${!staffView?(!vuResponsesLoaded?`<div class="vu-response-locked">⏳ VERIFICA CONFERME NON DISPONIBILE · AGGIORNA LA PAGINA</div>`:vuResponseFor(m.id,p.id)==='none'?`<div class="actions" style="margin-top:10px"><button type="button" class="btn sm" data-callup-response="present" data-match-id="${m.id}" data-player-id="${p.id}" ${vuResponseSaving?'disabled':''}>✅ PRESENTE</button><button type="button" class="btn alt sm" data-callup-response="absent" data-match-id="${m.id}" data-player-id="${p.id}" ${vuResponseSaving?'disabled':''}>❌ ASSENTE</button></div><small>⏳ IN ATTESA</small>`:`<div class="vu-response-locked" style="margin-top:12px;padding:12px;border-radius:12px;border:1px solid #8e5265;background:#351d2b;font-weight:800">${vuResponseLabel(vuResponseFor(m.id,p.id))}</div>`):''}</div>`).join('')||'<p class="muted">Nessuna convocazione futura.</p>'}</section>`;
 const highlightCallups=!staffView&&upcoming.length>0;
 return `${vuProfilePhotoCss}${highlightCallups?callups+vuPushActivation():''}${vuLuxuryHero(p,past.length,past.reduce((n,m)=>n+(matchScorersFor(m).find(x=>x.player_id===p.id)?.goals||0),0),records.length?Math.round(present/records.length*100):0,present)}${vuSeasonSummary(p)}<section class="panel"><h3>🏃 Allenamenti</h3><p><strong>${present} presenze su ${records.length} registrazioni · ${records.length?Math.round(present/records.length*100):0}%</strong></p>${records.slice(0,5).map(x=>`<div class="item row"><span>${esc(dateIt(x.s.training_date))}</span><strong>${x.a.present?'✅ Presente':'❌ Assente'}</strong></div>`).join('')||'<p class="muted">Nessun allenamento registrato.</p>'}</section>${highlightCallups?'':callups}<section class="panel"><h3>🏟 Ultime partite</h3>${past.slice(0,5).map(m=>`<div class="item row"><div><strong>${esc(matchLabel(m))}</strong><small>${esc(dateIt(m.match_date))}</small></div><button class="btn alt sm" data-action="view-match" data-id="${m.id}">Apri</button></div>`).join('')||'<p class="muted">Nessuna convocazione precedente.</p>'}</section>${goalHistoryHtml}<div id="profile-match-detail"></div>`;
}
function bindFamily(){document.querySelectorAll('[data-callup-response]').forEach(b=>b.onclick=()=>vuSetCallupResponse(b.dataset.matchId,b.dataset.playerId,b.dataset.callupResponse)); $('#child-select')?.addEventListener('change',e=>{activeChild=e.target.value;render()}) }
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
if(sb){sb.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){clearOffline();me=null;page='home';editing=null;draft=null;selected=[];currentCat='';login()}});load()}else login();

// Quando iOS mantiene la PWA in memoria, non modificare pagina o form
// al passaggio in background / ritorno in primo piano.
// Se iOS termina il processo, non è possibile conservare i campi senza
// persistenza locale (non richiesta).
