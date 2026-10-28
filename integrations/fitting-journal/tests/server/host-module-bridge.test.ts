import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it } from 'vitest';
const source=readFileSync(new URL('../../../../src/module-integration.js',import.meta.url),'utf8');
function app(origin='http://127.0.0.1:3100'){
 const nodes=new Map<string,any>(),messages:any[]=[],listeners=new Map<string,Function[]>();
 class Node {
  id='';className='';style={};isConnected=true;children:Node[]=[];parent:Node|null=null;textContent='';title='';allow='';src='';contentWindow={postMessage:(data:any,origin:string)=>messages.push({data,origin})};parts=new Map<string,Node>();
  set innerHTML(_v:string){this.children=[];for(const key of ['h2','button','.ootrip-module-note']){const n=new Node();n.parent=this;this.parts.set(key,n);this.children.push(n)}}
  get firstChild(){return this.children[0]}click(){(this as any).onclick?.()}setAttribute(key:string,value:string){(this as any)[key]=value}get lastChild(){return this.children.at(-1)!}querySelector(key:string){return this.parts.get(key)!}
  append(n:Node){n.parent=this;this.children.push(n);if(n.id)nodes.set(n.id,n)}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);if(this.id)nodes.delete(this.id)}
  removeAttribute(key:string){if(key==='id'){nodes.delete(this.id);this.id=''}}
 }
 const phone=new Node(),saved:any[]=[];
 class Reader {result='';onload?:()=>void;onerror?:()=>void;readAsDataURL(blob:Blob){void blob.arrayBuffer().then(bytes=>{this.result='data:'+blob.type+';base64,'+Buffer.from(bytes).toString('base64');this.onload?.()}).catch(()=>this.onerror?.())}}
 const context=createContext({URL,URLSearchParams,FileReader:Reader,AbortSignal,fetch:async()=>({ok:true,json:async()=>({configured:false})}),crypto:{randomUUID:()=>String(Math.random())},setTimeout,clearTimeout,history:{replaceState(){}},location:{origin,href:origin+'/app/index.html',protocol:'http:',search:'',pathname:'/app/index.html'},localStorage:{getItem:()=>null},document:{createElement:()=>new Node(),getElementById:(id:string)=>nodes.get(id)||null,querySelector:()=>phone},OotripWardrobe:{ready:Promise.resolve(),read:async()=>[{id:'existing'}],save:async(items:any[])=>saved.push(...items),cache:[]}});
 runInContext('globalThis.window=globalThis;',context);context.addEventListener=(type:string,fn:Function)=>{listeners.set(type,[...(listeners.get(type)||[]),fn])};context.removeEventListener=()=>{};
 runInContext(source,context);
 const send=async(e:any)=>{for(const fn of listeners.get('message')||[])await fn(e)};
 return {context,nodes,messages,saved,send,phone};
}
it('only the currently mounted same-origin module can read or write the host wardrobe',async()=>{
 const a=app();await a.context.openOotripModule('fitting');const pane=a.nodes.get('ootrip-module'),frame=pane.lastChild;
 await a.send({origin:'http://127.0.0.1:3100',source:{},data:{type:'ootrip:wardrobe-rpc',method:'read',id:'forged'}});expect(a.messages).toEqual([]);
 await a.send({origin:'https://foreign.invalid',source:frame.contentWindow,data:{type:'ootrip:wardrobe-rpc',method:'read',id:'foreign'}});expect(a.messages).toEqual([]);
 await a.send({origin:'http://127.0.0.1:3100',source:frame.contentWindow,data:{type:'ootrip:wardrobe-rpc',method:'read',id:'read'}});expect(a.messages.at(-1).data.result).toEqual([{id:'existing'}]);
 await a.send({origin:'http://127.0.0.1:3100',source:frame.contentWindow,data:{type:'ootrip:wardrobe-rpc',method:'save',items:[{id:'new'}],id:'write'}});expect(a.saved).toEqual([{id:'new'}]);
 a.context.closeOotripModule();expect(a.messages.at(-1).data.type).toBe('ootrip:module-close');expect(a.nodes.has('ootrip-module')).toBe(false);
});
it('switching modules closes the previous camera and mounts a same-origin journal without a second phone shell',async()=>{
 const a=app();await a.context.openOotripModule('fitting');expect(a.nodes.get('ootrip-module').lastChild.src).toBe('/photo-screen?integrated=1');
 await a.context.openOotripModule('journal');expect(a.messages.at(-1).data.type).toBe('ootrip:module-close');expect(a.nodes.get('ootrip-module').lastChild.src).toBe('/journal-screen?integrated=1');
});

it('a file preview explains the unified entry without opening a new window',async()=>{
 const a=app();a.context.location.protocol='file:';
 a.context.open=()=>{throw Error('Unexpected popup')};
 await a.context.openOotripModule('journal');
 expect(a.nodes.get('ootrip-module').lastChild.textContent).toContain('启动OOTRIP.cmd');
});
it('closing while the service check is pending never remounts a module',async()=>{
 const a=app();let resolve:any;a.context.fetch=()=>new Promise(r=>resolve=r);
 const opening=a.context.openOotripModule('fitting');a.context.closeOotripModule();
 resolve({ok:true,json:async()=>({configured:false})});await opening;
 expect(a.nodes.has('ootrip-module')).toBe(false);
});

