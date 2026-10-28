'use strict';
/* Local generation preview: intro → loading → existing outfit recommendations. */
(()=>{
 const home=document.querySelector('#home'),conversation=document.querySelector('#conversation'),scroll=document.querySelector('#scroll'),header=document.querySelector('#header');
 const page=document.createElement('section');page.className='generation-page';page.hidden=true;
 page.innerHTML=`<div class="generation-hero"><img src="assets/owl.jpg" alt="owol"><h1>owol</h1></div><section class="generation-sheet"><span class="generation-grip" aria-hidden="true"></span><div class="generation-trip"><div><span class="generation-city"></span><p class="generation-dates"></p></div><div class="generation-tags"></div></div><div class="generation-results" aria-busy="true"><div class="generation-loading" role="status" aria-live="polite"><div class="generation-circle"><video muted playsinline preload="auto" aria-hidden="true" src="assets/owl-loading.mp4"></video></div><div class="generation-track" role="progressbar" aria-label="穿搭生成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><p class="generation-label">正在加载中</p></div><div class="generation-looks" hidden><h2></h2><div class="carousel generation-carousel" aria-label="每日出行穿搭"></div></div></div></section>`;
 scroll.append(page);
 page.querySelector('.generation-city').textContent='⌖ '+chatTrip.destination;
 page.querySelector('.generation-dates').textContent=chatTrip.departure.replaceAll('-','.')+'–'+chatTrip.returnDate.replaceAll('-','.');
 for(const text of [...chatTrip.styles,chatTrip.scene].filter(Boolean)){const tag=document.createElement('span');tag.textContent=text;page.querySelector('.generation-tags').append(tag);}
 const video=page.querySelector('video'),loading=page.querySelector('.generation-loading'),looks=page.querySelector('.generation-looks'),results=page.querySelector('.generation-results'),bar=page.querySelector('.generation-track'),fill=bar.firstElementChild,label=page.querySelector('.generation-label');
 // Quiet clothing silhouettes sit behind the existing owl and progress animation.
 const fallingIcons=document.createElement('div');fallingIcons.className='generation-falling-icons';fallingIcons.setAttribute('aria-hidden','true');
 const iconAssets=['dress','bag','heel','short-dress','shirt','jacket','trousers','tee','shoulder-bag'];
 for(let i=0;i<22;i++){
  const icon=document.createElement('span');icon.className='generation-falling-icon';
  const x=7+(i*37%87),duration=6.8+(i%5)*.75;
  icon.style.cssText=`--icon-x:${x}%;--icon-size:${i%3===0?38:32}px;--icon-duration:${duration}s;--icon-delay:${-(i/22)*duration}s;--icon-turn:${(i%2?1:-1)*7}deg;--icon-drift:${i%2?18:-18}px`;
  icon.innerHTML=i%4===3?'<i></i>':`<img src="assets/loading-icons/${iconAssets[(i-Math.floor(i/4))%iconAssets.length]}.png" alt="" draggable="false">`;
  fallingIcons.append(icon);
 }
 loading.prepend(fallingIcons);
 video.defaultPlaybackRate=.85;video.playbackRate=.85;
 let timer,frame,stopped=false,phase='intro',start;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const heroImage=home.querySelector('.hero-owl');
 const introOwl=document.createElement('video');
 introOwl.className='hero-owl';introOwl.src='assets/owl-intro.mp4';introOwl.poster=heroImage.src;
 introOwl.muted=true;introOwl.playsInline=true;introOwl.preload='auto';introOwl.defaultPlaybackRate=1.15;introOwl.playbackRate=1.15;
 introOwl.setAttribute('aria-label','owol 闭眼打盹、揉眼醒来并张开翅膀');
 if(!reduced.matches){heroImage.replaceWith(introOwl);introOwl.play().catch(()=>{introOwl.replaceWith(heroImage);});}
 // This entry creates a fresh recommendation order; edits begin with the next chat request.
 state.outfitOrder=[];state.colorfulIds=[];state.pendingColorRequest=false;state.noHeels=false;
 const items=currentOutfits();
 looks.querySelector('h2').textContent='为你推荐的'+chatTrip.days+'套出行穿搭';
 looks.querySelector('.carousel').innerHTML=items.map(o=>card(o)).join('');
 function progress(n){fill.style.width=n+'%';bar.setAttribute('aria-valuenow',String(Math.round(n)));}
 function back(){introOwl.pause();stopped=true;clearTimeout(timer);cancelAnimationFrame(frame);video.pause();window.onBack?.();}
 function finish(){if(stopped||phase!=='loading')return;phase='complete';page.dataset.phase='complete';cancelAnimationFrame(frame);progress(100);label.textContent='加载完成';video.pause();timer=setTimeout(()=>{if(stopped)return;phase='results';loading.hidden=true;looks.hidden=false;results.setAttribute('aria-busy','false');page.dataset.phase='results';},600);}
 function tick(now){if(stopped||phase!=='loading')return;progress(Math.min(99,(now-start)/5170*100));frame=requestAnimationFrame(tick);}
 function begin(){if(stopped)return;introOwl.pause();phase='loading';page.dataset.phase=phase;home.hidden=true;conversation.hidden=true;page.hidden=false;scroll.classList.add('generation-scroll');header.innerHTML='<button class="back" aria-label="返回"><svg viewBox="0 0 24 24"><path d="m15 4-8 8 8 8"/></svg></button><h2 class="generation-title">AI 穿搭助手</h2>';header.querySelector('button').onclick=back;document.querySelector('.screen').classList.add('generating-outfits');scroll.scrollTop=0;start=performance.now();frame=requestAnimationFrame(tick);if(!reduced.matches)video.play().catch(()=>{});timer=setTimeout(finish,5170);}
 // Always show the entry screen for this new generation flow; stored chat history is preserved.
 home.hidden=false;conversation.hidden=true;header.innerHTML='<button class="back" aria-label="返回"><svg viewBox="0 0 24 24"><path d="m15 4-8 8 8 8"/></svg></button>';header.querySelector('button').onclick=back;
 home.classList.add('generation-intro');scroll.scrollTop=0;
 document.querySelector('.chat-demo-note')?.remove();
 // Slightly quicker wake-up: 2.1s gesture, 500ms softening, 800ms haze hold.
 timer=setTimeout(begin,3400);
 let compactHeader=false;
 function resultHeader(compact){if(compact===compactHeader)return;compactHeader=compact;header.innerHTML=compact?'<button class="back" aria-label="返回首页"><svg viewBox="0 0 24 24"><path d="m15 4-8 8 8 8"/></svg></button><img class="header-avatar" src="assets/owl.jpg" alt="owol"><div><div class="header-title">AI 助手 · 旅行造型师</div><div class="online">在线 · 已读取行程</div></div>':'<button class="back" aria-label="返回"><svg viewBox="0 0 24 24"><path d="m15 4-8 8 8 8"/></svg></button><h2 class="generation-title">AI 穿搭助手</h2>';header.querySelector('button').onclick=back}
 function syncResultScroll(){if(phase!=='results'||page.hidden)return;const hero=page.querySelector('.generation-hero');resultHeader(hero.getBoundingClientRect().bottom<=scroll.getBoundingClientRect().top+12)}
 scroll.addEventListener('scroll',syncResultScroll,{passive:true});
 function sizeResults(){page.style.setProperty('--generation-viewport-height',scroll.clientHeight+'px')}
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(sizeResults).observe(scroll);sizeResults();
 document.addEventListener('ootrip:selection-question',()=>{
  if(phase!=='results'||page.hidden)return;
  page.classList.add('generation-discussion');
  requestAnimationFrame(()=>{const top=looks.getBoundingClientRect().top-scroll.getBoundingClientRect().top+scroll.scrollTop;scroll.scrollTo({top:Math.max(0,top-8),behavior:reduced.matches?'auto':'smooth'})});
 });
 const form=document.querySelector('#composer');form.addEventListener('submit',event=>{
  if(phase==='conversation')return;
  event.preventDefault();event.stopImmediatePropagation();
  if(phase!=='results')return;
  stopped=true;phase='conversation';page.hidden=true;scroll.classList.remove('generation-scroll');document.querySelector('.screen').classList.remove('generating-outfits');home.classList.remove('generation-intro');state.started=true;state.messages=[{role:'assistant',text:'这是为你准备的出行穿搭，可以告诉我想调整哪一天。',kind:'initial'}];send();
 },true);
 window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);cancelAnimationFrame(frame);video.pause();},{once:true});
})();



