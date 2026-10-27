import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { IDBFactory } from 'fake-indexeddb';
import { expect, it } from 'vitest';
const source = readFileSync(new URL('../../../../src/wardrobe-store.js',import.meta.url),'utf8');
function host(indexedDB = new IDBFactory(), values = new Map<string,string>()) {
 const events:unknown[]=[];
 const context=createContext({indexedDB,localStorage:{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v)},CustomEvent:class{constructor(public type:string,public options:unknown){}},location:{protocol:'file:'}});
 runInContext(`globalThis.window=globalThis;window.dispatchEvent=event=>events.push(event);window.OOTRIP_WARDROBE_SEED=[{id:'library-01',name:'针织衫',category:'上衣',image:'data:image/png;base64,AAAA',purchased:true}];`,Object.assign(context,{events}));
 runInContext(source,context);
 return {store:context.OotripWardrobe,events,indexedDB,values};
}
it('uses one persistent wardrobe and keeps uploads after opening another host',async()=>{
 const a=host();await a.store.ready;
 expect((await a.store.read()).map((x:{id:string})=>x.id)).toEqual(['library-01']);
 await a.store.save([{id:'uploaded-1',name:'自己的衣物',category:'外套',image:'data:image/png;base64,AAAA',purchased:true}]);
 const b=host(a.indexedDB,a.values);await b.store.ready;
 expect((await b.store.read()).map((x:{id:string})=>x.id).sort()).toEqual(['library-01','uploaded-1']);
 await b.store.save([{id:'uploaded-1',name:'自己的衣物',category:'外套',image:'data:image/png;base64,AAAA'}],true);
 expect((await a.store.read()).map((x:{id:string})=>x.id)).toEqual(['library-01']);
});
it('does not resurrect deleted garments or seed over an existing wardrobe',async()=>{
 const a=host();await a.store.ready;await a.store.replace([]);
 const b=host(a.indexedDB,a.values);await b.store.ready;expect(await b.store.read()).toEqual([]);
});
it('rejects invalid images before replacing any stored clothes',async()=>{
 const a=host();await a.store.ready;
 expect(()=>a.store.replace([{id:'x',name:'bad',category:'上衣',image:'https://bad.invalid/photo'}])).toThrow();
 expect((await a.store.read()).length).toBe(1);
});
