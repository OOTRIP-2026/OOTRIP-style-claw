import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it } from 'vitest';
const source=readFileSync(new URL('../../../../src/destinations.js',import.meta.url),'utf8');
function app(){
 const storage=new Map<string,string>(),elements=new Map<string,any>();let nextStep=0,tab='';
 class Node {
  dataset:any={};id='';className='';classList={add(){}};style:any={};children:any[]=[];parts=new Map<string,any>();textContent='';isConnected=true;
  set innerHTML(s:string){if(s.includes('destination-backdrop'))for(const name of ['.destination-backdrop','.destination-cards','.destination-grip','.destination-sheet-message'])this.parts.set(name,new Node())}
  replaceChildren(...nodes:any[]){this.children=[];this.append(...nodes)}get innerHTML(){return ''}querySelector(s:string){return this.parts.get(s)}setAttribute(k:string,v:string){this[k]=v}focus(){}removeAttribute(k:string){if(k==='id')elements.delete(this.id);this[k]=''}remove(){elements.delete(this.id)}append(...nodes:any[]){this.children.push(...nodes);for(const node of nodes)if(node.id)elements.set(node.id,node)}
 }
 const phone=new Node();
 const c=createContext({URLSearchParams,fetch:async()=>({ok:false}),Map,Set,Date,Number,JSON,Array,Object,setTimeout:()=>1,localStorage:{getItem:(k:string)=>storage.get(k)||null,setItem:(k:string,v:string)=>storage.set(k,v)},document:{activeElement:new Node(),createElement:()=>new Node(),getElementById:(id:string)=>elements.get(id),querySelector:()=>phone,addEventListener(){},body:{classList:{remove(){}}}},destination:'广州',departure:'2026-10-28',returnDate:'2026-10-30',selectedAge:'28—32',caught:new Set(['极简']),selected:new Set(['极简']),tripScene:'商务',customTripScene:'',tripScenes:['海边','城市徒步','爬山','商务','自定义'],dailyOutfitImages:new Map([[0,'data:image/png;base64,AAAA']]),savedOutfits:[{url:'data:image/png;base64,AAAA'}],activeTripDay:0,uploadDay:0,dateTarget:'departure',viewMonth:new Date(),beijingToday:()=> '2026-10-27',enableCarouselDrag(){},showTrip:(step:number)=>nextStep=step,showWardrobe:(t:string)=>tab=t});
 c.window=c;c.getTripData=()=>({destination:c.destination,departure:c.departure,returnDate:c.returnDate,age:c.selectedAge,styles:[...c.caught],scene:c.tripScene,sceneChoice:c.tripScene});runInContext(source,c);
 return{c,storage,elements,nextStep:()=>nextStep,tab:()=>tab};
}
it('shows only real saved destinations, deduplicates a repeated trip and retains metadata',()=>{
 const a=app();a.c.OotripDestinations.open();a.c.OotripDestinations.close(true);a.c.OotripDestinations.open();
 const layer=a.elements.get('destination-layer'),cards=layer.querySelector('.destination-cards').children;
 expect(cards.length).toBe(2);expect(cards[1].children[1].textContent).toBe('广州');expect(a.c.OotripDestinations.read().length).toBe(1);
});
it('switches saved trips and restores the first trip outfit assignments on return',()=>{
 const a=app();a.c.OotripDestinations.remember({destination:'上海',departure:'2026-11-01',returnDate:'2026-11-03',styles:['极简'],scene:'城市徒步',sceneChoice:'城市徒步'});
 a.c.OotripDestinations.open();let cards=a.elements.get('destination-layer').querySelector('.destination-cards').children;cards[2].onclick();
 expect(a.c.destination).toBe('上海');expect(a.c.tripScene).toBe('城市徒步');expect(a.c.dailyOutfitImages.size).toBe(0);expect(a.tab()).toBe('ai');
 a.c.OotripDestinations.open();cards=a.elements.get('destination-layer').querySelector('.destination-cards').children;cards[2].onclick();
 expect(a.c.destination).toBe('广州');expect(a.c.dailyOutfitImages.get(0)).toBe('data:image/png;base64,AAAA');
});
it('add starts the destination question without deleting existing trips',()=>{
 const a=app();a.c.OotripDestinations.open();a.elements.get('destination-layer').querySelector('.destination-cards').children[0].onclick();
 expect(a.nextStep()).toBe(3);expect(a.c.destination).toBe('');expect(a.c.departure).toBe('');expect(a.c.OotripDestinations.read().length).toBe(1);
});

it('maps city names and aliases to their own landmarks and leaves unknown cities neutral',()=>{
 const a=app(),cover=a.c.OotripDestinations.coverFor;
 expect(cover('杭州').image).toBe('assets/destinations/hangzhou-abstract-fixed.png');
 expect(cover('杭州市').image).toBe('assets/destinations/hangzhou-abstract-fixed.png');
 expect(cover('Hangzhou').image).toBe('assets/destinations/hangzhou-abstract-fixed.png');
 expect(cover('广州').image).toBe('assets/destinations/guangzhou-abstract-fixed.png');
 expect(cover('广州市').image).toBe('assets/destinations/guangzhou-abstract-fixed.png');
 expect(cover('巴黎')).toBeNull();
 expect(cover('未匹配的城市')).toBeNull();
});