it('opens the journal inline on a Pages subpath without a backend or questionnaire popup',async()=>{
 const a=app();a.context.location.origin='https://ootrip-2026.github.io';a.context.location.pathname='/OOTRIP-style-claw/index.html';a.context.location.protocol='https:';
 a.context.fetch=()=>{throw Error('Static entry must not require the local backend')};
 a.context.open=()=>{throw Error('Unexpected popup')};
 await a.context.openOotripModule('journal');
 expect(a.nodes.get('ootrip-module').lastChild.src).toBe('modules/journal-screen.html?integrated=1');
});
it('offers photo and realtime fitting inside the existing host on static hosting',async()=>{
 const a=app();a.context.location.origin='https://ootrip-2026.github.io';
 await a.context.openOotripModule('fitting');
 const pane=a.nodes.get('ootrip-module'),tabs=pane.children.find((n:any)=>n.className==='ootrip-fitting-tabs');
 expect(pane.lastChild.src).toBe('modules/photo-screen.html?integrated=1');
 tabs.children[1].click();expect(pane.lastChild.src).toBe('modules/fitting-screen.html?integrated=1');
 expect(a.messages.at(-1).data.type).toBe('ootrip:module-close');
});
it('mirrors saved canvas outfits into both fitting tabs without persisting them as garments',async()=>{
 const a=app();let looks=[{url:'data:image/webp;base64,AA==',name:'我的搭配'}];a.context.localStorage.getItem=(key:string)=>key==='ootrip-saved-outfits'?JSON.stringify(looks):null;
 await a.context.openOotripModule('fitting');const pane=a.nodes.get('ootrip-module');
 const read=async()=>{await a.send({origin:a.context.location.origin,source:pane.lastChild.contentWindow,data:{type:'ootrip:wardrobe-rpc',method:'read',id:'read'}});return a.messages.at(-1).data.result};
 let outfits=await read();expect(outfits).toHaveLength(2);expect(outfits[1]).toMatchObject({name:'我的搭配',category:'套装',image:looks[0].url});expect(outfits[1].id).toMatch(/^saved-outfit-/);
 await a.send({origin:a.context.location.origin,source:pane.lastChild.contentWindow,data:{type:'ootrip:wardrobe-rpc',method:'save',items:[outfits[1]],remove:true,id:'delete'}});expect(a.saved).toEqual([]);expect(a.messages.at(-1).data.error).toContain('选择已有搭配');
 const tabs=pane.children.find((n:any)=>n.className==='ootrip-fitting-tabs');tabs.children[1].click();expect((await read())[1]).toMatchObject(outfits[1]);
 looks=[];expect(await read()).toEqual([{id:'existing'}]);expect(a.saved).toEqual([]);
});
it('loads confirmed AI outfits from same-origin static assets, ignoring remote and unexpected URLs',async()=>{
 const a=app('https://ootrip-2026.github.io');a.context.location.href='https://ootrip-2026.github.io/OOTRIP-style-claw/index.html';
 a.context.localStorage.getItem=(key:string)=>key==='ootrip-saved-outfits'?JSON.stringify([{url:'ai-chat/assets/day3.jpg',name:'AI 搭配'},{url:'https://foreign.invalid/private.jpg'},{url:'../secrets.jpg'}]):null;
 const fetched:string[]=[];a.context.fetch=async(url:URL)=>{fetched.push(String(url));return {ok:true,blob:async()=>new Blob(['test'],{type:'image/jpeg'})}};
 await a.context.openOotripModule('fitting');const frame=a.nodes.get('ootrip-module').lastChild;
 await a.send({origin:a.context.location.origin,source:frame.contentWindow,data:{type:'ootrip:wardrobe-rpc',method:'read',id:'read'}});
 expect(fetched).toEqual(['https://ootrip-2026.github.io/OOTRIP-style-claw/ai-chat/assets/day3.jpg']);expect(a.messages.at(-1).data.result[1]).toMatchObject({name:'AI 搭配',category:'套装',image:'data:image/jpeg;base64,dGVzdA=='});
 await a.send({origin:a.context.location.origin,source:frame.contentWindow,data:{type:'ootrip:wardrobe-rpc',method:'read',id:'read-again'}});expect(fetched).toHaveLength(1);
});
it('does not add saved outfits to journal clothing records',async()=>{
 const a=app();a.context.localStorage.getItem=(key:string)=>key==='ootrip-saved-outfits'?JSON.stringify([{url:'data:image/png;base64,AA=='}]):null;
 await a.context.openOotripModule('journal');const frame=a.nodes.get('ootrip-module').lastChild;
 await a.send({origin:a.context.location.origin,source:frame.contentWindow,data:{type:'ootrip:wardrobe-rpc',method:'read',id:'read'}});expect(a.messages.at(-1).data.result).toEqual([{id:'existing'}]);
});
it('keeps persistent garments and other saved outfits when an AI thumbnail cannot be loaded',async()=>{
 const a=app('https://ootrip-2026.github.io');a.context.localStorage.getItem=(key:string)=>key==='ootrip-saved-outfits'?JSON.stringify([{url:'ai-chat/assets/look1.jpg'},{url:'data:image/png;base64,AA==',name:'可用搭配'}]):null;a.context.fetch=async()=>{throw Error('missing thumbnail')};
 await a.context.openOotripModule('fitting');const frame=a.nodes.get('ootrip-module').lastChild;
 await a.send({origin:a.context.location.origin,source:frame.contentWindow,data:{type:'ootrip:wardrobe-rpc',method:'read',id:'read'}});expect(a.messages.at(-1).data.result).toHaveLength(2);expect(a.messages.at(-1).data.result[0]).toEqual({id:'existing'});expect(a.messages.at(-1).data.result[1].name).toBe('可用搭配');
});
