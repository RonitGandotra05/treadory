// DOM mouse events expose button values, not a USB device identity. Correlation
// is only a nearby observation; it must never create a pedal press or action.
export const MOUSE_WINDOW_MS = 120;
export function mouseSignal(button:number, buttons:number):string {
  const bits=[1,2,4,8,16];const names=['Left','Right','Middle','Back','Forward'];
  const held=names.filter((_,i)=>Boolean(buttons&bits[i]));
  const name=held.length?held.join(' + '):['Left','Middle','Right','Back','Forward'][button];
  return name?`${name} click`:'';
}
interface Press {ids:number[];at:number}
interface Mouse {label:string;at:number}
export class MouseObservation {
  private presses:Press[]=[];
  private mouse:Mouse[]=[];
  reset(){this.presses=[];this.mouse=[];}
  private trim(now:number){this.presses=this.presses.filter(p=>now-p.at<=MOUSE_WINDOW_MS);this.mouse=this.mouse.filter(m=>now-m.at<=MOUSE_WINDOW_MS);}
  press(ids:number[],now:number):{id:number;label:string}[] {
    this.trim(now);this.presses.push({ids,at:now});
    const matches=this.presses.filter(p=>Math.abs(now-p.at)<=MOUSE_WINDOW_MS);
    if(ids.length!==1 || matches.length!==1){this.mouse=[];return matches.flatMap(p=>p.ids.map(id=>({id,label:''})));}
    const observations=this.mouse.map(m=>({id:ids[0],label:m.label}));this.mouse=[];return observations;
  }
  observe(label:string,now:number):{id:number;label:string}[] {
    this.trim(now);const matches=this.presses.filter(p=>Math.abs(now-p.at)<=MOUSE_WINDOW_MS);
    if(matches.length===1 && matches[0].ids.length===1)return [{id:matches[0].ids[0],label}];
    // Before HID delivery, retain a bounded pending observation. Ambiguous
    // simultaneous/repeated pedal edges are never assigned to a control.
    if(!matches.length)this.mouse=[...this.mouse,{label,at:now}].slice(-16);
    return [];
  }
}
