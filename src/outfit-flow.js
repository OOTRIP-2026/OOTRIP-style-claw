/* Outfit creation: action sheet, clothing picker, movable canvas, saved looks. */
const outfitCatalog=[['外套','风衣'],['上衣','针织衫'],['上衣','蓝衬衫'],['裤子','牛仔裤'],['配饰','手提包'],['鞋子','运动鞋']].map(([category,name],i)=>({id:'sample-'+i,category,name,url:outfitGarmentImages[i]}));
let outfitDraft=[],outfitSelection=new Set(),outfitFilter='全部',outfitBackground='#f1ebe2',outfitReturnFocus=null,outfitStageObserver=null;
let savedOutfits=[];try{savedOutfits=JSON.parse(localStorage.getItem('ootrip-saved-outfits')||'[]').filter(x=>typeof x.url==='string')}catch{}
function availableOutfitClothes(){return [...outfitCatalog,...closetItems.map((x,i)=>({...x,id:'personal-'+i}))]}
function removeOutfitLayer(){outfitStageObserver?.disconnect();outfitStageObserver=null;document.querySelector('#outfit-layer')?.remove();document.body.classList.remove('outfit-editor-mode')}
function outfitModal(markup,label){removeOutfitLayer();const layer=document.createElement('div');layer.id='outfit-layer';layer.className='outfit-layer';layer.innerHTML=markup;layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label',label);document.querySelector('.phone-frame').append(layer);layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeOutfitFlow()}if(e.key==='Tab'){const focus=[...layer.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"],select')];if(!focus.length)return;const first=focus[0],last=focus.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});requestAnimationFrame(()=>layer.querySelector('button:not(:disabled)')?.focus());return layer}
function closeOutfitFlow(){removeOutfitLayer();outfitReturnFocus?.focus()}
function showOutfitActions(){if(!document.activeElement?.closest('#outfit-layer'))outfitReturnFocus=document.activeElement;const layer=outfitModal(`<button class="outfit-dimmer" aria-label="关闭新增穿搭菜单"></button><section class="outfit-actions"><span class="sheet-grip"></span><div class="outfit-action-row"><button data-create="free">自由选择衣物</button><button data-create="saved">选中已有搭配</button><button data-create="ai">ai搭配</button></div></section>`,'添加新的穿搭');layer.querySelector('.outfit-dimmer').onclick=closeOutfitFlow;layer.querySelector('[data-create="free"]').onclick=()=>openOutfitCanvas();layer.querySelector('[data-create="saved"]').onclick=showSavedOutfits;layer.querySelector('[data-create="ai"]').onclick=()=>openAIChat()}
function showSavedOutfits(){const layer=outfitModal(`<button class="outfit-dimmer" aria-label="关闭已有搭配"></button><section class="saved-outfit-sheet"><span class="sheet-grip"></span><h2>选择已有搭配</h2><div class="saved-outfit-list"></div><button class="outfit-soft-button" id="saved-new">新建搭配</button></section>`,'选择已有搭配');layer.querySelector('.outfit-dimmer').onclick=closeOutfitFlow;const list=layer.querySelector('.saved-outfit-list');if(!savedOutfits.length){const p=document.createElement('p');p.textContent='还没有保存的搭配，先自由选择衣物创建一套吧。';list.append(p)}savedOutfits.forEach((look,i)=>{const b=document.createElement('button'),img=document.createElement('img'),label=document.createElement('span');img.src=look.url;img.alt='已保存的搭配 '+(i+1);label.textContent='搭配 '+(i+1);b.append(img,label);b.onclick=()=>{dailyOutfitImages.set(uploadDay,look.url);removeOutfitLayer();showWardrobe('ai')};list.append(b)});layer.querySelector('#saved-new').onclick=()=>openOutfitCanvas()}
function openOutfitCanvas(recommend=false){outfitDraft=[];outfitSelection.clear();outfitFilter='全部';outfitBackground='#f1ebe2';const layer=outfitModal(`<section class="outfit-editor"><div class="outfit-editor-head"><button id="canvas-back" aria-label="返回首页">‹</button><h2>搭配画布</h2><button id="canvas-save"><span>▧</span> 保存搭配</button></div><div class="outfit-workspace" id="outfit-workspace" aria-label="搭配画布"><label class="canvas-color" aria-label="画布背景颜色"><input id="canvas-color" type="color" value="#f1ebe2"><span>⌄</span></label><div id="outfit-stage" class="outfit-stage"></div></div><section class="outfit-picker"><span class="sheet-grip"></span><h3><button id="outfit-picker-toggle" aria-expanded="true">选择衣物 <span>⌃</span></button></h3><div class="outfit-filters" id="outfit-filters"></div><div class="outfit-clothes" id="outfit-clothes"></div><div class="outfit-picker-footer"><p id="outfit-picker-hint" role="status">先选择要放上画布的衣物</p><button id="outfit-place" disabled>添加到画布</button></div></section></section>`,'搭配画布');document.body.classList.add('outfit-editor-mode');layer.querySelector('#canvas-back').onclick=()=>{removeOutfitLayer();showOutfitActions()};layer.querySelector('#canvas-save').onclick=saveOutfitCanvas;layer.querySelector('#outfit-place').onclick=placeSelectedClothes;layer.querySelector('#canvas-color').oninput=e=>{outfitBackground=e.target.value;$('outfit-workspace').style.backgroundColor=outfitBackground};$('outfit-picker-toggle').onclick=()=>{const collapsed=layer.querySelector('.outfit-editor').classList.toggle('has-outfit');$('outfit-picker-toggle').setAttribute('aria-expanded',String(!collapsed));requestAnimationFrame(sizeOutfitStage)};if(typeof ResizeObserver!=='undefined'){outfitStageObserver=new ResizeObserver(sizeOutfitStage);outfitStageObserver.observe($('outfit-workspace'))}requestAnimationFrame(sizeOutfitStage);renderOutfitFilters();renderOutfitClothes();if(recommend){outfitSelection=new Set(['sample-0','sample-1','sample-3','sample-4','sample-5']);placeSelectedClothes();$('outfit-picker-hint').textContent='已为你推荐一套本地衣物组合，可拖动调整'}updateOutfitSave()}
function renderOutfitFilters(){const host=$('outfit-filters');host.replaceChildren();['全部','上衣','内搭','外套','裤子','半身裙','鞋子','配饰'].forEach(category=>{const b=document.createElement('button');b.textContent=category;b.className=category===outfitFilter?'active':'';b.setAttribute('aria-pressed',category===outfitFilter);b.onclick=()=>{outfitFilter=category;renderOutfitFilters();renderOutfitClothes()};host.append(b)})}
function renderOutfitClothes(){const host=$('outfit-clothes');host.replaceChildren();const items=availableOutfitClothes().filter(x=>outfitFilter==='全部'||x.category===outfitFilter);if(!items.length){const p=document.createElement('p');p.className='outfit-no-clothes';p.textContent='这个分类还没有衣物，可在衣橱中添加。';host.append(p)}items.forEach(item=>{const b=document.createElement('button');b.className='outfit-clothing'+(outfitSelection.has(item.id)?' selected':'');b.setAttribute('aria-pressed',outfitSelection.has(item.id));const img=document.createElement('img'),label=document.createElement('span');img.src=item.url;img.alt=item.name;img.draggable=false;label.textContent=item.name;b.append(img,label);b.onclick=()=>{outfitSelection.has(item.id)?outfitSelection.delete(item.id):outfitSelection.add(item.id);renderOutfitClothes()};host.append(b)});$('outfit-place').disabled=!outfitSelection.size;$('outfit-picker-hint').textContent=outfitSelection.size?'已选择 '+outfitSelection.size+' 件衣物':'先选择要放上画布的衣物'}
// Coordinates use a portrait 900 × 1050 canvas, independent of the phone viewport.
function arrangeOutfitClothes(){
 const frames={
  '外套':{x:.025,y:.035,w:.49,h:.79,z:1,rotation:-4},
  '上衣':{x:.37,y:.055,w:.46,h:.41,z:2,rotation:4},
  '内搭':{x:.37,y:.055,w:.46,h:.41,z:2,rotation:4},
  '裤子':{x:.375,y:.37,w:.40,h:.59,z:3,rotation:-2},
  '半身裙':{x:.375,y:.39,w:.43,h:.56,z:3,rotation:-2},
  '配饰':{x:.685,y:.27,w:.30,h:.35,z:4,rotation:5},
  '鞋子':{x:.035,y:.72,w:.34,h:.23,z:5,rotation:-15}
 };
 const groups=new Map();
 outfitDraft.forEach(item=>{const category=item.category==='内搭'?'上衣':item.category;const group=groups.get(category)||[];group.push(item);groups.set(category,group)});
 groups.forEach((items,category)=>items.forEach((item,i)=>{const frame=frames[category]||frames['配饰'];Object.assign(item,frame);if(items.length>1){const scale=items.length===2 ? .77 : .64;item.w*=scale;item.h*=scale;item.x=Math.min(1-item.w,Math.max(.02,frame.x-.10+i*.19));item.y=frame.y+i*.045;item.z+=i*.1}}));
}
function placeSelectedClothes(){
 const all=availableOutfitClothes();
 for(const id of outfitSelection){const item=all.find(x=>x.id===id);if(item&&!outfitDraft.some(x=>x.id===id))outfitDraft.push({...item,key:crypto.randomUUID()})}
 outfitSelection.clear();arrangeOutfitClothes();renderCanvasClothes();renderOutfitClothes();updateOutfitSave();
 document.querySelector('.outfit-editor').classList.add('has-outfit');$('outfit-picker-toggle').setAttribute('aria-expanded','false');requestAnimationFrame(sizeOutfitStage);
}
function sizeOutfitStage(){const workspace=$('outfit-workspace'),stage=$('outfit-stage');if(!workspace||!stage)return;const width=Math.min(workspace.clientWidth-12,(workspace.clientHeight-12)*6/7);stage.style.width=Math.max(1,width)+'px';stage.style.height=Math.max(1,width*7/6)+'px'}
function updateOutfitSave(){$('canvas-save').disabled=!outfitDraft.length}
function renderCanvasClothes(){
 const host=$('outfit-stage');host.replaceChildren();
 [...outfitDraft].sort((a,b)=>a.z-b.z).forEach(item=>{
  const tile=document.createElement('div');tile.className='canvas-clothing';tile.style.cssText=`left:${item.x*100}%;top:${item.y*100}%;width:${item.w*100}%;height:${item.h*100}%;z-index:${Math.round(item.z*10)};transform:rotate(${item.rotation}deg)`;
  tile.tabIndex=0;tile.setAttribute('role','group');tile.setAttribute('aria-label',item.name+'，方向键移动');
  const img=document.createElement('img');img.src=item.url;img.alt=item.name;img.draggable=false;
  const remove=document.createElement('button');remove.className='canvas-remove';remove.textContent='×';remove.setAttribute('aria-label','移除'+item.name);
  remove.onclick=()=>{outfitDraft=outfitDraft.filter(x=>x.key!==item.key);renderCanvasClothes();updateOutfitSave()};tile.append(img,remove);
  function move(x,y){item.x=Math.max(0,Math.min(1-item.w,x));item.y=Math.max(0,Math.min(1-item.h,y));tile.style.left=item.x*100+'%';tile.style.top=item.y*100+'%'}
  let drag;
  tile.onpointerdown=e=>{if(e.target===remove)return;drag={x:e.clientX,y:e.clientY,left:item.x,top:item.y};tile.setPointerCapture(e.pointerId);tile.focus({preventScroll:true});e.preventDefault()};
  tile.onpointermove=e=>{if(drag)move(drag.left+(e.clientX-drag.x)/host.clientWidth,drag.top+(e.clientY-drag.y)/host.clientHeight)};
  tile.onpointerup=tile.onpointercancel=()=>{drag=null};
  tile.onkeydown=e=>{const delta={ArrowLeft:[-.02,0],ArrowRight:[.02,0],ArrowUp:[0,-.02],ArrowDown:[0,.02]}[e.key];if(delta){e.preventDefault();move(item.x+delta[0],item.y+delta[1])}};
  host.append(tile);
 });
}
async function saveOutfitCanvas(){
 if(!outfitDraft.length)return;
 const button=$('canvas-save');button.disabled=true;button.textContent='保存中…';
 try{
  const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1050;
  const ctx=canvas.getContext('2d');ctx.fillStyle=outfitBackground;ctx.fillRect(0,0,900,1050);
  for(const item of [...outfitDraft].sort((a,b)=>a.z-b.z)){
   const img=new Image();img.src=item.url;await img.decode();
   const boxWidth=item.w*900,boxHeight=item.h*1050,scale=Math.min(boxWidth/img.naturalWidth,boxHeight/img.naturalHeight),width=img.naturalWidth*scale,height=img.naturalHeight*scale;
   ctx.save();ctx.translate((item.x+item.w/2)*900,(item.y+item.h/2)*1050);ctx.rotate(item.rotation*Math.PI/180);ctx.shadowColor='rgba(60,43,24,.16)';ctx.shadowBlur=12;ctx.shadowOffsetY=5;ctx.drawImage(img,-width/2,-height/2,width,height);ctx.restore();
  }
  const url=canvas.toDataURL('image/webp',.94),looks=[...savedOutfits,{version:2,url,items:outfitDraft.map(({id,category,name,x,y,w,h,z,rotation})=>({id,category,name,x,y,w,h,z,rotation})),createdAt:Date.now()}];
  localStorage.setItem('ootrip-saved-outfits',JSON.stringify(looks));savedOutfits=looks;dailyOutfitImages.set(uploadDay,url);outfitImages.push(url);activeTripDay=uploadDay;removeOutfitLayer();showWardrobe('ai');$('wardrobe-message').textContent='搭配已保存，并添加到第 '+(uploadDay+1)+' 天';
 }catch{$('outfit-picker-hint').textContent='保存失败，请减少衣物后重试。';document.querySelector('.outfit-editor').classList.remove('has-outfit');$('outfit-picker-toggle').setAttribute('aria-expanded','true');button.textContent='保存搭配';button.disabled=false}
}

