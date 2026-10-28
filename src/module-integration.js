(()=>{
 const service=location.origin;let activeFrame=null,opening=0;
 const localEntry='http://127.0.0.1:3100/app/index.html';
 const savedOutfitPrefix='saved-outfit-',outfitImages=new Map();
 function outfitId(url){let first=2166136261,second=5381;for(let i=0;i<url.length;i++){const code=url.charCodeAt(i);first=Math.imul(first^code,16777619);second=Math.imul(second,33)^code}return savedOutfitPrefix+(first>>>0).toString(16)+(second>>>0).toString(16)}
 async function outfitImage(url){
  if(/^data:image\/(png|jpeg|webp);base64,/.test(url)&&url.length<=8*1024*1024)return url;
  if(!/^ai-chat\/assets\/(look[123]|look3-sneakers|day[34]|pack[123]|colorful|extra-look[123])\.jpg$/.test(url))return null;
  if(!outfitImages.has(url)){const task=(async()=>{const response=await fetch(new URL(url,location.href),{credentials:'same-origin'});if(!response.ok)throw Error('搭配图片读取失败');const blob=await response.blob();if(!/^image\/(png|jpeg|webp)$/.test(blob.type)||blob.size>6*1024*1024)throw Error('搭配图片格式不正确');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('搭配图片读取失败'));reader.readAsDataURL(blob)})})();outfitImages.set(url,task);task.catch(()=>outfitImages.delete(url))}
  return outfitImages.get(url);
 }
 async function savedOutfitGarments(){
  let looks;try{looks=JSON.parse(localStorage.getItem('ootrip-saved-outfits')||'[]')}catch{return []}if(!Array.isArray(looks))return [];
  const garments=[],seen=new Set();for(const [index,look]of looks.entries()){if(!look||typeof look.url!=='string'||seen.has(look.url))continue;seen.add(look.url);try{const image=await outfitImage(look.url);if(image)garments.push({id:outfitId(look.url),name:typeof look.name==='string'?look.name.slice(0,100):'搭配 '+(index+1),category:'套装',image,purchased:true})}catch{}}
  return garments;
 }
 function closeModule(){opening++;const pane=document.getElementById('ootrip-module'),frame=activeFrame;activeFrame=null;if(!pane)return;if(frame){pane.removeAttribute('id');pane.style.display='none';frame.contentWindow?.postMessage({type:'ootrip:module-close'},service);setTimeout(()=>pane.remove(),150)}else pane.remove()}
 function note(title,text){closeModule();const pane=document.createElement('section');pane.id='ootrip-module';pane.className='ootrip-module';pane.innerHTML='<header class="ootrip-module-header"><button type="button">‹ 返回</button><h2></h2></header><div class="ootrip-module-note"></div>';pane.querySelector('h2').textContent=title;pane.querySelector('button').onclick=closeModule;pane.querySelector('.ootrip-module-note').textContent=text;document.querySelector('.phone-frame').append(pane);return pane}
 window.closeOotripModule=closeModule;
 window.openOotripModule=async kind=>{
  if(!['fitting','journal'].includes(kind))return;
  const title=kind==='fitting'?'试衣间':'穿衣手账';
  const pane=note(title,'正在连接服务…'),ticket=opening;
  if(!['http:','https:'].includes(location.protocol)){
   pane.lastChild.textContent='请先双击项目中的“启动OOTRIP.cmd”，再使用统一主页 '+localEntry+'。直接双击 HTML 无法运行 AI 后端。试衣和手账将在统一主页内部打开。';return;
  }
  try{
   if(location.origin==="http://127.0.0.1:3100"){
   const response=await fetch('/experiment/status',{cache:'no-store',signal:AbortSignal.timeout(5000)});
   if(!response.ok)throw Error();
   const status=await response.json();if(typeof status.configured!=='boolean')throw Error();
   }
   if(ticket!==opening||!pane.isConnected)return;
   pane.lastChild.remove();
   const frame=document.createElement('iframe');frame.title=title;frame.allow='camera';
   const mount=mode=>{if(activeFrame){activeFrame.contentWindow?.postMessage({type:'ootrip:module-close'},service);activeFrame.remove()}const next=document.createElement('iframe');next.title=mode==='photo'?'照片试衣':mode==='realtime'?'实时试衣':title;next.allow='camera';const route=mode==='photo'?'photo-screen':mode==='realtime'?'fitting-screen':'journal-screen';next.src=(location.origin==='http://127.0.0.1:3100'?'/'+route:'modules/'+route+'.html')+'?integrated=1';activeFrame=next;pane.append(next)};
   if(kind==='fitting'){const tabs=document.createElement('div');tabs.className='ootrip-fitting-tabs';tabs.setAttribute('role','tablist');for(const [id,label]of [['photo','照片试衣'],['realtime','实时试衣']]){const button=document.createElement('button');button.textContent=label;button.setAttribute('role','tab');button.onclick=()=>{for(const tab of tabs.children)tab.setAttribute('aria-selected',String(tab===button));mount(id)};tabs.append(button)}pane.append(tabs);tabs.firstChild.click()}else {mount('journal');pane.querySelector('button').onclick=()=>activeFrame?.contentWindow?.postMessage({type:'ootrip:journal-back'},service)};
  }catch{
   if(ticket!==opening||!pane.isConnected)return;
   pane.lastChild.textContent='当前地址没有连接 OOTRIP 后端。请启动项目中的“启动OOTRIP.cmd”，使用统一主页 '+localEntry+'，然后在主页内打开此功能。';
   const retry=document.createElement('button');retry.textContent='重新连接';retry.onclick=()=>openOotripModule(kind);pane.lastChild.append(retry);
  }
 };
 window.addEventListener('message',async event=>{
  const d=event.data;
  if(event.source===document.getElementById('personal-frame')?.contentWindow&&event.origin===location.origin&&d?.type==='ootrip:open-module')return openOotripModule(d.module);
  if(event.origin!==service||event.source!==activeFrame?.contentWindow)return;
  if(d?.type==='ootrip:journal-exit'&&activeFrame?.src.includes('/journal-screen'))return closeModule();
  if(d?.type!=='ootrip:wardrobe-rpc')return;
  const source=event.source;
  try{let result;if(d.method==='read'){result=await OotripWardrobe.read();if(activeFrame?.src.includes('photo-screen')||activeFrame?.src.includes('fitting-screen'))result=[...result,...await savedOutfitGarments()]}else if(d.method==='selection')result=typeof outfitDraft==='undefined'?[]:outfitDraft.map(x=>({...x,url:x.originalUrl||x.url})).filter(x=>typeof x.url==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(x.url)).map(x=>({id:x.id,name:x.name||x.category,category:x.category,image:x.url,purchased:true}));else if(d.method==='save'&&Array.isArray(d.items)&&d.items.length<=100){if(d.items.some(item=>typeof item?.id==='string'&&item.id.startsWith(savedOutfitPrefix)))throw Error('请在“选择已有搭配”中管理这套搭配。');await OotripWardrobe.save(d.items,d.remove===true);result=true}else throw Error('不支持的衣橱操作');if(source===activeFrame?.contentWindow)source.postMessage({type:'ootrip:wardrobe-result',id:d.id,result},service)}catch(error){if(source===activeFrame?.contentWindow)source.postMessage({type:'ootrip:wardrobe-result',id:d.id,error:error.message},service)}
 });
 const hydrate=()=>{if(typeof closetItems==='undefined')return;const custom=OotripWardrobe.cache.filter(x=>!x.id.startsWith('library-')&&!x.id.startsWith('outfit-example-')).map(x=>({...x,url:x.image}));closetItems.splice(0,closetItems.length,...custom);if(document.getElementById('closet-items')){updateClosetResults();setupClosetSides()}};
 window.addEventListener('ootrip:wardrobe-changed',hydrate);const params=new URLSearchParams(location.search);if(location.pathname==='/journal')params.set('module','journal');
 async function bootstrap(){await OotripWardrobe.ready;hydrate();try{const trip=JSON.parse(localStorage.getItem('ootrip-confirmed-trip')||localStorage.getItem('ootrip-trip')||'null');if(trip){destination=typeof trip.destination==='string'?trip.destination:'';departure=typeof trip.departure==='string'?trip.departure:'';returnDate=typeof trip.returnDate==='string'?trip.returnDate:'';selectedAge=trip.age||selectedAge;tripScene=tripScenes.includes(trip.sceneChoice)?trip.sceneChoice:tripScenes.includes(trip.scene)?trip.scene:trip.scene?'自定义':'';customTripScene=tripScene==='自定义'&&typeof trip.scene==='string'?trip.scene:'';if(Array.isArray(trip.styles)){caught.clear();trip.styles.forEach(x=>caught.add(x))}}if(typeof savedOutfits!=='undefined')savedOutfits=JSON.parse(localStorage.getItem('ootrip-saved-outfits')||'[]').filter(x=>typeof x.url==='string')}catch{}if(location.origin===service&&['fitting','journal'].includes(params.get('module'))){document.body.classList.remove('age-mode','style-form-mode');document.body.classList.add('trip-mode');document.getElementById('age-page')?.classList.add('hide');document.getElementById('style-form')?.classList.add('hide');document.getElementById('trip-page')?.classList.remove('hide');showWardrobe(params.get('module')==='fitting'?'closet':'me');openOotripModule(params.get('module'));history.replaceState(null,'',location.pathname)}}
 bootstrap().catch(error=>note('衣橱存储',error.message));
})();
