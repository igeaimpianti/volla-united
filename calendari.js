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
 const {data,error}=await sb.from('external_calendar_fixtures').select('*').eq('provider','NEXTGEN').order('match_date',{ascending:true}).order('kick_off_time',{ascending:true});
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
 </article>`;
}
function calendarStyles(){return `<style id="vu-calendar-style">
.vu-cal{display:grid;gap:17px;padding-bottom:36px}.vu-cal-hero{border:1px solid #6f303f;border-radius:24px;padding:25px 22px;background:linear-gradient(135deg,#481527,#21181f 75%)}.vu-cal-hero small{color:#f6adbe;letter-spacing:.1em;font-weight:800;font-size:10px}.vu-cal-hero h2{margin:11px 0 5px;font-size:clamp(27px,5vw,38px)}.vu-cal-hero p{color:#d2c5cb;font-size:13px;line-height:1.6}.vu-calendar-filter{display:grid;grid-template-columns:1fr 1fr;gap:12px}.vu-calendar-filter label{display:block;margin-bottom:7px}.vu-calendar-week{background:#1b1a20;border:1px solid #40333e;border-radius:18px;overflow:hidden}.vu-calendar-week-title{padding:15px 18px;border-bottom:1px solid #40333e;display:flex;gap:10px;align-items:center;justify-content:space-between}.vu-calendar-week-title strong{font-size:14px}.vu-calendar-week-title span{font-size:11px;color:#e7a2b5}.vu-calendar-game{display:flex;align-items:center;gap:13px;padding:15px 16px;border-bottom:1px solid #ffffff10}.vu-calendar-game:last-child{border-bottom:0}.vu-calendar-time{width:104px;flex-shrink:0}.vu-calendar-time strong{font-size:20px;font-variant-numeric:tabular-nums}.vu-calendar-time small{display:block;font-size:10px;color:#bdb6bd;margin-top:4px}.vu-calendar-game-main{min-width:0;flex:1;display:grid;gap:5px}.vu-calendar-game-main strong{font-size:14px;line-height:1.35}.vu-calendar-game-main small{font-size:11px;color:#c6b9c1}.vu-calendar-category{font-size:10px;color:#f1a9be;font-weight:800;letter-spacing:.06em}.vu-calendar-vs{font-size:10px;color:#aa9fa6;text-transform:uppercase}.vu-calendar-place{font-size:9px;font-weight:850;border-radius:20px;padding:7px 9px;white-space:nowrap;background:#302831;color:#f5bdcb}.vu-calendar-place.at-home{background:#5d1e32;color:#ffd4de}.vu-cal-empty{padding:20px;color:#bbb;font-size:13px}.vu-cal-summary-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.vu-cal-summary-heading h2{font-size:17px;margin:0}.vu-cal-summary-heading button{background:transparent;color:#f6b4c4;border:0;font-weight:800;padding:8px;cursor:pointer}.vu-calendar-dashboard{display:grid;gap:12px;margin:12px 0 18px}.vu-calendar-dashboard .vu-calendar-game{padding:12px 13px}.vu-calendar-dashboard .vu-calendar-week{border-color:#754353}@media(max-width:560px){.vu-calendar-filter{grid-template-columns:1fr}.vu-calendar-game{gap:9px;padding:13px 10px}.vu-calendar-time{width:77px}.vu-calendar-time strong{font-size:17px}.vu-calendar-time small{font-size:9px}.vu-calendar-game-main strong{font-size:12px}.vu-calendar-place{padding:6px;font-size:8px}}
</style>`;}
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
export function calendarPage(fixtures){
 const categories=[...new Set(fixtures.map(f=>f.category_name))].sort((a,b)=>a.localeCompare(b,'it',{numeric:true}));
 const filtered=fixtures.filter(f=>(selectedCategory==='all'||f.category_name===selectedCategory)&&(selectedWeekend==='all'||weekEnd(f.match_date)===selectedWeekend));
 const weekends=groupWeekends(fixtures);
 const available=weekends.map(([k])=>k);
 if(selectedWeekend!=='all'&&!available.includes(selectedWeekend))selectedWeekend='all';
 return `${calendarStyles()}<div class="vu-cal"><div class="vu-cal-hero"><small>VOLLA UNITED ACADEMY · STAGIONE 2026/27</small><h2>Calendari</h2><p>Tutte le partite NextGen delle categorie 2017, 2018 e 2019. Solo data, ora, avversario e casa/trasferta.</p></div>
 <div class="vu-calendar-filter"><div><label for="vu-cal-category">Categoria</label><select id="vu-cal-category"><option value="all">Tutte le categorie</option>${categories.map(c=>`<option value="${safe(c)}" ${selectedCategory===c?'selected':''}>${safe(c)}</option>`).join('')}</select></div><div><label for="vu-cal-week">Fine settimana</label><select id="vu-cal-week"><option value="all">Tutta la stagione</option>${weekends.map(([w])=>`<option value="${safe(w)}" ${selectedWeekend===w?'selected':''}>${safe(niceDate(w))}</option>`).join('')}</select></div></div>
 <div class="vu-cal-summary-heading"><h2>${filtered.length} partite</h2><button type="button" id="vu-cal-next">PROSSIME ›</button></div>
 ${filtered.length?groupWeekends(filtered).map(([k,v])=>weekBlock(k,v)).join(''):'<div class="vu-calendar-week vu-cal-empty">Nessuna partita per i filtri scelti.</div>'}</div>`;
}
export function bindCalendarPage(render){
 document.getElementById('vu-cal-category')?.addEventListener('change',e=>{selectedCategory=e.target.value;render();});
 document.getElementById('vu-cal-week')?.addEventListener('change',e=>{selectedWeekend=e.target.value;render();});
 document.getElementById('vu-cal-next')?.addEventListener('click',()=>{selectedWeekend=groupWeekends(window.__vuCalendarFixtures||[]).find(([k,rows])=>rows.some(f=>f.match_date>=tomorrowProofToday()&&f.status==='scheduled'))?.[0]||'all';render();});
}
