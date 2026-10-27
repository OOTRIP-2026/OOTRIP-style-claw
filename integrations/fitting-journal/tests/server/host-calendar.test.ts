import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it } from 'vitest';
const html=readFileSync(new URL('../../../../src/index.html',import.meta.url),'utf8');
function calendar(iso:string){
 let now=Date.parse(iso);const nodes=new Map<string,any>();
 const get=(id:string)=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',disabled:false});return nodes.get(id)};
 class Clock extends Date{constructor(...args:any[]){if(!args.length)super(now);else if(args.length===1)super(args[0]);else super(args[0],args[1],args[2]??1,args[3]??0,args[4]??0,args[5]??0,args[6]??0)}static now(){return now}}
 const c=createContext({Date:Clock,Intl,Map,Number,Object,$:get,setTimeout:()=>1,clearTimeout(){},window:{addEventListener(){}},document:{hidden:false,addEventListener(){},querySelector:()=>get('trip-page').innerHTML.includes('calendar-grid')?{}:null,querySelectorAll:()=>[]},localStorage:{setItem(){}},selectedAge:'18—22',caught:new Set(),showSummary(){}});
 runInContext(html.slice(html.indexOf('const beijingDateFormat='),html.indexOf('function showTrip(')),c);
 runInContext(html.slice(html.indexOf('function renderDates(){'),html.indexOf('function getTripData(){')),c);
 return {c,get,setTime:(iso:string)=>{now=Date.parse(iso)},run:(s:string)=>runInContext(s,c)};
}
it('uses the Beijing day across UTC midnight boundaries and month rollover',()=>{
 const x=calendar('2026-10-27T00:00:00Z');
 expect(x.run("beijingToday(new Date('2026-10-26T15:59:59Z'))")).toBe('2026-10-26');
 expect(x.run("beijingToday(new Date('2026-10-26T16:00:00Z'))")).toBe('2026-10-27');
 expect(x.run("beijingToday(new Date('2026-12-31T16:00:00Z'))")).toBe('2027-01-01');
});
it('disables October 25 and 26 on the 27th while allowing today',()=>{
 const x=calendar('2026-10-27T02:00:00Z');x.run('renderDates()');const markup=x.get('trip-page').innerHTML;
 expect(markup).toMatch(/data-date="2026-10-25" disabled/);
 expect(markup).toMatch(/data-date="2026-10-26" disabled/);
 expect(markup).not.toMatch(/data-date="2026-10-27" disabled/);
});
it('refreshes an open calendar at Beijing midnight and clears expired selections',()=>{
 const x=calendar('2026-10-27T15:59:59Z');x.run("departure='2026-10-27';returnDate='2026-10-29';renderDates()");expect(x.get('trip-page').innerHTML).not.toContain('id="trip-next" disabled');
 x.setTime('2026-10-27T16:00:01Z');x.run('refreshBeijingCalendar()');
 expect(x.get('trip-page').innerHTML).toMatch(/data-date="2026-10-27" disabled/);
 expect(x.run('departure')).toBe('');expect(x.run('returnDate')).toBe('');
 expect(x.get('trip-page').innerHTML).toContain('id="trip-next" disabled');
});
