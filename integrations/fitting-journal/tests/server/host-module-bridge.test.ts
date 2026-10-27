import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it } from 'vitest';
const source=readFileSync(new URL('../../../../src/module-integration.js',import.meta.url),'utf8');
function app(){
 const nodes=new Map<string,any>(),messages:any[]=[],listeners=new Map<string,Function[]>();
 class Node {
  id='';className='';style={};children:Node[]=[];parent:Node|null=null;textContent='';title='';allow='';src='';contentWindow={postMessage:(data:any,origin:string)=>messages.push({data,origin})};parts=new Map<string,Node>();
  set innerHTML(_v:string){this.children=[];for(const key of ['h2','button','.ootrip-module-note']){const n=new Node();n.parent=this;this.parts.set(key,n);this.children.push(n)}}
  get lastChild(){return this.children.at(-1)!}querySelector(key:string){return this.parts.get(key)!}
  append(n:Node){n.parent=this;this.children.push(n);if(n.id)nodes.set(n.id,n)}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);if(this.id)nodes.delete(this.id)}
  removeAttribute(key:string){if(key==='id'){nodes.delete(this.id);this.id=''}}
 }
 const phone=new Node(),saved:any[]=[];
 const context=createContext({URLSearchParams,crypto:{randomUUID:()=>String(Math.random())},setTimeout,clearTimeout,history:{replaceState(){}},location:{origin:'http://127.0.0.1:3100',protocol:'http:',search:'',pathname:'/app/index.html'},localStorage:{getItem:()=>null},document:{createElement:()=>new Node(),getElementById:(id:string)=>nodes.get(id)||null,querySelector:()=>phone},OotripWardrobe:{ready:Promise.resolve(),read:async()=>[{id:'existing'}],save:async(items:any[])=>saved.push(...items),cache:[]}});
 runInContext('globalThis.window=globalThis;',context);context.addEventListener=(type:string,fn:Function)=>{listeners.set(type,[...(listeners.get(type)||[]),fn])};context.removeEventListener=()=>{};
 runInContext(source,context);
 const send=async(e:any)=>{for(const fn of listeners.get('message')||[])await fn(e)};
 return {context,nodes,messages,saved,send,phone};
}
it('only the currently mounted same-origin module can read or write the host wardrobe',async()=>{
 const a=app();a.context.openOotripModule('fitting');const pane=a.nodes.get('ootrip-module'),frame=pane.lastChild;
 await a.send({origin:'http://127.0.0.1:3100',source:{},data:{type:'ootrip:wardrobe-rpc',method:'read',id:'forged'}});expect(a.messages).toEqual([]);
 await a.send({origin:'https://foreign.invalid',source:frame.contentWindow,data:{type:'ootrip:wardrobe-rpc',method:'read',id:'foreign'}});expect(a.messages).toEqual([]);
 await a.send({origin:'http://127.0.0.1:3100',source:frame.contentWindow,data:{type:'ootrip:wardrobe-rpc',method:'read',id:'read'}});expect(a.messages.at(-1).data.result).toEqual([{id:'existing'}]);
 await a.send({origin:'http://127.0.0.1:3100',source:frame.contentWindow,data:{type:'ootrip:wardrobe-rpc',method:'save',items:[{id:'new'}],id:'write'}});expect(a.saved).toEqual([{id:'new'}]);
 a.context.closeOotripModule();expect(a.messages.at(-1).data.type).toBe('ootrip:module-close');expect(a.nodes.has('ootrip-module')).toBe(false);
});
it('switching modules closes the previous camera and mounts a same-origin journal without a second phone shell',()=>{
 const a=app();a.context.openOotripModule('fitting');expect(a.nodes.get('ootrip-module').lastChild.src).toBe('/fitting-screen?integrated=1');
 a.context.openOotripModule('journal');expect(a.messages.at(-1).data.type).toBe('ootrip:module-close');expect(a.nodes.get('ootrip-module').lastChild.src).toBe('/journal-screen?integrated=1');
});
