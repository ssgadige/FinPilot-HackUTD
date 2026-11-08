import type { ToolContext } from '../../../../contracts/types.ts';
export const MEMORY_TTL_MS = 15 * 60 * 1000;
export const MEMORY_MAX_TURNS = 6;
export const MEMORY_MAX_TURN_CHARS = 700;
const MAX_CONVERSATIONS = 200;
const MAX_PER_SESSION = 5;
export type MemoryTurn = { speaker:'user'|'assistant'; text:string };
export type MemoryReset = 'new_or_expired'|'continued'|'snapshot_changed'|'source_unavailable';
export type ConversationContext = {turns:MemoryTurn[];selected_evidence_id:string|null;reset:MemoryReset};
interface Entry {userId:string;sessionKey:string;scope:string;turns:MemoryTurn[];selected:string|null;touched:number;reset?:MemoryReset;}

/** No database persistence, model role messages, auth tokens, or exported owner keys. */
export class SessionConversationMemory {
  #entries=new Map<string,Entry>();
  #timer:ReturnType<typeof setInterval>;
  private now:()=>number;
  private sessionActive:(uid:string,key:string)=>boolean;
  constructor(now:()=>number,sessionActive:(uid:string,key:string)=>boolean){
    this.now=now;this.sessionActive=sessionActive;
    this.#timer=setInterval(()=>this.prune(),60000);this.#timer.unref();
  }
  private key(uid:string,sessionKey:string,id:string){return JSON.stringify([uid,sessionKey,id]);}
  private scope(ctx:ToolContext){return JSON.stringify([ctx.snapshotVersion,[...ctx.allowedAccountIds].sort()]);}
  private prune(){
    const now=this.now();
    for(const [key,e] of this.#entries)if(now-e.touched>=MEMORY_TTL_MS||!this.sessionActive(e.userId,e.sessionKey))this.#entries.delete(key);
  }
  read(uid:string,sessionKey:string,id:string,ctx:ToolContext):ConversationContext {
    this.prune();const key=this.key(uid,sessionKey,id),entry=this.#entries.get(key);
    if(!entry)return {turns:[],selected_evidence_id:null,reset:'new_or_expired'};
    if(entry.scope!==this.scope(ctx)){
      this.#entries.set(key,{...entry,scope:this.scope(ctx),turns:[],selected:null,touched:this.now(),reset:'snapshot_changed'});
      return {turns:[],selected_evidence_id:null,reset:'snapshot_changed'};
    }
    entry.touched=this.now();return {turns:structuredClone(entry.turns),selected_evidence_id:entry.selected,reset:entry.reset??'continued'};
  }
  save(uid:string,sessionKey:string,id:string,ctx:ToolContext,previous:ConversationContext,user:string,assistant:string,selected:string|null){
    this.prune();if(!this.sessionActive(uid,sessionKey))return;
    const key=this.key(uid,sessionKey,id);
    const turns:MemoryTurn[]=[...previous.turns,{speaker:'user',text:user.slice(0,MEMORY_MAX_TURN_CHARS)},{speaker:'assistant',text:assistant.slice(0,MEMORY_MAX_TURN_CHARS)}];
    const bounded=turns.slice(-MEMORY_MAX_TURNS);
    while(bounded.length>2&&JSON.stringify({turns:bounded,selected_evidence_id:selected}).length>5500)bounded.splice(0,2);
    this.#entries.delete(key);this.#entries.set(key,{userId:uid,sessionKey,scope:this.scope(ctx),turns:bounded,selected,touched:this.now()});
    const own=[...this.#entries].filter(([,e])=>e.userId===uid&&e.sessionKey===sessionKey);
    while(own.length>MAX_PER_SESSION)this.#entries.delete(own.shift()![0]);
    while(this.#entries.size>MAX_CONVERSATIONS)this.#entries.delete(this.#entries.keys().next().value!);
  }
  forgetSession(uid:string,sessionKey:string){for(const [key,e]of this.#entries)if(e.userId===uid&&e.sessionKey===sessionKey)this.#entries.delete(key);}
  forgetConversation(uid:string,sessionKey:string,id:string){this.#entries.delete(this.key(uid,sessionKey,id));}
  dispose(){clearInterval(this.#timer);this.#entries.clear();}
}

/** Keep conversation text as data, with contact details minimized and common secrets rejected. */
export function sanitizeConversationText(value:string,secrets:readonly string[]=[]):string|null {
  const normalized=value.normalize('NFKC').replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'');
  if(/nvapi-|\b(?:password|otp|verification code|api key|session token)\b|^\s*\d{6}\s*$|\bBearer\s+\S+|\bsk-[A-Za-z0-9_-]{12,}|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i.test(normalized))return null;
  if(secrets.some(secret=>secret.length>=8&&normalized.includes(secret)))return null;
  return normalized.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[contact omitted]').trim();
}
