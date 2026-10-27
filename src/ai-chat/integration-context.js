'use strict';
const rawTrip=new URLSearchParams(location.hash.slice(1)).get('trip');let importedTrip={};try{importedTrip=JSON.parse(rawTrip||'{}')}catch{}
const tripStart=/^\d{4}-\d{2}-\d{2}$/.test(importedTrip.departure||'')?importedTrip.departure:new Date().toISOString().slice(0,10);
const tripEnd=/^\d{4}-\d{2}-\d{2}$/.test(importedTrip.returnDate||'')?importedTrip.returnDate:tripStart;
const chatTrip={destination:String(importedTrip.destination||'目的地').slice(0,80),scene:String(importedTrip.scene||'').slice(0,80),styles:Array.isArray(importedTrip.styles)?importedTrip.styles.filter(s=>typeof s==='string').slice(0,12):[],departure:tripStart,returnDate:tripEnd,days:Math.max(1,Math.min(366,Number(importedTrip.days)||1))};
function chatDayDate(day){const date=new Date(chatTrip.departure+'T12:00:00');date.setDate(date.getDate()+day-1);return {label:(date.getMonth()+1)+'月'+date.getDate()+'日',iso:date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0')}}
window.onBack=()=>window.parent.postMessage({type:'ootrip:chat-back'},'*');
