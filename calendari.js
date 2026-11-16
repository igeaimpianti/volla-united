// Calendari Volla United: archivio manuale, nessuna sincronizzazione automatica.
const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const days = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
const dateLocal = s => new Date(String(s).slice(0,10)+'T12:00:00');
const niceDate = s => {const d=dateLocal(s);return days[d.getDay()]+' '+new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'long',year:'numeric'}).format(d);};
const hm = s => String(s || '').slice(0,5) || 'Da definire';
const weekEnd = s => {const d=dateLocal(s);d.setDate(d.getDate() + (d.getDay()===0?-1:(6-d.getDay()+7)%7));return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const tomorrowProofToday = () => {const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
const order = (a,b)=>String(a.match_date).localeCompare(String(b.match_date))||String(a.kick_off_time||'').localeCompare(String(b.kick_off_time||''))||String(a.category_name).localeCompare(String(b.category_name),'it');
let selectedCategory='all',selectedWeekend='all';
export const isCalendarUser = role => role === 'calendari';
export async function getCalendarFixtures(sb,cats) {
 const {data,error}=await sb.from('external_calendar_fixtures').select('*').order('match_date',{ascending:true}).order('kick_off_time',{ascending:true});
 if(error)throw error;
 const names=new Map(cats.map(c=>[c.id,c.name]));
 return (data||[]).map(f=>({...f,category_name:names.get(f.category_id)||'Categoria'})).sort(order);
}
function fixtureRow(f){
 const home=f.home_team==='VOLLA UNITED',opponent=home?f.away_team:f.home_team;
 return `<article class="vu-calendar-game">
  <div class="vu-calendar-time"><strong>${safe(hm(f.kick_off_time))}</strong><small>${safe(niceDate(f.match_date))}</small></div>
  <div class="vu-calendar-game-main"><span class="vu-calendar-category">UNDER ${safe(f.category_name)}</span><strong>${home?'VOLLA UNITED':safe(opponent)} <span class="vu-calendar-vs">vs</span> ${home?safe(opponent):'VOLLA UNITED'}</strong><small>${home?'🏠 CASA':'🚌 TRASFERTA'}</small></div>
  <span class="vu-calendar-place ${home?'at-home':'away'}">${home?'CASA':'FUORI'}</span>
  ${f.id? `<button type="button" class="vu-cal-edit" data-cal-edit="${safe(f.id)}" aria-label="Modifica data e ora della partita">✎ Modifica</button>`:''}
 </article>`;
}
function calendarStyles(){return `<style id="vu-calendar-style">
.vu-cal{display:grid;gap:17px;padding-bottom:36px}.vu-cal-hero{border:1px solid #6f303f;border-radius:24px;padding:25px 22px;background:linear-gradient(135deg,#481527,#21181f 75%)}.vu-cal-hero small{color:#f6adbe;letter-spacing:.1em;font-weight:800;font-size:10px}.vu-cal-hero h2{margin:11px 0 5px;font-size:clamp(27px,5vw,38px)}.vu-cal-hero p{color:#d2c5cb;font-size:13px;line-height:1.6}.vu-calendar-filter{display:grid;grid-template-columns:1fr 1fr;gap:12px}.vu-calendar-filter label{display:block;margin-bottom:7px}.vu-calendar-week{background:#1b1a20;border:1px solid #40333e;border-radius:18px;overflow:hidden}.vu-calendar-week-title{padding:15px 18px;border-bottom:1px solid #40333e;display:flex;gap:10px;align-items:center;justify-content:space-between}.vu-calendar-week-title strong{font-size:14px}.vu-calendar-week-title span{font-size:11px;color:#e7a2b5}.vu-calendar-game{display:flex;align-items:center;gap:13px;padding:15px 16px;border-bottom:1px solid #ffffff10}.vu-calendar-game:last-child{border-bottom:0}.vu-calendar-time{width:104px;flex-shrink:0}.vu-calendar-time strong{font-size:20px;font-variant-numeric:tabular-nums}.vu-calendar-time small{display:block;font-size:10px;color:#bdb6bd;margin-top:4px}.vu-calendar-game-main{min-width:0;flex:1;display:grid;gap:5px}.vu-calendar-game-main strong{font-size:14px;line-height:1.35}.vu-calendar-game-main small{font-size:11px;color:#c6b9c1}.vu-calendar-category{font-size:10px;color:#f1a9be;font-weight:800;letter-spacing:.06em}.vu-calendar-vs{font-size:10px;color:#aa9fa6;text-transform:uppercase}.vu-calendar-place{font-size:9px;font-weight:850;border-radius:20px;padding:7px 9px;white-space:nowrap;background:#302831;color:#f5bdcb}.vu-calendar-place.at-home{background:#5d1e32;color:#ffd4de}.vu-cal-empty{padding:20px;color:#bbb;font-size:13px}.vu-cal-summary-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.vu-cal-summary-heading h2{font-size:17px;margin:0}.vu-cal-summary-heading button{background:transparent;color:#f6b4c4;border:0;font-weight:800;padding:8px;cursor:pointer}.vu-calendar-dashboard{display:grid;gap:12px;margin:12px 0 18px}.vu-calendar-dashboard .vu-calendar-game{padding:12px 13px}.vu-calendar-dashboard .vu-calendar-week{border-color:#754353}@media(max-width:560px){.vu-calendar-filter{grid-template-columns:1fr}.vu-calendar-game{gap:9px;padding:13px 10px}.vu-calendar-time{width:77px}.vu-calendar-time strong{font-size:17px}.vu-calendar-time small{font-size:9px}.vu-calendar-game-main strong{font-size:12px}.vu-calendar-place{padding:6px;font-size:8px}}
.vu-cal-edit{flex-shrink:0;border:1px solid #a4526b;background:#3c2030;color:#ffe4eb;border-radius:10px;padding:9px 11px;font-weight:800;font-size:11px;cursor:pointer}.vu-cal-edit:hover,.vu-cal-edit:focus-visible{background:#703148;outline:2px solid #f6adbe}.vu-cal-modal{position:fixed;inset:0;z-index:2147480000;background:#000b;display:grid;place-items:center;padding:16px}.vu-cal-dialog{background:#1d1c23;border:1px solid #9d455d;border-radius:20px;padding:24px;width:min(100%,430px);box-shadow:0 30px 85px #000a}.vu-cal-dialog h2{font-size:21px;margin-bottom:10px}.vu-cal-dialog p{font-size:12px;color:#d0bbc3;line-height:1.5;margin-bottom:20px}.vu-cal-dialog label{display:block;margin:14px 0 7px}.vu-cal-dialog input{width:100%}.vu-cal-buttons{display:flex;gap:10px;margin-top:24px}.vu-cal-buttons button{flex:1;min-height:44px}.vu-cal-error{color:#ff9eb3;font-size:12px;min-height:18px;margin-top:12px}@media(max-width:560px){.vu-calendar-game{flex-wrap:wrap}.vu-cal-edit{margin-left:auto}}.vu-cal-section-title{font-size:17px!important;margin:6px 0 0}.vu-cal-category-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.vu-cal-category-tile{position:relative;display:flex;flex-direction:column;gap:9px;min-width:0;text-align:left;padding:17px 16px;background:linear-gradient(150deg,#321923,#20181f);border:1px solid #724052;border-radius:17px;color:white;cursor:pointer}.vu-cal-category-name{font-size:20px;font-weight:850}.vu-cal-category-tile strong{font-size:12px;color:#f2bfcd}.vu-cal-category-tile small{font-size:11px;color:#c6adb7;line-height:1.4;max-width:96%}.vu-cal-category-arrow{position:absolute;right:15px;top:16px;font-size:23px;color:#f4aec0}.vu-cal-back{border:0;background:none;color:#ffc4d3;text-align:left;font-weight:850;padding:12px 2px}.vu-cal-league{background:#1b1a20;border:1px solid #653948;border-radius:17px;overflow:hidden}.vu-cal-league-head{display:flex;align-items:center;justify-content:space-between;padding:18px 15px;background:#351c27}.vu-cal-league-head h3{margin:0;font-size:16px}.vu-cal-league-head span{color:#dfb4c0;font-size:11px}@media(max-width:480px){.vu-cal-category-grid{gap:9px}.vu-cal-category-tile{padding:14px 11px}.vu-cal-category-name{font-size:17px}}</style>`;}
function groupWeekends(fixtures){
 const groups=new Map();
 fixtures.forEach(f=>{const k=weekEnd(f.match_date);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(f);});
 return [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}
function weekBlock(k,rows){
 const sat=dateLocal(k);const sun=new Date(sat);sun.setDate(sun.getDate()+1);
 const heading='Weekend '+new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short'}).format(sat)+' – '+new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',year:'numeric'}).format(sun);
 return `<section class="vu-calendar-week"><div class="vu-calendar-week-title"><strong>📅 ${safe(heading)}</strong><span>${rows.length} ${rows.length===1?'partita':'partite'}</span></div>${rows.map(fixtureRow).join('')}</section>`;
}
export function weekendDashboard(fixtures,openPage=true){
 const today=tomorrowProofToday();
 const next=fixtures.filter(f=>f.match_date>=today&&f.status!=='cancelled'&&f.status!=='completed');
 const weeks=groupWeekends(next).slice(0,4);
 return `${calendarStyles()}<section class="vu-calendar-dashboard"><div class="vu-cal-summary-heading"><h2>📅 PROSSIME PARTITE · FINE SETTIMANA</h2>${openPage?'<button data-page="calendari" type="button">TUTTO IL CALENDARIO ›</button>':''}</div>${weeks.length?weeks.map(([k,v])=>weekBlock(k,v)).join(''):'<div class="vu-calendar-week vu-cal-empty">Nessuna partita futura nei calendari disponibili.</div>'}</section>`;
}

const categoryLabels=['2016 Rossa','2016 Nera','2017','2018','2019','2020','2021/22'];
let activeCalendarCategory=null;
function categoryFixtures(fixtures,category){return fixtures.filter(f=>String(f.category_name||'').toLowerCase()===category.toLowerCase());}
function competitionOf(f){return String(f.provider||'CAMPIONATO').toUpperCase();}
function competitionBlocks(fixtures){
 const leagues=new Map();
 fixtures.forEach(f=>{const name=competitionOf(f);if(!leagues.has(name))leagues.set(name,[]);leagues.get(name).push(f);});
 return [...leagues.entries()].sort((a,b)=>a[0].localeCompare(b[0],'it')).map(([name,rows])=>'<section class="vu-cal-league"><div class="vu-cal-league-head"><h3>'+safe(name)+'</h3><span>'+rows.length+' partite</span></div>'+rows.sort(order).map(fixtureRow).join('')+'</section>').join('');
}
export function calendarPage(fixtures){
 const today=tomorrowProofToday();
 const upcoming=fixtures.filter(f=>f.match_date>=today&&f.status!=='completed'&&f.status!=='cancelled').sort(order);
 const selected=activeCalendarCategory;
 const scoped=selected?categoryFixtures(fixtures,selected).sort(order):[];
 const nextScoped=scoped.filter(f=>f.match_date>=today&&f.status!=='completed'&&f.status!=='cancelled');
 const tiles=categoryLabels.map(name=>{
  const rows=categoryFixtures(upcoming,name),first=rows[0];
  return '<button type="button" class="vu-cal-category-tile" data-cal-pick="'+safe(name)+'"><span class="vu-cal-category-name">'+safe(name)+'</span><strong>'+(first?'📅 '+safe(niceDate(first.match_date)):'Nessuna partita futura')+'</strong><small>'+(first?'⏰ '+safe(hm(first.kick_off_time))+' · '+safe(first.home_team==='VOLLA UNITED'?first.away_team:first.home_team):'Calendario da caricare')+'</small><span class="vu-cal-category-arrow">›</span></button>';
 }).join('');
 const top='<div class="vu-cal-hero"><small>VOLLA UNITED ACADEMY · STAGIONE 2026/27</small><h2>'+(selected?'Calendario '+safe(selected):'Calendari')+'</h2><p>Data, ora, avversario e casa/trasferta. Campionati separati.</p></div>';
 if(!selected)return calendarStyles()+'<div class="vu-cal">'+top+
 '<h2 class="vu-cal-section-title">⚡ ACCESSO RAPIDO</h2><div class="vu-cal-category-grid">'+tiles+'</div>'+
 '<h2 class="vu-cal-section-title">📅 PROSSIMI IMPEGNI · TUTTE LE CATEGORIE</h2>'+
 (upcoming.length?groupWeekends(upcoming).slice(0,4).map(([k,rows])=>weekBlock(k,rows)).join(''):'<section class="vu-calendar-week vu-cal-empty">Nessun impegno futuro inserito.</section>')+'</div>';
 const leagues=[...new Set(scoped.map(competitionOf))];
 return calendarStyles()+'<div class="vu-cal"><button type="button" id="vu-cal-back" class="vu-cal-back">‹ Tutte le categorie</button>'+top+
 '<div class="vu-cal-summary-heading"><h2>📅 PROSSIMI IMPEGNI</h2><span>'+nextScoped.length+' in programma</span></div>'+
 (nextScoped.length?groupWeekends(nextScoped).map(([k,rows])=>weekBlock(k,rows)).join(''):'<section class="vu-calendar-week vu-cal-empty">Nessuna partita futura per questa categoria.</section>')+
 '<h2 class="vu-cal-section-title">🏆 CAMPIONATI</h2>'+
 (leagues.length?competitionBlocks(scoped):'<section class="vu-calendar-week vu-cal-empty">Nessun campionato ancora caricato.</section>')+'</div>';
}
export function bindCalendarPage(render){
 document.querySelectorAll('[data-cal-pick]').forEach(b=>b.addEventListener('click',()=>{activeCalendarCategory=b.dataset.calPick;render();window.scrollTo(0,0);}));
 document.getElementById('vu-cal-back')?.addEventListener('click',()=>{activeCalendarCategory=null;render();window.scrollTo(0,0);});
}

export function bindCalendarEdits(sb,fixtures,onSaved){
 document.querySelectorAll('[data-cal-edit]').forEach(button=>{
  button.addEventListener('click',()=>{
   const fixture=fixtures.find(f=>f.id===button.dataset.calEdit);
   if(!fixture)return;
   document.querySelector('.vu-cal-modal')?.remove();
   const modal=document.createElement('div');modal.className='vu-cal-modal';
   const opponent=fixture.home_team==='VOLLA UNITED'?fixture.away_team:fixture.home_team;
   modal.innerHTML=`<form class="vu-cal-dialog" role="dialog" aria-modal="true" aria-label="Modifica data e ora"><h2>Modifica data e ora</h2><p>UNDER ${safe(fixture.category_name)} · ${safe(opponent)} · ${fixture.home_team==='VOLLA UNITED'?'CASA':'TRASFERTA'}<br>Avversario e sede non saranno modificati.</p><label for="vu-cal-date">Nuova data</label><input id="vu-cal-date" type="date" required value="${safe(fixture.match_date)}"><label for="vu-cal-time">Nuova ora</label><input id="vu-cal-time" type="time" required value="${safe(hm(fixture.kick_off_time))}"><div class="vu-cal-error" role="alert" aria-live="polite"></div><div class="vu-cal-buttons"><button type="button" class="btn alt" data-cal-cancel>Annulla</button><button type="submit" class="btn">Salva modifiche</button></div></form>`;
   document.body.append(modal);
   const form=modal.querySelector('form'),cancel=modal.querySelector('[data-cal-cancel]'),submit=form.querySelector('[type=submit]'),errorBox=modal.querySelector('.vu-cal-error');
   const close=()=>modal.remove();
   cancel.onclick=close;
   modal.addEventListener('click',event=>{if(event.target===modal)close()});
   modal.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
   form.onsubmit=async event=>{
    event.preventDefault();
    const date=modal.querySelector('#vu-cal-date').value;
    const time=modal.querySelector('#vu-cal-time').value;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time)){errorBox.textContent='Inserisci una data e un orario validi.';return;}
    if(date===fixture.match_date&&time===hm(fixture.kick_off_time)){close();return;}
    submit.disabled=true;cancel.disabled=true;submit.textContent='Salvataggio…';errorBox.textContent='';
    try{
     const {data,error}=await sb.from('external_calendar_fixtures').update({match_date:date,kick_off_time:time,updated_at:new Date().toISOString()}).eq('id',fixture.id).eq('match_date',fixture.match_date).eq('kick_off_time',fixture.kick_off_time).select('id');
     if(error)throw error;
     if(!data?.length)throw new Error('La partita è stata modificata da un altro accesso. Aggiorna il calendario e riprova.');
     close();
     await onSaved();
    }catch(e){errorBox.textContent=e.message||'Impossibile salvare le modifiche';}
    finally{if(submit.isConnected){submit.disabled=false;submit.textContent='Salva modifiche';cancel.disabled=false;}}
   };
   modal.querySelector('#vu-cal-date').focus();
  });
 });
}