function openAIChat(){const trip=getTripData();const layer=outfitModal('<iframe id="ai-chat-frame" title="AI搭配对话" style="display:block;width:100%;height:100%;border:0;background:#f8f5ee"></iframe>','AI搭配');layer.style.cssText='position:absolute;inset:0;z-index:100;overflow:hidden;border-radius:inherit;background:#f8f5ee';layer.querySelector('iframe').src='ai-chat/index.html#trip='+encodeURIComponent(JSON.stringify(trip));}
function chatLookStorageKey(trip){return 'ootrip-chat-applied:'+JSON.stringify([trip.destination,trip.departure,trip.returnDate])}
function restoreChatLooks(trip){try{const records=JSON.parse(localStorage.getItem(chatLookStorageKey(trip))||'[]');if(!Array.isArray(records))return;for(const x of records)if(Number.isInteger(x.day)&&x.day>=1&&x.day<=trip.days&&['look1','look2','look3','day3','day4','pack1','pack2','pack3','colorful'].includes(x.image)&&!dailyOutfitImages.has(x.day-1))dailyOutfitImages.set(x.day-1,'ai-chat/assets/'+x.image+'.jpg')}catch{}}
window.addEventListener('message',event=>{const frame=document.getElementById('ai-chat-frame');if(!frame||event.source!==frame.contentWindow||event.origin!==location.origin)return;const data=event.data;
if(data?.type==='ootrip:chat-back'){removeOutfitLayer();showWardrobe('ai');return}
if(data?.type!=='ootrip:chat-finish')return;const trip=getTripData(),looks=data.looks;if(!Array.isArray(looks)||looks.length>trip.days||looks.some(x=>!x||!Number.isInteger(x.day)||x.day<1||x.day>trip.days||!['look1','look2','look3','day3','day4','pack1','pack2','pack3','colorful'].includes(x.image)))return;
try{if(looks.length){const key=chatLookStorageKey(trip);let prior=[];try{prior=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(prior))prior=[]}catch{}const merged=new Map(prior.filter(x=>x&&Number.isInteger(x.day)).map(x=>[x.day,x]));for(const look of looks)merged.set(look.day,{day:look.day,image:look.image});localStorage.setItem(key,JSON.stringify([...merged.values()]));for(const look of looks)dailyOutfitImages.set(look.day-1,'ai-chat/assets/'+look.image+'.jpg');activeTripDay=looks.at(-1).day-1;uploadDay=activeTripDay}removeOutfitLayer();showWardrobe('ai');$('wardrobe-message').textContent=looks.length?'已同步 '+looks.length+' 天的穿搭方案':'已结束对话'}catch{frame.contentWindow.postMessage({type:'ootrip:chat-sync-error',message:'保存失败，请重试后再结束对话'},location.origin)}});
