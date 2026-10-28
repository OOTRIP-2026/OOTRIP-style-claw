/* Remove edge-connected white studio backgrounds; keep the source in the store. */
window.OotripGarmentImage=async function(source,options={}){
 const image=new Image();image.src=source;await image.decode();
 const scale=Math.min(1,1200/Math.max(image.naturalWidth,image.naturalHeight));
 const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
 const {width:w,height:h}=canvas,pixels=ctx.getImageData(0,0,w,h),d=pixels.data,seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
 const background=i=>{const p=i*4;return d[p+3]<16||(Math.min(d[p],d[p+1],d[p+2])>=240&&Math.max(d[p],d[p+1],d[p+2])-Math.min(d[p],d[p+1],d[p+2])<18)};
 function add(i){if(!seen[i]&&background(i)){seen[i]=1;queue[tail++]=i}}
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x)}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1)}
 while(head<tail){const i=queue[head++],x=i%w;d[i*4+3]=0;if(x)add(i-1);if(x<w-1)add(i+1);if(i>=w)add(i-w);if(i<w*(h-1))add(i+w)}
 if(tail<w*h*.015)return source;
 // Legacy catalogue crops include a fragment of the next garment below the main one.
 // Restrict only those crops to their largest connected silhouette; retain original data.
 let primary=null;
 if(options.primaryOnly){
  const visited=new Uint8Array(w*h);let largest=0;
  for(let start=0;start<w*h;start++){
   if(visited[start]||d[start*4+3]<=32)continue;
   let read=0,end=1,l=w,t=h,r=0,b=0;queue[0]=start;visited[start]=1;
   while(read<end){const i=queue[read++],x=i%w,y=Math.floor(i/w);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
    for(const next of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(next>=0&&!visited[next]&&d[next*4+3]>32){visited[next]=1;queue[end++]=next}
   }
   if(end>largest){largest=end;primary={left:l,right:r,top:t,bottom:b}}
  }
  if(primary)for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<primary.left||x>primary.right||y<primary.top||y>primary.bottom)d[(y*w+x)*4+3]=0;
 }
 let left=w,top=h,right=0,bottom=0,count=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(d[(y*w+x)*4+3]>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++}}
 // Reject nearly empty masks rather than silently losing a white garment.
 if(count<w*h*.035)return source;
 ctx.putImageData(pixels,0,0);
 const pad=Math.max(8,Math.round(Math.max(right-left,bottom-top)*.04)),out=document.createElement('canvas');out.width=right-left+1+pad*2;out.height=bottom-top+1+pad*2;
 out.getContext('2d').drawImage(canvas,left,top,right-left+1,bottom-top+1,pad,pad,right-left+1,bottom-top+1);
 return out.toDataURL('image/png');
};
