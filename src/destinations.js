/* Actual saved trips only; keep destination selection separate from questionnaire editing. */
(()=>{
 const key='ootrip-destinations',linksKey='ootrip-destination-looks',sessionLooks=new Map();let returnFocus=null;
 const id=trip=>[trip.destination,trip.departure,trip.returnDate].join('|');
 function normalize(trip){if(!trip||typeof trip.destination!=='string'||!trip.destination.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(trip.departure)||!/^\d{4}-\d{2}-\d{2}$/.test(trip.returnDate)||trip.returnDate<trip.departure)return null;const days=(Date.parse(trip.returnDate+'T12:00:00Z')-Date.parse(trip.departure+'T12:00:00Z'))/86400000+1;if(!Number.isFinite(days)||days<1||days>366)return null;return {age:trip.age,styles:Array.isArray(trip.styles)?trip.styles.filter(x=>typeof x==='string'):[],destination:trip.destination.trim().slice(0,80),departure:trip.departure,returnDate:trip.returnDate,days,scene:typeof trip.scene==='string'?trip.scene.slice(0,80):'',sceneChoice:typeof trip.sceneChoice==='string'?trip.sceneChoice:'',confirmedAt:trip.confirmedAt}}
 function read(){try{const items=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(items)?items.map(normalize).filter(Boolean):[]}catch{return[]}}
 function remember(trip){const valid=normalize(trip);if(!valid)return;const items=read().filter(x=>id(x)!==id(valid));items.unshift(valid);try{localStorage.setItem(key,JSON.stringify(items.slice(0,50)))}catch{}}
 function snapshot(){const trip=normalize(getTripData());if(!trip)return;remember(trip);sessionLooks.set(id(trip),[...dailyOutfitImages]);try{const refs=JSON.parse(localStorage.getItem(linksKey)||'{}');refs[id(trip)]=[...dailyOutfitImages].map(([day,url])=>[day,savedOutfits.findIndex(look=>look.url===url)]).filter(([,index])=>index>=0);localStorage.setItem(linksKey,JSON.stringify(refs))}catch{}}
 function restoreLooks(trip){dailyOutfitImages.clear();let looks=sessionLooks.get(id(trip));if(!looks){try{looks=(JSON.parse(localStorage.getItem(linksKey)||'{}')[id(trip)]||[]).map(([day,index])=>[day,savedOutfits[index]?.url]).filter(([,url])=>typeof url==='string')}catch{looks=[]}}for(const[day,url]of looks||[])if(day>=0&&day<trip.days)dailyOutfitImages.set(day,url);activeTripDay=0;uploadDay=0}
 function close(immediate=false){const layer=document.getElementById('destination-layer');if(!layer)return;layer.removeAttribute('id');layer.classList.add('is-closing');const remove=()=>{layer.remove();if(!document.getElementById('destination-layer'))document.querySelector('.phone-frame').classList.remove('destination-panel-open')};if(immediate)remove();else setTimeout(remove,180);if(returnFocus?.isConnected)returnFocus.focus();returnFocus=null}

 function fixedArtwork(city){const name=String(city||'').normalize('NFKC').trim().toLowerCase();if(/广州|guangzhou|canton/.test(name))return 'assets/destinations/guangzhou-abstract-fixed.png';if(/杭州|hangzhou|西湖|雷峰塔/.test(name))return 'assets/destinations/hangzhou-abstract-fixed.png';return null}
 const artwork=new Map(),jobs=new Map(),errors=new Map();
 function coverFor(city){if(fixedArtwork(city))return {image:fixedArtwork(city),label:city+'抽象景点图'};return artwork.has(city)?{image:artwork.get(city),label:city+'抽象景点图'}:null}
 function updateCovers(city){document.querySelectorAll('.destination-card-cover').forEach(el=>{if(el.dataset.city===city)paintCover(el,city)})}
 function paintCover(el,city){
  el.replaceChildren();el.onclick=null;el.onkeydown=null;el.removeAttribute('tabindex');el.setAttribute('role','img');el.removeAttribute('title');el.style.backgroundImage='none';el.style.backgroundColor='#F3F0E8';
  if(artwork.has(city)){el.style.backgroundImage='url("'+artwork.get(city)+'")';el.style.backgroundSize='contain';el.style.backgroundPosition='center';el.style.backgroundRepeat='no-repeat';el.setAttribute('aria-label',city+'抽象景点图');return}
  const label=document.createElement('span');label.textContent=jobs.has(city)?'景点绘制中…':errors.has(city)?'点击重试':'生成景点';el.append(label);
  el.setAttribute('aria-label',city+'：'+(errors.get(city)||label.textContent));
  el.title=errors.get(city)||label.textContent;
  el.setAttribute('role','button');el.tabIndex=0;
  const retry=e=>{e.preventDefault();e.stopPropagation();if(!jobs.has(city))generate(city,true)};
  el.onclick=retry;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')retry(e)};
 }
 async function loadCover(city){try{const r=await fetch('/destinations/artwork?'+new URLSearchParams({city}));if(r.ok){const data=await r.json();if(/^data:image\/png;base64,/.test(data.image)){artwork.set(city,data.image);updateCovers(city)}}}catch{}}
 function cover(city){if(fixedArtwork(city))artwork.set(city,fixedArtwork(city));const el=document.createElement('span');el.className='destination-card-cover';el.dataset.city=city;paintCover(el,city);if(!artwork.has(city)&&!jobs.has(city))loadCover(city);return el}
 function generate(city,retry=false){
  if(fixedArtwork(city)){artwork.set(city,fixedArtwork(city));updateCovers(city);return Promise.resolve()}
  if(artwork.has(city)||jobs.has(city))return jobs.get(city);
  const task=(async()=>{try{
   const session=await fetch('/destinations/session');if(!session.ok)throw Error('请重启网页服务以启用景点生成');const {nonce}=await session.json();
   const r=await fetch('/destinations/artwork',{method:'POST',headers:{'Content-Type':'application/json','x-lucy-experiment':nonce},body:JSON.stringify({city,consent:true,retry})});
   const data=await r.json();if(!r.ok)throw Error(data.message||'景点生成失败');if(!/^data:image\/png;base64,/.test(data.image))throw Error('景点图片无效');artwork.set(city,data.image);errors.delete(city);
  }catch(error){errors.set(city,error.message||'景点生成失败')}finally{jobs.delete(city);updateCovers(city)}})();
  jobs.set(city,task);updateCovers(city);return task;
 }
 function switchTrip(trip){snapshot();destination=trip.destination;departure=trip.departure;returnDate=trip.returnDate;selectedAge=trip.age||selectedAge;caught=new Set(trip.styles);selected=new Set(trip.styles);tripScene=tripScenes.includes(trip.sceneChoice)?trip.sceneChoice:tripScenes.includes(trip.scene)?trip.scene:trip.scene?'自定义':'';customTripScene=tripScene==='自定义'?trip.scene:'';restoreLooks(trip);remember(trip);try{localStorage.setItem('ootrip-confirmed-trip',JSON.stringify({...trip,confirmedAt:new Date().toISOString()}));localStorage.setItem('ootrip-trip',JSON.stringify(trip))}catch{}close(true);showWardrobe('ai')}
 function addTrip(){snapshot();close(true);destination='';departure='';returnDate='';tripScene='';customTripScene='';dateTarget='departure';const parts=beijingToday().split('-').map(Number);viewMonth=new Date(parts[0],parts[1]-1,1);dailyOutfitImages.clear();activeTripDay=0;uploadDay=0;document.body.classList.remove('wardrobe-mode','me-mode');document.getElementById('wardrobe-nav')?.remove();showTrip(3)}
 const placeKey=city=>String(city||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,'');
 function groupedTrips(items,current){const groups=new Map();for(const trip of items){const key=placeKey(trip.destination);let group=groups.get(key);if(!group){group={trip,count:0,visits:new Set()};groups.set(key,group)}const visit=trip.departure+'|'+trip.returnDate;if(!group.visits.has(visit)){group.visits.add(visit);group.count++}if(current&&id(trip)===id(current))group.trip=trip;else if((!current||id(group.trip)!==id(current))&&trip.departure>group.trip.departure)group.trip=trip}return [...groups.values()]}
 function open(){close(true);snapshot();returnFocus=document.activeElement;const layer=document.createElement('div');layer.id='destination-layer';layer.className='destination-layer';layer.innerHTML='<button class="destination-backdrop" aria-label="关闭我的目的地"></button><section class="destination-sheet" role="dialog" aria-label="我的目的地"><button class="destination-grip" aria-label="下滑或点击关闭目的地面板"></button><div class="destination-sheet-head"><h2>我的目的地</h2><span class="destination-sheet-hint">左右滑动查看更多 ›</span></div><div class="destination-cards" aria-label="已保存的目的地"></div><p class="destination-sheet-message" role="status"></p></section>';
 const frame=document.querySelector('.phone-frame'),nav=document.getElementById('wardrobe-nav');
 frame.classList.add('destination-panel-open');
 if(nav){const frameRect=frame.getBoundingClientRect(),navRect=nav.getBoundingClientRect(),scale=frameRect.height/frame.offsetHeight;layer.style.setProperty('--destination-nav-inset',Math.max(0,frame.clientHeight-((navRect.top-frameRect.top)/scale-frame.clientTop))+'px')}
 const list=layer.querySelector('.destination-cards'),add=document.createElement('button');add.type='button';add.className='destination-card destination-card-add';add.innerHTML='<span aria-hidden="true">＋</span><small>新增</small>';add.setAttribute('aria-label','新增目的地');add.onclick=addTrip;list.append(add);
 enableCarouselDrag(list);list.setAttribute('aria-label','我的目的地，可左右拖动或按方向键切换');const current=normalize(getTripData());for(const {trip,count} of groupedTrips(read(),current)){const button=document.createElement('button');button.type='button';button.className='destination-card';button.setAttribute('aria-current',String(Boolean(current&&placeKey(trip.destination)===placeKey(current.destination))));button.append(cover(trip.destination));const name=document.createElement('strong'),date=document.createElement('small');name.textContent=trip.destination;date.textContent='去过 '+count+' 次';button.title=trip.destination+' · 去过 '+count+' 次 · 当前行程 '+trip.departure+'—'+trip.returnDate;button.append(name,date);button.onclick=()=>switchTrip(trip);list.append(button)}
 if(!read().length)layer.querySelector('.destination-sheet-message').textContent='新增目的地，开始规划下一次出行。';
 layer.querySelector('.destination-backdrop').onclick=()=>close();const grip=layer.querySelector('.destination-grip');grip.onclick=()=>close();let start=null;grip.onpointerdown=e=>{start={x:e.clientX,y:e.clientY};grip.setPointerCapture(e.pointerId)};grip.onpointermove=e=>{if(start&&e.clientY-start.y>45&&e.clientY-start.y>Math.abs(e.clientX-start.x)){start=null;close()}};grip.onpointerup=grip.onpointercancel=()=>{start=null};document.querySelector('.phone-frame').append(layer);grip.focus()}
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.getElementById('destination-layer')){event.preventDefault();close()}});
 window.OotripDestinations={open,close,remember,read,coverFor,generate,groupedTrips};
})();
