'use strict';
const $=s=>document.querySelector(s),KEY='ootrip.owol.chat.v1:'+JSON.stringify(chatTrip);
const escapeText=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const outfits=[
{id:1,title:'第一天 · 轻松出发',image:'look1',name:'奶油针织衫 × 浅蓝牛仔裤',description:'适合途中出行与轻松步行。'},
{id:2,title:'第二天 · 轻盈日常',image:'look2',name:'轻薄外套 × 休闲长裤',description:'轻松叠穿，方便途中增减衣物。'},
{id:3,title:'第三天 · 简约随行',image:'look3',name:'条纹针织衫 × 卡其长裙',description:'自然的中性色，轻松又耐看。'},
{id:4,title:'第四天 · 温柔出行',image:'pack2',name:'奶白针织衫 × 咖啡百褶裙',description:'柔和配色，搭配简洁肩包。'},
...Array.from({length:8},(_,i)=>{const look=[
{theme:'复古俏皮',image:'extra-look1',name:'格纹泡泡袖上衣 × 黑色灯笼短裙',description:'搭配黑色长靴、棕色手袋和格纹帽，俏皮又复古。'},
{theme:'奶油甜心',image:'extra-look2',name:'奶油黄短袖衬衫 × 同色短裙',description:'搭配拼色玛丽珍鞋、黑色手袋和耳饰，温柔又精致。'},
{theme:'暖棕漫游',image:'extra-look3',name:'卡其外套 × 白色蕾丝连衣裙',description:'搭配棕色短靴、手袋和贝雷帽，轻松自在。'}
][i%3];return {id:i+5,title:'第'+(i+5)+'天 · '+look.theme,...look}})];
const colorful={id:3,title:'第三天 · 活力配色',image:'day3',name:'黄色印花上衣 × 灰绿色阔腿裤',description:'搭配黄色运动鞋、印花斜挎包和格纹帽，明亮又有活力。',updated:true};
const walking=[{id:4,title:'第四天 · 轻松漫步',image:'day4',name:'奶白针织衫 × 咖啡百褶裙',description:'换上运动鞋，适合城市漫步。',updated:true},{id:5,title:'第五天 · 简约出行',image:'look3',name:'条纹针织衫 × 卡其长裙',description:'舒适运动鞋，轻松出行。',updated:true}];
let state={started:false,messages:[],colorfulIds:[],pendingColorRequest:false,shoesUpdated:false,noHeels:false,outfitOrder:[]},busy=false,toastTimer,lastFocus;
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&Array.isArray(saved.messages)){state={started:!!saved.started,messages:saved.messages.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.text==='string').slice(-120),colorfulIds:[],pendingColorRequest:false,shoesUpdated:!!saved.shoesUpdated,noHeels:false,outfitOrder:Array.isArray(saved.outfitOrder)?[...new Set(saved.outfitOrder.filter(id=>Number.isInteger(id)&&id>=1&&id<=chatTrip.days))]:[]};}}catch{}
for(const message of state.messages){if(message.role==='assistant'&&message.kind==='color'&&message.text.includes('第三天换成珊瑚红开衫'))message.text='好呀，第三天换成黄色印花上衣，搭配灰绿色阔腿裤和黄色运动鞋，再配上印花斜挎包和格纹帽。其他日期保持原方案。';}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}}
function showToast(t){clearTimeout(toastTimer);$('#toast').textContent=t;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3000);}
function outfitDay(id){const order=[...(state.outfitOrder||[]),...Array.from({length:chatTrip.days},(_,i)=>i+1).filter(n=>!state.outfitOrder?.includes(n))];return Math.max(1,order.indexOf(id)+1)}
function card(o,single=false){const day=outfitDay(o.id),title='第'+day+'天 · '+o.title.split(' · ').slice(1).join(' · ');return `<article data-look-id="${o.id}" data-display-day="${day}" data-look-image="${o.image}" class="outfit ${single?'single':''}"><div class="card-head"><strong>${escapeText(title)}</strong>${o.updated?'<span class="updated">已更新</span>':''}<time>${chatDayDate(day).label}</time></div><button class="image-button" draggable="false" data-image="${o.image}" data-caption="${escapeText(o.name)}" aria-label="放大${escapeText(title)}穿搭图片"><img loading="lazy" draggable="false" src="assets/${o.image}.jpg" alt="${escapeText(o.name)}"></button><h3>${escapeText(o.name)}</h3><p>${escapeText(o.description)}</p><button type="button" class="card-save" data-save-look="${o.id}" data-look-image="${o.image}">选择这套穿搭</button></article>`;}
function currentOutfits(){return Array.from({length:chatTrip.days},(_,i)=>{
 const original=i<4?outfits[i]:outfits[4+(i-4)%3],o={...original,id:i+1,title:'第'+(i+1)+'天 · '+original.title.split(' · ').slice(1).join(' · ')};
 const day=outfitDay(o.id);
 if(state.colorfulIds.includes(o.id))return {...colorful,id:o.id};
 const walkingLook=state.shoesUpdated&&['look3','pack2'].includes(o.image)&&[4,5].includes(day)?{...walking.find(w=>w.id===day),id:o.id}:o;
 return state.noHeels&&walkingLook.image==='look3'?{...walkingLook,image:'look3-sneakers',description:'搭配舒适运动鞋，轻松出行。',updated:true}:walkingLook;
}).sort((a,b)=>outfitDay(a.id)-outfitDay(b.id))}
function carousel(kind,index,lookIds){let items=currentOutfits().filter(o=>kind==='no-heels'?o.image==='look3-sneakers':kind==='color'?(Array.isArray(lookIds)?lookIds:state.colorfulIds).includes(o.id):kind==='shoes'?[4,5].includes(outfitDay(o.id)):true);if(!items.length)return '';return `<div class="carousel-wrap"><div class="carousel" data-carousel="${index}" aria-label="${kind==='shoes'?'更新搭配':'每日穿搭'}">${items.map(o=>card(o,items.length===1)).join('')}</div>${items.length>1?`<div class="pagination"><span class="page-label">${kind==='shoes'?'更新搭配 ':''}1 / ${items.length}</span><span class="dots">${Array.from({length:Math.min(items.length,5)},(_,i)=>`<i class="dot ${i===0?'active':''}"></i>`).join('')}</span></div>`:''}</div>`;}
function messageHTML(m,i){if(m.role==='user')return `<div class="message user"><div class="bubble">${escapeText(m.text)}</div></div>`;return `<div class="message assistant"><div class="assistant-row"><img class="message-avatar" src="assets/owl.jpg" alt="owol"><div class="bubble">${escapeText(m.text)}</div></div>${m.kind?carousel(m.kind,i,m.lookIds):''}${m.followup?`<div class="assistant-row followup"><img class="message-avatar" src="assets/owl.jpg" alt="owol"><div class="bubble">${escapeText(m.followup)}</div></div>`:''}</div>`;}
const revealedAssistantMessages=new WeakSet();
function render(){
$('#header').innerHTML=`<button class="back" id="back" aria-label="${state.started?'返回首页':'返回'}"><svg viewBox="0 0 24 24"><path d="m15 4-8 8 8 8"/></svg></button>${state.started?'<img class="header-avatar" src="assets/owl.jpg" alt="owol"><div><div class="header-title">AI 助手 · 旅行造型师</div><div class="online">在线 · 已读取行程</div></div>':''}`;
$('#home').hidden=state.started;$('#conversation').hidden=!state.started;$('#messages').innerHTML=state.messages.map(messageHTML).join('');$('#back').onclick=()=>{if(typeof window.onBack==='function')window.onBack();};
state.messages.forEach((message,index)=>{if(message.role==='assistant'&&!revealedAssistantMessages.has(message)){document.querySelector('#messages').children[index]?.classList.add('assistant-fade-in');revealedAssistantMessages.add(message)}});
for(const rail of document.querySelectorAll('.carousel')){rail.addEventListener('scroll',()=>{const cards=[...rail.children];const step=cards[1]?cards[1].offsetLeft-cards[0].offsetLeft:1;const active=Math.max(0,Math.min(cards.length-1,Math.round(rail.scrollLeft/step)));const pagination=rail.parentElement.querySelector('.pagination');if(!pagination)return;pagination.querySelector('.page-label').textContent=(cards.length===2?'更新搭配 ':'')+(active+1)+' / '+cards.length;const dots=pagination.querySelectorAll('.dot');dots.forEach((d,i)=>d.classList.toggle('active',i===Math.min(active,dots.length-1)));},{passive:true});}
}
function scrollToLatest(){requestAnimationFrame(()=>{const last=$('#messages').lastElementChild;const latest=last?.previousElementSibling||last;if(latest)$('#scroll').scrollTo({top:Math.max(0,latest.offsetTop-$('#conversation').offsetTop-12),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});}
function chineseDayNumber(value){
 if(/^\d+$/.test(value))return Number(value);
 const digits={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};let total=0,digit=0;
 for(const c of value){if(c==='十'||c==='百'){total+=(digit||1)*(c==='十'?10:100);digit=0}else digit=digits[c]??0}return total+digit;
}
function requestedOutfitDays(text){
 const days=[];let specified=false;
 for(const match of text.matchAll(/(?:第\s*)?([0-9零〇一二两三四五六七八九十百]+)\s*天/g)){specified=true;days.push(chineseDayNumber(match[1]))}
 if(!specified){
  const dates=[...text.matchAll(/(?:(\d{4})[-/.年])?(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*[日号]?/g)];
  for(const match of dates){specified=true;const day=Array.from({length:chatTrip.days},(_,i)=>i+1).find(n=>{const [year,month,date]=chatDayDate(n).iso.split('-').map(Number);return (!match[1]||year===Number(match[1]))&&month===Number(match[2])&&date===Number(match[3])});days.push(day||0)}
  if(!specified)for(const match of text.matchAll(/(\d{1,2})\s*[日号]/g)){specified=true;const day=Array.from({length:chatTrip.days},(_,i)=>i+1).find(n=>Number(chatDayDate(n).iso.slice(-2))===Number(match[1]));days.push(day||0)}
 }
 return {specified,days:[...new Set(days)]};
}
function respond(text,first){
const finishRequest=/^(?:没有(?:了|啦|哦)?|没(?:有)?别的(?:了)?|不用(?:了|改了)?|不改了|就这样(?:吧)?|可以了|完成了|结束(?:对话)?|同步(?:到首页)?)[！!。.]?$/.test(text.trim());
if(finishRequest)return {role:'assistant',text:'好的，正在帮你同步到首页搭配方案。',finish:true};
const target=requestedOutfitDays(text),colorRequest=/(?:活泼|活力|明亮|鲜艳|亮丽|缤纷)/.test(text)&&!/(?:不想|不要|不希望).{0,8}(?:活泼|活力|明亮|鲜艳|亮丽|缤纷)/.test(text);
if(colorRequest||(state.pendingColorRequest&&target.specified)){
 if(!target.specified){state.pendingColorRequest=true;return {role:'assistant',text:'你希望哪一天的颜色更活泼一点？可以告诉我“第5天”或具体日期。'};}
 if(target.days.some(day=>day<1||day>chatTrip.days)){state.pendingColorRequest=true;return {role:'assistant',text:'这次行程共 '+chatTrip.days+' 天，请选择行程范围内的日期。'};}
 const lookIds=currentOutfits().filter(o=>target.days.includes(outfitDay(o.id))).map(o=>o.id);
 state.colorfulIds=[...new Set([...state.colorfulIds,...lookIds])];state.pendingColorRequest=false;
 return {role:'assistant',text:'好呀，已把'+target.days.map(day=>'第'+day+'天').join('、')+'换成黄色印花上衣、灰绿色阔腿裤和黄色运动鞋，颜色更活泼啦！其他日期保持原方案。',kind:'color',lookIds};
}

if(/(?:不想|不要|不穿|不爱|不喜欢|不愿|别|拒绝).{0,8}高跟鞋|高跟鞋.{0,8}(?:换掉|换成|不穿)/.test(text)){state.noHeels=true;return {role:'assistant',text:'已经帮你更换完毕啦！还有什么需要修改的地方吗',kind:'no-heels',followup:'还有想要改的穿搭吗？没有的话我就帮你同步到首页展示啦！'};}

if(first)return {role:'assistant',text:'好的，先为你安排了'+chatTrip.days+'天的穿搭。左右滑动查看，想改哪一天，直接告诉我。',kind:'initial',followup:'哪一天安排爬山？告诉我后，我再为当天调整。'};
if(/高跟|鞋|走路|步行/.test(text)&&chatTrip.days<4)return {role:'assistant',text:'可以调整鞋子。请告诉我第几天，以及希望换成哪一种鞋。'};if(/高跟|鞋|走路|步行/.test(text)){state.shoesUpdated=true;return {role:'assistant',text:'明白，其他日期里原有的高跟鞋已换成平底鞋或运动鞋。'+(state.colorfulIds.length?'已调整的活力配色保持不变。':'下面是更新后的搭配。'),kind:'shoes'};}
if(/推荐|总览|全部|所有|重新看|每日/.test(text))return {role:'assistant',text:'这是目前的每日穿搭方案，已经同步你之前的调整。左右滑动可以查看不同日期。',kind:'initial'};
if(/第三|第3|三天/.test(text))return {role:'assistant',text:'第三天你想调整颜色、单品，还是鞋子？告诉我具体偏好就好。'};
if(/爬山/.test(text))return {role:'assistant',text:'爬山建议选择便于活动的衣裤，以及适合路线、具有抓地力的鞋子。你计划哪一天爬山，路线大概多长？'};
if(/谢谢|满意|不错|喜欢/.test(text))return {role:'assistant',text:'喜欢就好！之后想调整哪一天或哪件单品，随时告诉我。'};
if(/这套|换|改|颜色|活泼/.test(text))return {role:'assistant',text:'你想调整哪一天的穿搭？可以告诉我日期和偏好，例如“第三天颜色活泼一点”。'};
return {role:'assistant',text:'收到。你希望把这个偏好用于哪一天？也可以先告诉我想调整的颜色、单品或鞋子。'};
}
async function send(){const input=$('#input'),text=input.value.trim();if(!text||busy)return;const first=state.messages.length===0;state.started=true;state.messages.push({role:'user',text});input.value='';resizeInput();busy=true;$('#send').disabled=true;persist();render();$('#messages').insertAdjacentHTML('beforeend','<div class="message assistant typing" role="status" aria-label="正在回复"><div class="assistant-row"><img class="message-avatar" src="assets/owl.jpg" alt="owol"><div class="bubble"><i></i><i></i><i></i></div></div></div>');scrollToLatest();await new Promise(r=>setTimeout(r,850));const reply=respond(text,first);state.messages.push(reply);persist();render();busy=false;$('#send').disabled=false;scrollToLatest();if(reply.finish)setTimeout(()=>window.finishOutfitConversation?.(),250);}
$('#composer').onsubmit=e=>{e.preventDefault();send();};$('#input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#composer').requestSubmit();}};
function resizeInput(){const field=$('#input');field.style.height='27px';field.style.height=Math.min(105,field.scrollHeight)+'px';}
$('#input').oninput=resizeInput;
document.addEventListener('click',e=>{const b=e.target.closest('[data-image]');if(!b)return;lastFocus=b;$('#largeImage').src='assets/'+b.dataset.image+'.jpg';$('#largeImage').alt=b.dataset.caption;$('#largeCaption').textContent=b.dataset.caption;$('#lightbox').hidden=false;for(const el of $('.screen').children)if(el!==$('#lightbox'))el.inert=true;$('#closeImage').focus();});
function closeImage(){for(const el of $('.screen').children)el.inert=false;$('#lightbox').hidden=true;lastFocus?.focus({preventScroll:true});}$('#closeImage').onclick=closeImage;$('#lightbox').onclick=e=>{if(e.target===$('#lightbox'))closeImage();};$('#lightbox').onkeydown=e=>{if(e.key==='Escape')closeImage();if(e.key==='Tab'){e.preventDefault();$('#closeImage').focus();}};
let recognition;
$('#voice').onclick=()=>{const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){showToast('当前浏览器不支持语音输入，请输入文字');$('#input').focus();return;}if(recognition){recognition.stop();return;}recognition=new Recognition();recognition.lang='zh-CN';recognition.interimResults=false;recognition.onresult=e=>{$('#input').value+=e.results[0][0].transcript;resizeInput();};recognition.onerror=e=>showToast(e.error==='not-allowed'?'请允许麦克风权限后使用语音输入':'暂时未能识别，请输入文字');recognition.onend=()=>{recognition=null;$('#voice').setAttribute('aria-label','语音输入');};try{recognition.start();$('#voice').setAttribute('aria-label','停止语音输入');showToast('正在聆听，点击语音按钮可停止');}catch{recognition=null;showToast('暂时无法使用语音，请输入文字');}};
function fit(){document.documentElement.style.setProperty('--scale',Math.max(.2,Math.min(1,(innerHeight-28)/894,(innerWidth-28)/422)));if(matchMedia('(max-width:600px)').matches)document.documentElement.style.setProperty('--app-height',(window.visualViewport?.height||innerHeight)+'px');}window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);fit();render();if(state.started)scrollToLatest();
