import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it } from 'vitest';
const html=readFileSync(new URL('../../../../src/index.html',import.meta.url),'utf8');
function scene(){
 const nodes=new Map<string,any>(),saved=new Map<string,string>();let summaries=0;
 const get=(id:string)=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',value:'',disabled:false,hidden:false,children:[],append(node:any){this.children.push(node)},focus(){}});return nodes.get(id)};
 const c=createContext({Intl,Date,Number,Object,selectedAge:'28—32',caught:new Set(['极简']),$:get,document:{createElement:()=>({textContent:'',setAttribute(k:string,v:string){this[k]=v}}),querySelectorAll:()=>get('scene-options').children},localStorage:{setItem:(k:string,v:string)=>saved.set(k,v)},showTrip(){},showSummary(){summaries++}});
 runInContext(html.slice(html.indexOf('const beijingDateFormat='),html.indexOf('function showTrip(')),c);
 runInContext(html.slice(html.indexOf('function renderTripScene(){'),html.indexOf('// Refresh exactly')),c);
 runInContext(html.slice(html.indexOf('function getTripData(){'),html.indexOf('function showSummary(){')),c);
 runInContext("beijingToday=()=> '2026-10-27';departure='2026-10-28';returnDate='2026-10-30';destination='广州';renderTripScene()",c);
 return{c,get,saved,summaries:()=>summaries,run:(s:string)=>runInContext(s,c)};
}
it('requires a scene and saves the selected option with the complete trip',()=>{
 const x=scene();expect(x.get('scene-next').disabled).toBe(true);x.get('scene-next').onclick();expect(x.summaries()).toBe(0);
 x.get('scene-options').children[1].onclick();expect(x.get('scene-next').disabled).toBe(false);x.get('scene-next').onclick();expect(x.summaries()).toBe(1);
 const trip=JSON.parse(x.saved.get('ootrip-trip')!);expect(trip.scene).toBe('城市徒步');expect(trip.days).toBe(3);expect(trip.destination).toBe('广州');
});
it('requires nonblank custom text, supports switching and clearing',()=>{
 const x=scene();x.get('scene-options').children[4].onclick();expect(x.get('scene-custom').hidden).toBe(false);expect(x.get('scene-next').disabled).toBe(true);
 x.get('scene-custom-input').oninput({target:{value:'   '}});expect(x.get('scene-next').disabled).toBe(true);
 x.get('scene-custom-input').oninput({target:{value:'  音乐节  '}});x.get('scene-next').onclick();expect(JSON.parse(x.saved.get('ootrip-trip')!).scene).toBe('音乐节');
 x.get('scene-options').children[0].onclick();expect(x.get('scene-custom').hidden).toBe(true);expect(x.run('selectedTripScene()')).toBe('海边');
 x.get('scene-clear').onclick();expect(x.get('scene-next').disabled).toBe(true);expect(x.run('selectedTripScene()')).toBe('');
});
it('preserves selection when returning and displays step five of six',()=>{
 const x=scene();x.get('scene-options').children[3].onclick();x.get('scene-options').children=[];x.run('renderTripScene()');
 expect(x.get('trip-page').innerHTML).toContain('5 / 6');expect(x.get('scene-options').children[3]['aria-pressed']).toBe('true');expect(x.get('scene-next').disabled).toBe(false);
});
