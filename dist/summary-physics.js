/* Lightweight rigid-body preview for the confirmation capsules. No shape scaling. */
(()=>{
 let stop=()=>{};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function start(pile,chips){
 stop();if(matchMedia('(prefers-reduced-motion: reduce)').matches||!pile.clientWidth)return;
 const W=pile.clientWidth,H=pile.clientHeight;pile.classList.add('physics-pile');
 const bodies=chips.map((el,i)=>{const w=el.offsetWidth,h=el.offsetHeight;return{el,w,h,targetX:parseFloat(el.style.getPropertyValue('--sx'))+w/2,targetY:H-parseFloat(el.style.getPropertyValue('--sy'))-h/2,x:clamp((.16+((i*.379)% .69))*W,w/2+8,W-w/2-8),y:-h-20-(i%3)*25,vx:(i%2?1:-1)*22,vy:0,a:(i%2?1:-1)*(.08+(i%4)*.12),av:(i%2?1:-1)*.7,delay:i*.09,m:1,invI:12/(w*w+h*h),active:false}});
 // Bottom-first launch lanes only; the resting positions come exclusively from collisions.
 const bottomFirst=[...bodies].sort((a,b)=>b.targetY-a.targetY||a.targetX-b.targetX);
 bottomFirst.forEach((b,i)=>{b.delay=i*.09;b.x=b.targetX;});
 const lastDrop=(bodies.length-1)*.09;
 function vertices(b){const c=Math.cos(b.a),s=Math.sin(b.a);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:b.x+x*b.w/2*c-y*b.h/2*s,y:b.y+x*b.w/2*s+y*b.h/2*c}));}
 function collision(a,b){const va=vertices(a),vb=vertices(b),axes=[a.a,a.a+Math.PI/2,b.a,b.a+Math.PI/2];let depth=Infinity,n;
 for(const angle of axes){const axis={x:Math.cos(angle),y:Math.sin(angle)},pa=va.map(v=>v.x*axis.x+v.y*axis.y),pb=vb.map(v=>v.x*axis.x+v.y*axis.y);const d=Math.min(Math.max(...pa),Math.max(...pb))-Math.max(Math.min(...pa),Math.min(...pb));if(d<=0)return;if(d<depth){depth=d;n=axis;}}
 if((b.x-a.x)*n.x+(b.y-a.y)*n.y<0){n.x*=-1;n.y*=-1;}return{depth,n};}
 function resolve(a,b){const hit=collision(a,b);if(!hit)return;const {depth,n}=hit;const fix=Math.max(0,depth-.1)*.62;a.x-=n.x*fix;a.y-=n.y*fix;b.x+=n.x*fix;b.y+=n.y*fix;
 const rv=(b.vx-a.vx)*n.x+(b.vy-a.vy)*n.y;if(rv<0){const j=-(1.08)*rv/2;a.vx-=j*n.x;a.vy-=j*n.y;b.vx+=j*n.x;b.vy+=j*n.y;const tx=-n.y,ty=n.x,t=(b.vx-a.vx)*tx+(b.vy-a.vy)*ty,f=clamp(-t/2,-j*.5,j*.5);a.vx-=f*tx;a.vy-=f*ty;b.vx+=f*tx;b.vy+=f*ty;const offset=clamp((b.x-a.x)/Math.max(a.w,b.w),-1,1);a.av-=j*offset*a.invI*10.5;b.av+=j*offset*b.invI*10.5;}a.av*=.96;b.av*=.96;
 // Keep collision drift and rotation visibly below the gravity-driven falling speed.
 const contactLimit=Math.sqrt(2*1650*H)*.45;
 for(const body of [a,b]){body.vx=clamp(body.vx,-contactLimit,contactLimit);body.av=clamp(body.av,-2.2,2.2);}
 }
 function walls(b){const v=vertices(b),minX=Math.min(...v.map(p=>p.x)),maxX=Math.max(...v.map(p=>p.x)),maxY=Math.max(...v.map(p=>p.y));if(minX<3){b.x+=3-minX;b.vx=Math.abs(b.vx)*.12;b.av*=.75;}if(maxX>W-3){b.x-=maxX-W+3;b.vx=-Math.abs(b.vx)*.12;b.av*=.75;}if(maxY>H-5){b.y-=maxY-H+5;if(b.vy>0)b.vy=-b.vy*.1;b.vx*=.8;const angle=Math.atan2(Math.sin(2*b.a),Math.cos(2*b.a))/2;b.av-=angle*.1;b.av*=.8;}}

 // Stop as soon as every capsule belongs to a close, floor-supported pile.
 // Tolerance is in layout pixels, so it scales together with the phone preview.
 const restGap=5;
 function pointEdge(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
 function closeGap(a,b,va,vb){if(collision(a,b))return 0;let gap=Infinity;for(let i=0;i<4;i++)for(let j=0;j<4;j++){gap=Math.min(gap,pointEdge(va[i],vb[j],vb[(j+1)%4]),pointEdge(vb[i],va[j],va[(j+1)%4]));}return gap;}
 function compactPile(){
  if(bodies.some(b=>!b.active))return false;
  const shapes=bodies.map(vertices),supported=new Set(),edges=bodies.map(()=>[]);
  for(let i=0;i<bodies.length;i++){
   if(H-5-Math.max(...shapes[i].map(v=>v.y))<=restGap)supported.add(i);
   for(let j=i+1;j<bodies.length;j++){
    const hit=collision(bodies[i],bodies[j]);if(hit&&hit.depth>.25)return false;
    if(closeGap(bodies[i],bodies[j],shapes[i],shapes[j])<=restGap){edges[i].push(j);edges[j].push(i);}
   }
  }
  const queue=[...supported];for(let i=0;i<queue.length;i++)for(const j of edges[queue[i]])if(!supported.has(j)){supported.add(j);queue.push(j);}
  return supported.size===bodies.length;
 }
 let frame,last,elapsed=0,acc=0,cancelled=false;
 function tick(now){if(cancelled||!pile.isConnected)return;const dt=last?Math.min(.05,(now-last)/1000):0;last=now;elapsed+=dt;acc+=dt;
 while(acc>=1/120){acc-=1/120;for(const b of bodies){b.active=elapsed>=b.delay;if(!b.active)continue;b.vy+=1650/120;b.vx*=.999;b.av*=.994;/* Preserve initial collisions; damp only the final settling phase. */if(elapsed>lastDrop+1.4){const damping=Math.exp(-Math.min(12,(elapsed-lastDrop-1.4)*10)/120);b.vx*=damping;b.vy*=damping;b.av*=damping;}b.x+=b.vx/120;b.y+=b.vy/120;b.a+=clamp(b.av,-3,3)/120;}
 for(let k=0;k<16;k++){for(let i=0;i<bodies.length;i++){const a=bodies[i];if(!a.active)continue;walls(a);for(let j=i+1;j<bodies.length;j++)if(bodies[j].active)resolve(a,bodies[j]);}}
 }
 for(const b of bodies){b.el.style.visibility=b.active?'visible':'hidden';b.el.style.left=(b.x-b.w/2)+'px';b.el.style.bottom=(H-b.y-b.h/2)+'px';b.el.style.transform='rotate('+b.a+'rad)';}
 const settled=elapsed>lastDrop+.6&&compactPile();
 if(!settled&&elapsed<6)frame=requestAnimationFrame(tick);else for(const b of bodies){b.vx=0;b.vy=0;b.av=0;b.el.style.willChange='auto';}}
 stop=()=>{cancelled=true;cancelAnimationFrame(frame);};frame=requestAnimationFrame(tick);
 }
 window.OotripSummaryPhysics={start,stop:()=>stop()};
})();
