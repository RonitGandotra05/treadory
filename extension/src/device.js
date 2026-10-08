import {findDeviceProfile} from '../../src/hid/deviceProfiles.ts';
export {findDeviceProfile};
export function describe(d){
 const flat=[];const walk=items=>{for(const c of items??[]){flat.push([c.usagePage,c.usage,(c.inputReports??[]).map(r=>r.reportId).sort((a,b)=>a-b)]);walk(c.children);}};walk(d.collections);
 return {vendorId:d.vendorId,productId:d.productId,name:d.productName||'Unknown foot pedal',signature:JSON.stringify(flat.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))};
}
export function readable(d){const walk=items=>(items??[]).some(c=>c.inputReports?.length||walk(c.children));return walk(d.collections);}
export function selectDevice(devices){
 const list=[...new Set(devices)];const score=d=>findDeviceProfile(describe(d),d.collections)?2:readable(d)?1:0;
 const best=list.filter(d=>score(d)===Math.max(...list.map(score)) && score(d)>0);
 if(best.length!==1)throw new Error(best.length?'Select one readable pedal interface. Disconnect identical pedals if needed.':'This interface exposes no readable pedal input. Keyboard/mouse-only pedals need a desktop bridge.');
 return best[0];
}
export function sameDevice(d,identity){return JSON.stringify(describe(d))===JSON.stringify(identity);}
