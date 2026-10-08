import {defaultConfiguration,validateConfiguration,controlsFor} from '../../src/hid/core.ts';
export {controlsFor};
export const ACTIONS=[['none','Do nothing'],['scrollUp','Scroll up'],['scrollDown','Scroll down'],['pageUp','Page up'],['pageDown','Page down'],['play','Play / pause media'],['rewind','Rewind media'],['forward','Seek media forward'],['mute','Mute / unmute'],['previousTab','Previous tab'],['nextTab','Next tab'],['back','Go back'],['forwardHistory','Go forward'],['reload','Reload page'],['click','Click an element'],['shortcut','Website shortcut'],['insertText','Insert text']];
const controls=['left','middle','right','auxiliary'];
export const baseMappings=()=>({left:{action:'scrollUp',amount:400,seconds:5},middle:{action:'play',amount:400,seconds:5},right:{action:'scrollDown',amount:400,seconds:5},auxiliary:{action:'none',amount:400,seconds:5}});
export const defaults=()=>({version:1,enabled:true,autoConnect:false,device:null,pedalCount:3,mappings:baseMappings(),sites:{},calibrations:{}});
const object=x=>x!==null && typeof x==='object'&&!Array.isArray(x);
const integer=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
const fail=()=>{throw new Error('Settings are invalid. Your saved configuration was not replaced.');};
export function originOf(url){try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.origin:null;}catch{return null;}}
export function mapping(input){
 if(!object(input)||!ACTIONS.some(([id])=>id===input.action))return fail();
 const out={action:input.action,amount:400,seconds:5};
 if(input.amount!==undefined){if(!integer(input.amount,50,3000))return fail();out.amount=input.amount;}
 if(input.seconds!==undefined){if(!integer(input.seconds,1,120))return fail();out.seconds=input.seconds;}
 for(const [key,max] of [['selector',200],['text',1000]])if(input[key]!==undefined){if(typeof input[key]!=='string'||input[key].length>max)return fail();out[key]=input[key];}
 if(input.shortcut!==undefined){const s=input.shortcut;if(!object(s)||typeof s.key!=='string'||!s.key.length||s.key.length>40||typeof s.code!=='string'||s.code.length>40||!['ctrl','shift','alt','meta'].every(k=>typeof s[k]==='boolean'))return fail();out.shortcut={key:s.key,code:s.code,ctrl:s.ctrl,shift:s.shift,alt:s.alt,meta:s.meta};}
 if(out.action==='click' && !out.selector?.trim())throw new Error('Choose a CSS selector for the element to click.');
 if(out.action==='shortcut'&&!out.shortcut)throw new Error('Record a website shortcut first.');
 if(out.action==='insertText'&&!out.text)throw new Error('Enter text to insert.');
 return out;
}
export function mappings(input){if(!object(input))return fail();return Object.fromEntries(controls.map(c=>[c,mapping(input[c])]));}
export function identity(input){
 if(!object(input)||!integer(input.vendorId,0,65535)||!integer(input.productId,0,65535)||typeof input.name!=='string'||input.name.length>160||typeof input.signature!=='string'||input.signature.length>12000)return fail();
 return {vendorId:input.vendorId,productId:input.productId,name:input.name,signature:input.signature};
}
export function validate(input){
 if(!object(input)||input.version!==1||typeof input.enabled!=='boolean'||typeof input.autoConnect!=='boolean'||!integer(input.pedalCount,1,4)||!object(input.sites)||Object.keys(input.sites).length>50)return fail();
 const sites=Object.create(null);
 for(const [origin,value] of Object.entries(input.sites)){if(originOf(origin)!==origin||origin.length>256)return fail();sites[origin]=mappings(value);}
 const wrapped={...defaultConfiguration(),calibrations:input.calibrations};
 const calibrations=validateConfiguration(wrapped).calibrations;
 return {version:1,enabled:input.enabled,autoConnect:input.autoConnect,device:input.device===null?null:identity(input.device),pedalCount:input.pedalCount,mappings:mappings(input.mappings),sites,calibrations};
}
