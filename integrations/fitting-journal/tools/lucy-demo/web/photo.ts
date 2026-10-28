import { horizontalScroll } from './horizontal-scroll.js';
async function apiFetch(route:string,options:RequestInit={}){const headers=new Headers(options.headers);if(options.method==='POST')headers.set('x-lucy-experiment',document.querySelector<HTMLMetaElement>('meta[name="lucy-experiment"]')!.content);return fetch(route,{...options,headers})}
import {readWardrobe, readCanvasSelection, importGarment, referenceImage, selectRealtimeGarment, REALTIME_CATEGORIES, saveGarments, type Garment} from './store.js';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
let person='',result='',items:Garment[]=[],selected:Garment[]=[],category='上衣',configured=false,busy=false,closed=false;
let selectedModelShape='';
function presetFittingPreview(shape:string,garments:readonly Garment[]){
 if(garments.length!==1)return '';
 const presets:Record<string,string>={
  'hourglass:saved-outfit-b227acfbd0ead44f':'gingham-hourglass-hd-v2.png',
  'straight:saved-outfit-b227acfbd0ead44f':'gingham-straight-hd-v2.png',
  'pear:saved-outfit-b665af21d10cf54d':'khaki-pear-hd-v1.png',
  'pear:saved-outfit-86d36292d0fbed4c':'cream-pear-hd-v1.png'
 };
 const asset=presets[shape+':'+garments[0]?.id];if(!asset)return '';
 const root=location.pathname==='/photo-screen'?'/app/assets/fitting-previews/':'../assets/fitting-previews/';
 return root+asset;
}
function applyPresetFittingPreview(){
 if(result||!person)return;const preview=presetFittingPreview(selectedModelShape,selected);if(!preview)return;
 result=preview;el('result-preview').classList.add('builtin-preset');el<HTMLImageElement>('result-preview').src=preview;el<HTMLImageElement>('result-preview').alt=(selectedModelShape==='pear'?'梨型':selectedModelShape==='hourglass'?'沙漏型':'H型')+'已选套装参考效果';el('result-preview').hidden=false;el('person-preview').hidden=true;el('original').textContent='查看原图';el('original').hidden=false;el<HTMLButtonElement>('download-photo').disabled=false;status('已展示这套搭配对应身型的预设参考效果。');
}
let controller:AbortController|undefined;
const status=(message:string)=>{el('photo-status').textContent=message;};
function update(){el<HTMLButtonElement>('photo-start').disabled=busy||!configured||!person||!selected.length||!el<HTMLInputElement>('photo-consent').checked;el<HTMLInputElement>('person-file').disabled=busy;el<HTMLInputElement>('photo-consent').disabled=busy;}
function clearResult(){result='';el('person-preview').hidden=!person;el('original').textContent='查看原图';el('result-preview').hidden=true;el('result-preview').classList.remove('builtin-preset');el('original').hidden=true;el<HTMLButtonElement>('download-photo').disabled=true;applyPresetFittingPreview();}
function renderSelection(){const list=el('photo-selection');list.replaceChildren();if(!selected.length){const hint=document.createElement('span');hint.textContent='尚未选择衣物，点击右侧分类选衣';list.append(hint)}for(const garment of selected){const button=document.createElement('button'),img=document.createElement('img'),label=document.createElement('span');button.type='button';button.setAttribute('aria-label','取消选择'+garment.name);img.src=garment.image;img.alt=garment.name;label.textContent=garment.category+' ×';button.append(img,label);button.onclick=()=>{if(busy)return;selected=selected.filter(x=>x.id!==garment.id);el<HTMLInputElement>('photo-consent').checked=false;clearResult();render()};list.append(button)}}
function render(){renderSelection();el('photo-category-title').textContent=category;el('photo-categories').replaceChildren();el('photo-garments').replaceChildren();for(const value of REALTIME_CATEGORIES){const b=document.createElement('button');b.textContent=value;b.className=value===category?'active':'';b.onclick=()=>{if(busy)return;category=value;photoClosetView(true);render();};el('photo-categories').append(b);}for(const garment of items.filter(x=>x.category===category)){const b=document.createElement('button'),img=document.createElement('img');img.src=garment.image;img.alt=garment.name;b.className=selected.some(x=>x.id===garment.id)?'selected':'';b.setAttribute('aria-pressed',String(b.className==='selected'));b.append(img,document.createTextNode(garment.name));b.onclick=()=>{if(busy)return;selected=selected.some(x=>x.id===garment.id)?selected.filter(x=>x.id!==garment.id):selectRealtimeGarment(selected,garment);el<HTMLInputElement>('photo-consent').checked=false;clearResult();render();};el('photo-garments').append(b);}if(!el('photo-garments').children.length){const p=document.createElement('p');p.className='empty-category';p.textContent='还没有'+category+'，可点击上方上传';el('photo-garments').append(p);}el('photo-selected').textContent=selected.length?'本次试穿：'+selected.map(x=>x.name).join('、'):'请从衣橱选择衣物；衣橱上传的衣物会在这里同步显示。';update();}
el<HTMLInputElement>('person-file').onchange=async()=>{const input=el<HTMLInputElement>('person-file'),file=input.files?.[0];if(!file||busy)return;busy=true;update();try{person=(await importGarment(file,file.name,'上衣',true)).image;selectedModelShape='';el('person-preview').classList.remove('builtin-model');el<HTMLImageElement>('person-preview').src=person;el('person-preview').hidden=false;el('empty').hidden=true;clearResult();el<HTMLInputElement>('photo-consent').checked=false;}catch(error){status(error instanceof Error?error.message:'照片处理失败');}finally{busy=false;input.value='';update();}};
el<HTMLInputElement>('photo-consent').onchange=update;
el('photo-start').onclick=async()=>{if(busy||!configured||!person||!selected.length||!el<HTMLInputElement>('photo-consent').checked)return;busy=true;controller=new AbortController();update();el<HTMLDetailsElement>('photo-status').closest('details')!.open=true;status('AI正在为你更换衣服，请稍候…');try{const garments=await referenceImage(selected);const response=await apiFetch('/fitting/photo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:person,garments,consent:true,requestId:crypto.randomUUID()}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(250000)])});const body=await response.json() as {image?:string;message?:string};if(!response.ok||!body.image?.startsWith('data:image/png;base64,'))throw Error(body.message??'试衣结果无效');if(closed)return;result=body.image;el<HTMLImageElement>('result-preview').src=result;el('result-preview').hidden=false;el('person-preview').hidden=true;el('original').textContent='查看原图';el('original').hidden=false;el<HTMLButtonElement>('download-photo').disabled=false;status('照片试衣已完成，可切换原图或保存效果。');}catch(error){if(!closed)status(error instanceof Error?error.message:'照片试衣失败，不自动重试。');}finally{busy=false;el<HTMLInputElement>('photo-consent').checked=false;update();}};
el('original').onclick=()=>{el('result-preview').hidden=!el('result-preview').hidden;el('person-preview').hidden=!el('result-preview').hidden;el('original').textContent=el('result-preview').hidden?'查看试衣':'查看原图';};
el('download-photo').onclick=()=>{if(!result)return;const a=document.createElement('a');a.href=result;a.download='OOTRIP-photo-fitting.png';a.click();};
function close(){closed=true;controller?.abort();}window.addEventListener('pagehide',close);window.addEventListener('message',e=>{if(e.source===parent&&(location.protocol==='file:'?['null','file://'].includes(e.origin):e.origin===location.origin)&&e.data?.type==='ootrip:module-close')close();});
void Promise.all([readWardrobe(),readCanvasSelection()]).then(([data,initial])=>{items=[...data,...initial];for(const item of initial)selected=selectRealtimeGarment(selected,item);render();}).catch(()=>status('衣橱暂时无法读取，请返回重试。'));
void apiFetch('/fitting/photo/status').then(r=>r.json()).then((data:{configured:boolean;message:string})=>{configured=data.configured;status(data.message);update();}).catch(error=>{status(error instanceof Error?error.message:'AI服务尚未连接，照片和选衣仍可预览。');update();});
render();

function photoClosetView(detail:boolean){el('photo-wardrobe').dataset.view=detail?'items':'categories';el('photo-toggle').hidden=!detail;el('photo-toggle').setAttribute('aria-expanded',String(detail));}
el('photo-toggle').onclick=()=>photoClosetView(false);
el('photo-category-back').onclick=()=>photoClosetView(false);
const personDialog=document.createElement('dialog');
personDialog.className='person-picker';personDialog.setAttribute('aria-labelledby','person-picker-title');
personDialog.innerHTML='<button type="button" class="person-picker-close" data-person-close aria-label="关闭人物选择" hidden>×</button><h2 id="person-picker-title">选择试衣人物</h2><div class="person-picker-actions"><button type="button" data-person-all>关闭</button><button type="button" data-person-upload>上传全身照</button><button type="button" data-person-model>选择AI模特</button></div><section class="person-models" hidden><p>选择身型，左右滑动查看更多</p><div class="person-model-track" tabindex="0" aria-label="选择模特身型，可左右滑动"></div><p class="person-model-status" role="status"></p></section>';
document.body.append(personDialog);
let personReturnFocus:HTMLElement|null=null;
function setPersonPickerView(models:boolean){personDialog.dataset.view=models?'models':'choices';personDialog.querySelector<HTMLElement>('.person-models')!.hidden=!models;personDialog.querySelector<HTMLElement>('.person-picker-actions')!.hidden=models;personDialog.querySelector<HTMLButtonElement>('[data-person-close]')!.hidden=!models;if(models)requestAnimationFrame(()=>{modelTrack.scrollLeft=modelStep()*5;updateModelCardMotion();});}
function openPersonPicker(){if(busy)return;personReturnFocus=document.activeElement as HTMLElement;setPersonPickerView(false);personDialog.showModal();}
function closePersonPicker(){personDialog.close();personReturnFocus?.focus();}
personDialog.querySelector<HTMLButtonElement>('[data-person-close]')!.onclick=closePersonPicker;
personDialog.querySelector<HTMLButtonElement>('[data-person-upload]')!.onclick=()=>{closePersonPicker();el<HTMLInputElement>('person-file').click();};
personDialog.querySelector<HTMLButtonElement>('[data-person-all]')!.onclick=closePersonPicker;
personDialog.querySelector<HTMLButtonElement>('[data-person-model]')!.onclick=()=>{setPersonPickerView(true);personDialog.querySelector<HTMLButtonElement>('[data-person-close]')!.focus();};
personDialog.addEventListener('click',event=>{if(event.target===personDialog){const rect=personDialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closePersonPicker();}});
const modelTrack=personDialog.querySelector<HTMLElement>('.person-model-track')!;
const modelRoot=location.pathname==='/photo-screen'?'/app/assets/fitting-models/':'../assets/fitting-models/';
async function modelPreviewImage(blob:Blob,shape:string){
 const source=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('模特图片读取失败'));reader.readAsDataURL(blob);});
 if(!['apple','pear'].includes(shape))return source;
 const image=new Image();image.src=source;await image.decode();
 const stage=el('person-preview').parentElement!.getBoundingClientRect(),width=image.naturalWidth,height=image.naturalHeight;
 const boundsRatio=stage.width>0&&stage.height>0?(stage.height*.948)/(stage.width*.527):868/249;
 const targetHeight=Math.max(height,Math.round(width*boundsRatio));if(targetHeight===height)return source;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=targetHeight;
 const context=canvas.getContext('2d');if(!context)throw Error('无法调整模特预览');
 const legStart=Math.round(height*.56),shoeStart=Math.round(height*.88),shoeHeight=height-shoeStart;
 context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
 // Keep the upper body and footwear unchanged; extend only the leg segment.
 context.drawImage(image,0,0,width,legStart,0,0,width,legStart);
 context.drawImage(image,0,legStart,width,shoeStart-legStart,0,legStart,width,targetHeight-legStart-shoeHeight);
 context.drawImage(image,0,shoeStart,width,shoeHeight,0,targetHeight-shoeHeight,width,shoeHeight);
 return canvas.toDataURL('image/png');
}
for(const [file,name] of [['apple','苹果型'],['hourglass','沙漏型'],['pear','梨型'],['straight','H型'],['inverted','倒三角型']] as const){
 const button=document.createElement('button'),image=document.createElement('img'),label=document.createElement('span');button.type='button';button.className='person-model-card';image.src=modelRoot+file+'-hd-v3.png';image.alt=name+'试衣模特';image.draggable=false;label.textContent=name;button.append(image,label);
 button.onclick=async()=>{
  if(busy)return;busy=true;update();modelTrack.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=true);
  const feedback=personDialog.querySelector<HTMLElement>('.person-model-status')!;feedback.textContent='正在载入模特…';
  try{
   const response=await fetch(modelRoot+file+'-hd-v3.png');if(!response.ok)throw Error('模特图片读取失败，请重试');
   const blob=await response.blob();person=await modelPreviewImage(blob,file);
   selectedModelShape=file;const preview=el<HTMLImageElement>('person-preview');preview.classList.add('builtin-model');preview.src=person;preview.alt=name+'试衣模特';
   el('empty').hidden=true;clearResult();el<HTMLInputElement>('photo-consent').checked=false;closePersonPicker();
  }catch(error){feedback.textContent=error instanceof Error?error.message:'模特载入失败';}
  finally{busy=false;modelTrack.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=false);if(!personDialog.open)feedback.textContent='';update();}
 };
 modelTrack.append(button);
}
// Repeat the five cards on both sides; settle onto the identical middle copy.
const originalModelCards=[...modelTrack.querySelectorAll<HTMLButtonElement>('.person-model-card')];
function cloneModelCards(){return originalModelCards.map(original=>{const clone=original.cloneNode(true) as HTMLButtonElement;clone.onclick=original.onclick;return clone;});}
modelTrack.prepend(...cloneModelCards());modelTrack.append(...cloneModelCards());
function modelStep(){return (modelTrack.firstElementChild as HTMLElement)?.offsetWidth+14;}
let modelLoopTimer:ReturnType<typeof setTimeout>|undefined;
function settleModelLoop(){if(!personDialog.open||personDialog.dataset.view!=='models')return;const step=modelStep(),index=Math.round(modelTrack.scrollLeft/step);if(index<5||index>=10){const target=(((index%5)+5)%5+5)*step;modelTrack.style.scrollSnapType='none';modelTrack.scrollLeft=target;updateModelCardMotion();requestAnimationFrame(()=>modelTrack.style.removeProperty('scroll-snap-type'));}}
modelTrack.addEventListener('scroll',()=>{clearTimeout(modelLoopTimer);modelLoopTimer=setTimeout(settleModelLoop,180);},{passive:true});
modelTrack.addEventListener('scrollend',settleModelLoop);
horizontalScroll(modelTrack);
function updateModelCardMotion(){const cards=[...modelTrack.querySelectorAll<HTMLElement>('.person-model-card')],center=modelTrack.scrollLeft+modelTrack.clientWidth/2;for(const card of cards){const distance=Math.min(1,Math.abs(card.offsetLeft+card.offsetWidth/2-center)/Math.max(1,modelTrack.clientWidth));card.style.setProperty('--model-distance',String(distance));}}
let modelMotionFrame=0;
modelTrack.addEventListener('scroll',()=>{cancelAnimationFrame(modelMotionFrame);modelMotionFrame=requestAnimationFrame(updateModelCardMotion);},{passive:true});
modelTrack.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();const step=modelTrack.firstElementChild?.getBoundingClientRect().width||modelTrack.clientWidth;modelTrack.scrollBy({left:(event.key==='ArrowRight'?1:-1)*(step+14),behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});}});
el('empty').onclick=openPersonPicker;
el('change-person').onclick=openPersonPicker;
photoClosetView(false);
el<HTMLInputElement>('garment-file').onchange=async()=>{const input=el<HTMLInputElement>('garment-file'),file=input.files?.[0];if(!file||busy)return;busy=true;update();try{const garment=await importGarment(file,file.name,category);await saveGarments([garment]);items.push(garment);selected=selectRealtimeGarment(selected,garment);el<HTMLInputElement>('photo-consent').checked=false;clearResult();}catch(error){status(error instanceof Error?error.message:'衣物上传失败');el('photo-status').closest('details')!.open=true;}finally{busy=false;input.value='';render();}};

horizontalScroll(document.getElementById('photo-selection')!);
