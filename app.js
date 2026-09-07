'use strict';
const $=id=>document.getElementById(id);
const KEY='driving-ledger-v1';
const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const money=n=>`${n.toLocaleString('ko-KR')}원`;
const SETTINGS_KEY='driving-ledger-settings-v1';
let settings={commissionRate:20,theme:'dark'};
try{const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY));if(saved&&Number.isFinite(saved.commissionRate)&&saved.commissionRate>=0&&saved.commissionRate<=100&&['dark','light'].includes(saved.theme))settings=saved}catch{}
function applySettings(){document.documentElement.dataset.theme=settings.theme;document.querySelector('meta[name="theme-color"]').content=settings.theme==='light'?'#f4f6f8':'#111418';for(const label of document.querySelectorAll('[data-fee-label]'))label.textContent=`수수료 (운행비의 ${settings.commissionRate}%)`}
const fee=r=>r.feeWaived===true?0:Math.round(r.fare*settings.commissionRate/100);
applySettings();
const net=r=>r.fare+r.tip-fee(r)-r.toll-r.transit;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const appIcons={로지:'logi.png',아이콘:'icon.jpeg',콜마너:'call.webp',카카오대리:'kakao.png','T대리':'t.png',오픈마일:'openmile.png'};
const appIcon=a=>appIcons[a]||'';
let records=[],selected=localDate(),month=selected.slice(0,7),toastTimer;
function toast(message){}
function validRecord(r){return r&&typeof r.id==='string'&&r.id.length>0&&r.id.length<200&&typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&r.date>='1900-01-01'&&r.date<='9999-12-31'&&localDate(new Date(r.date+'T12:00:00'))===r.date&&typeof r.time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)&&['대리 운전','탁송 운전'].includes(r.type)&&['로지','아이콘','콜마너','카카오대리','T대리','오픈마일'].includes(r.app)&&['origin','via','destination'].every(k=>typeof r[k]==='string'&&r[k].length<=200)&&r.origin.trim()&&r.destination.trim()&&(typeof r.mood==='undefined'||['나쁨','보통','좋음'].includes(r.mood))&&(r.feeWaived===undefined||typeof r.feeWaived==='boolean')&&['fare','tip','toll','transit'].every(k=>Number.isSafeInteger(r[k])&&r[k]>=0&&r[k]<=100000000)}
function validRecords(a){return Array.isArray(a)&&a.length<=100000&&a.every(validRecord)&&new Set(a.map(r=>r.id)).size===a.length}
try{const saved=localStorage.getItem(KEY);if(saved){const a=JSON.parse(saved);if(!validRecords(a))throw Error();records=a}}catch{}
function commit(next){try{localStorage.setItem(KEY,JSON.stringify(next));records=next;render();return true}catch{return false}}
function total(a,fn){return a.reduce((s,r)=>s+fn(r),0)}
function render(){
 const monthly=records.filter(r=>r.date.startsWith(month));
 $('month-net').textContent=money(total(monthly,net));$('month-income').textContent=money(total(monthly,r=>r.fare+r.tip));$('month-expense').textContent=money(total(monthly,r=>fee(r)+r.toll+r.transit));$('month-count').textContent=`${Number(month.split('-')[1])}월 · ${monthly.length}건의 운행`;
 const [y,m]=month.split('-').map(Number);$('month-label').textContent=`${y}년 ${m}월`;
 const first=new Date(y,m-1,1).getDay(),days=new Date(y,m,0).getDate();
 const grouped=new Map();for(const r of monthly){if(!grouped.has(r.date))grouped.set(r.date,[]);grouped.get(r.date).push(r)}
 let html='<div aria-hidden="true"></div>'.repeat(first);
 for(let d=1;d<=days;d++){const date=`${month}-${String(d).padStart(2,'0')}`,a=grouped.get(date)||[],value=total(a,net);html+=`<button class="day ${date===localDate()?'today':''} ${date===selected?'selected':''} ${(first+d-1)%7===0?'sunday':(first+d-1)%7===6?'saturday':''}" data-date="${date}" aria-label="${m}월 ${d}일, ${a.length}건${a.length?', 실수입 '+money(value):''}" aria-pressed="${date===selected}" ${date===localDate()?'aria-current="date"':''}><span class="number">${d}</span>${a.length?`<span class="day-calls">${a.length}콜</span><span class="amount">${money(value)}</span>`:''}</button>`}
 $('calendar').innerHTML=html;
 const daily=records.filter(r=>r.date===selected).sort((a,b)=>a.time.localeCompare(b.time));
 $('day-label').textContent=selected;$('day-count').textContent=selected;$('day-net').textContent=money(total(daily,net));
 $('entries').innerHTML=daily.length?daily.map(r=>`<article class="entry compact-entry" role="button" tabindex="0" data-detail="${esc(r.id)}" aria-label="${esc(r.time)} ${esc(r.origin)} 운행 상세"><div class="trip-line"><time>${esc(r.time)}</time><span class="trip-type">${r.type==='탁송 운전'?'탁송':'대리'}</span><span class="trip-app"><img src="images/${appIcon(r.app)}" alt="">${esc(r.app)}</span><span class="trip-income"><span>수입</span><strong>${money(r.fare+r.tip)}</strong></span></div><div class="trip-route"><div class="trip-origin">🚘 ${esc(r.origin)}</div>${r.via?`<div class="trip-via">🛼 ${esc(r.via)}</div>`:''}<div class="trip-destination">🏡 ${esc(r.destination)}</div></div></article>`).join(''):'<div class="empty"><strong>운행 기록이 없습니다</strong><p>상단 일지 입력 버튼으로 기록을 추가하세요.</p></div>';
 $('daily-income').textContent=money(total(daily,r=>r.fare+r.tip));
 $('daily-expense').textContent=money(total(daily,r=>fee(r)+r.toll+r.transit));
 $('daily-profit').textContent=money(total(daily,net));
 $('daily-total-count').textContent=`${daily.length}건`;

}
function openEditor(record){const form=$('form');form.reset();form.elements.id.value='';form.elements.date.min='1900-01-01';form.elements.date.max='9999-12-31';form.elements.date.value=selected;form.elements.time.value=new Date().toTimeString().slice(0,5);if(record)for(const k of ['id','date','time','type','app','origin','via','destination','mood','fare','tip','toll','transit'])if(record[k]!==undefined)form.elements[k].value=record[k];form.elements.feeWaived.value=String(record?.feeWaived===true);$('form-title').textContent=record?'운행 기록 수정':'운행 기록 추가';preview();$('editor').showModal()}
function preview(){const form=$('form');const r=Object.fromEntries(['fare','tip','toll','transit'].map(k=>[k,Number(form.elements[k].value)||0]));r.feeWaived=form.elements.feeWaived.value==='true';$('fee-amount').value=money(fee(r));$('fee-mode').textContent=r.feeWaived?'면제':`${settings.commissionRate}%`;$('fee-zero').textContent=r.feeWaived?'자동':'0원';$('fee-zero').setAttribute('aria-pressed',String(r.feeWaived));$('preview-net').textContent=money(net(r))}
$('extra-plus').onclick=()=>{const input=$('form').elements.tip;input.value=Math.min(100000000,Math.max(0,Number(input.value)||0)+5000);preview()};
$('fee-zero').onclick=()=>{const input=$('form').elements.feeWaived;input.value=input.value==='true'?'false':'true';preview()};
$('form').addEventListener('input',preview);
$('form').addEventListener('submit',e=>{e.preventDefault();const r=Object.fromEntries(new FormData(e.target));r.feeWaived=r.feeWaived==='true';r.id=r.id||(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`);for(const k of ['fare','tip','toll','transit'])r[k]=Number(r[k]);for(const k of ['origin','via','destination'])r[k]=r[k].trim();if(!validRecord(r)){toast('입력 내용을 확인해 주세요. 금액은 0원부터 1억 원까지입니다.');return}const next=records.filter(x=>x.id!==r.id).concat(r);if(commit(next)){selected=r.date;month=r.date.slice(0,7);location.hash='day/'+selected;render();$('editor').close();toast('운행 기록을 저장했습니다.')}});
$('add').onclick=()=>openEditor();for(const id of ['close','cancel'])$(id).onclick=()=>$('editor').close();
$('calendar').onclick=e=>{const b=e.target.closest('[data-date]');if(b){location.hash='day/'+b.dataset.date}};
$('entries').onclick=e=>{const card=e.target.closest('[data-detail]');if(card)openTripDetail(card.dataset.detail)};
$('entries').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const card=e.target.closest('[data-detail]');if(card){e.preventDefault();openTripDetail(card.dataset.detail)}}});
let detailId=null;
function openTripDetail(id){const r=records.find(r=>r.id===id);if(!r)return;detailId=id;const icon=appIcon(r.app);$('detail-app-icon').src=icon?`images/${icon}`:'';$('detail-app-icon').alt=r.app||'';$('detail-app-icon').style.display=icon?'inline-block':'none';for(const key of ['time','origin','via','destination'])$('detail-'+key).textContent=r[key]||'';$('detail-via-row').hidden=!r.via;$('detail-mood').textContent=r.mood||'보통';$('detail-income').textContent=money(r.fare+r.tip);$('trip-detail').showModal()}
$('detail-cancel').onclick=()=>$('trip-detail').close();
$('detail-edit').onclick=()=>{const r=records.find(r=>r.id===detailId);$('trip-detail').close();if(r)openEditor(r)};
$('detail-delete').onclick=()=>{if(!records.some(r=>r.id===detailId))return;if(confirm('이 운행 기록을 삭제할까요?')&&commit(records.filter(r=>r.id!==detailId))){$('trip-detail').close();toast('운행 기록을 삭제했습니다.')}};
function changeDay(delta){const date=new Date(selected+'T12:00:00');date.setDate(date.getDate()+delta);if(date.getFullYear()<1900||date.getFullYear()>9999)return;location.hash='day/'+localDate(date)}
$('prev-day').onclick=()=>changeDay(-1);$('next-day').onclick=()=>changeDay(1);

function changeMonth(delta){const [y,m]=month.split('-').map(Number),d=new Date(y,m-1+delta,1);if(d.getFullYear()<1900||d.getFullYear()>9999)return;selected=localDate(d);month=selected.slice(0,7);render()}
$('prev').onclick=()=>changeMonth(-1);$('next').onclick=()=>changeMonth(1);
render();

let statsMode='month',statsYear=localDate().slice(0,4);
function syncPage(){
 const hash=location.hash;
 const dayMatch=hash.match(/^#day\/(\d{4}-\d{2}-\d{2})$/);
 const statsYearMatch=hash.match(/^#stats-year(?:\/(\d{4}))?$/);
 const statsMatch=hash.match(/^#stats(?:\/(\d{4}-\d{2}))?$/);
 const date=dayMatch?.[1];
 const dailyPage=!!date&&date>='1900-01-01'&&date<='9999-12-31'&&localDate(new Date(date+'T12:00:00'))===date;
 const statsPage=!!statsMatch||!!statsYearMatch;
 const statsMonth=statsMatch?.[1];
 const reqYear=statsYearMatch?.[1];

 if(dailyPage){
   selected=date;
   month=date.slice(0,7);
 } else if(statsYearMatch){
   statsMode='year';
   if(reqYear&&/^\d{4}$/.test(reqYear)&&Number(reqYear)>=1900&&Number(reqYear)<=9999){
     statsYear=reqYear;
   } else {
     statsYear=month.slice(0,4);
   }
 } else if(statsMatch){
   statsMode='month';
   if(statsMonth&&/^\d{4}-\d{2}$/.test(statsMonth)&&Number(statsMonth.slice(0,4))>=1900&&Number(statsMonth.slice(0,4))<=9999){
     month=statsMonth;
   }
 }

 document.body.classList.toggle('daily-page',dailyPage);
 document.body.classList.toggle('stats-page',statsPage);
 $('daily').hidden=!dailyPage;
 $('stats-page').hidden=!statsPage;

 if(dailyPage){
   document.title=`${selected} · 일일 일지`;
 } else if(statsPage){
   if(statsMode==='year'){
     document.title=`${statsYear}년 통계 · 드라이빙 일지`;
   } else {
     const [y,m]=month.split('-').map(Number);
     document.title=`${y}년 ${m}월 통계 · 드라이빙 일지`;
   }
 } else {
   document.title='드라이빙 일지';
 }

 render();
 if(statsPage) renderStats();
 window.scrollTo(0,0);
}
window.addEventListener('hashchange',syncPage);
syncPage();

function changeStatsPeriod(delta){
 if(statsMode==='year'){
   const y=Number(statsYear)+delta;
   if(y<1900||y>9999)return;
   statsYear=String(y);
   location.hash='stats-year/'+statsYear;
 } else {
   const [y,m]=month.split('-').map(Number),d=new Date(y,m-1+delta,1);
   if(d.getFullYear()<1900||d.getFullYear()>9999)return;
   month=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
   location.hash='stats/'+month;
 }
}
$('stats-prev-month').onclick=()=>changeStatsPeriod(-1);
$('stats-next-month').onclick=()=>changeStatsPeriod(1);
$('stats-mode-toggle').onclick=()=>{
  if(statsMode==='month'){
    statsMode='year';
    statsYear=month.slice(0,4);
    location.hash='stats-year/'+statsYear;
  } else {
    statsMode='month';
    location.hash='stats/'+month;
  }
};

const driveMenu=$('drive-menu');
const localMenu=$('local-backup-menu');
document.addEventListener('click',e=>{
  if(driveMenu&&!driveMenu.contains(e.target))driveMenu.open=false;
  if(localMenu&&!localMenu.contains(e.target))localMenu.open=false;
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(driveMenu?.open){driveMenu.open=false;driveMenu.querySelector('summary').focus()}
    if(localMenu?.open){localMenu.open=false;localMenu.querySelector('summary').focus()}
  }
});
$('local-file-import')?.addEventListener('click',()=>{if(localMenu)localMenu.open=false;$('local-file-input')?.click()});
$('local-file-input')?.addEventListener('change',async e=>{
  const file=e.target.files?.[0];
  if(!file)return;
  try{
    const text=await file.text();
    let data;
    try{data=JSON.parse(text)}catch{throw Error('올바른 JSON 파일이 아닙니다.')}
    if(!data||data.version!==1||!validRecords(data.records)){
      throw Error('올바른 운행노트 JSON 백업이 아닙니다. 형식과 필드를 확인해 주세요.');
    }
    if(!confirm(`${file.name}\n백업 ${data.records.length}건으로 현재 기록 ${records.length}건을 교체할까요?\n필요하면 취소 후 현재 기록을 먼저 저장하세요.`)){
      return;
    }
    if(!commit(data.records))throw Error('브라우저에 저장하지 못했습니다. 현재 기록은 유지됩니다.');
    $('settings-dialog').close();
    toast(`${records.length}건 불러오기 완료`);
  }catch(err){
    toast(err.message||'파일을 불러오지 못했습니다.');
  }finally{
    e.target.value='';
  }
});
$('local-file-export')?.addEventListener('click',()=>{
  if(localMenu)localMenu.open=false;
  const snapshot=JSON.stringify({version:1,exportedAt:new Date().toISOString(),records},null,2);
  const blob=new Blob([snapshot],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`운행노트-${localDate()}-${new Date().toTimeString().slice(0,8).replaceAll(':','')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('JSON 백업 파일을 다운로드했습니다.');
});
$('today-button').onclick=()=>{selected=localDate();month=selected.slice(0,7);location.hash='day/'+selected};
function renderStats(){
  const isYear=(statsMode==='year');
  if($('stats-title'))$('stats-title').textContent=isYear?'연간 통계':'월간 통계';
  if($('stats-mode-toggle'))$('stats-mode-toggle').textContent=isYear?'월간 통계':'연간 통계';

  let targetRecords;
  if(isYear){
    targetRecords=records.filter(r=>r.date.startsWith(statsYear));
    $('stats-month-label').textContent=`${statsYear}년 전체`;
  } else {
    targetRecords=records.filter(r=>r.date.startsWith(month));
    const [y,m]=month.split('-').map(Number);
    $('stats-month-label').textContent=`${y}년 ${m}월`;
  }

  const totalIncome=total(targetRecords,r=>r.fare+r.tip),totalExpense=total(targetRecords,r=>fee(r)+r.toll+r.transit),totalNet=total(targetRecords,net);
  const uniqueDays=new Set(targetRecords.map(r=>r.date)).size,tripCount=targetRecords.length;
  $('stats-count').textContent=`${tripCount}건`;
  $('stats-days').textContent=`${uniqueDays}일`;
  $('stats-income').textContent=money(totalIncome);
  $('stats-expense').textContent=money(totalExpense);
  $('stats-profit').textContent=money(totalNet);
  $('stats-avg-day').textContent=uniqueDays?money(Math.round(totalNet/uniqueDays)):'0원';
  $('stats-avg-trip').textContent=tripCount?money(Math.round(totalNet/tripCount)):'0원';
  $('stats-avg-fare').textContent=tripCount?money(Math.round(total(targetRecords,r=>r.fare)/tripCount)):'0원';
  const tipTrips=targetRecords.filter(r=>r.tip>0);
  $('stats-tip').textContent=`${money(total(targetRecords,r=>r.tip))} (${tipTrips.length}건)`;
  $('stats-types').innerHTML=['탁송 운전','대리 운전'].map(t=>{
    const list=targetRecords.filter(r=>r.type===t),tNet=total(list,net),label=t==='탁송 운전'?'탁송':'대리';
    return `<div class="stats-card"><div class="stats-card-header"><span class="trip-type">${label}</span><strong>${list.length}건</strong></div><div class="stats-card-body"><div><span>수입</span> ${money(total(list,r=>r.fare+r.tip))}</div><div><span>수익</span> <strong class="stats-profit-val">${money(tNet)}</strong></div></div></div>`;
  }).join('');
  const apps=['로지','아이콘','콜마너','카카오대리','T대리','오픈마일'];
  const activeApps=apps.filter(app=>targetRecords.some(r=>r.app===app));
  $('stats-apps').innerHTML=activeApps.length?activeApps.map(app=>{
    const list=targetRecords.filter(r=>r.app===app),aNet=total(list,net);
    return `<div class="stats-app-row"><span class="trip-app"><img src="images/${appIcon(app)}" alt="">${esc(app)}</span><span class="stats-app-count">${list.length}건</span><strong class="stats-app-profit">${money(aNet)}</strong></div>`;
  }).join(''):`<div class="stats-empty">${isYear?'기록된 연간 운행이 없습니다.':'기록된 앱 운행이 없습니다.'}</div>`;
  $('stats-fee').textContent=money(total(targetRecords,fee));
  $('stats-toll').textContent=money(total(targetRecords,r=>r.toll));
  $('stats-transit').textContent=money(total(targetRecords,r=>r.transit));
  $('stats-bad').textContent=`${targetRecords.filter(r=>r.mood==='나쁨').length}건`;
  $('stats-normal').textContent=`${targetRecords.filter(r=>r.mood==='보통').length}건`;
  $('stats-good').textContent=`${targetRecords.filter(r=>r.mood==='좋음').length}건`;
}
$('stats-open').onclick=()=>{
  if(statsMode==='year'){
    location.hash='stats-year/'+statsYear;
  } else {
    location.hash='stats/'+month;
  }
};
$('settings-open').onclick=()=>{$('settings-rate').value=settings.commissionRate;$('settings-theme').value=settings.theme;$('settings-dialog').showModal()};
for(const id of ['settings-close','settings-cancel'])$(id).onclick=()=>$('settings-dialog').close();
$('settings-form').onsubmit=e=>{e.preventDefault();const next={commissionRate:Number($('settings-rate').value),theme:$('settings-theme').value};if(!Number.isFinite(next.commissionRate)||next.commissionRate<0||next.commissionRate>100||!['dark','light'].includes(next.theme))return;try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(next))}catch{toast('설정을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');return}settings=next;applySettings();render();preview();$('settings-dialog').close();toast('설정을 저장했습니다.')};

function sizeBottomTotal(){
  if(document.body.classList.contains('stats-page')){
    document.documentElement.style.setProperty('--bottom-total-height','20px');
    return;
  }
  const panel=document.querySelector(document.body.classList.contains('daily-page')?'.daily-bottom':'.monthly');
  if(panel)document.documentElement.style.setProperty('--bottom-total-height',`${Math.ceil(panel.getBoundingClientRect().height)+12}px`);
}
const totalsObserver=new ResizeObserver(sizeBottomTotal);
for(const panel of document.querySelectorAll('.monthly,.daily-bottom'))totalsObserver.observe(panel);
window.addEventListener('hashchange',()=>requestAnimationFrame(sizeBottomTotal));
sizeBottomTotal();

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(err=>{
      console.warn('SW registration failed:',err);
    });
  });
}
