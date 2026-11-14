import { addUtcDays } from "./dates";
import { CADENCE_RULES, OUTCOME_LABELS } from "./cadence";
import type { FollowUpChannel, FollowUpOutcomeCode, Quote, QuoteActivity } from "./types";

function activityId(prefix:string,at:string,count:number):string{return `${prefix}-${at.replace(/\D/g,"")}-${count+1}`;}
function appendActivity(quote:Quote,activity:Omit<QuoteActivity,"id">):Quote{return {...quote,activities:[...quote.activities,{...activity,id:activityId(quote.id,activity.occurredAt,quote.activities.length)}]};}
export interface AttemptInput { channel:FollowUpChannel; outcomeCode:FollowUpOutcomeCode; note?:string; occurredAt:string; nextFollowUpAt?:string; closeAs?:"won"|"lost"; lossReason?:string; }
export function recommendedNextDate(outcome:FollowUpOutcomeCode,occurredAt:string,attemptNumber:number):string|undefined {
  if(["no_answer","voicemail_left","message_sent"].includes(outcome))return addUtcDays(occurredAt,CADENCE_RULES.noAnswerDays[Math.min(attemptNumber-1,CADENCE_RULES.noAnswerDays.length-1)]);
  if(outcome==="customer_interested")return addUtcDays(occurredAt,CADENCE_RULES.interestedDays);
  if(outcome==="still_considering"||outcome==="needs_more_time")return addUtcDays(occurredAt,CADENCE_RULES.conversationDays);
  return undefined;
}
export function logFollowUpAttempt(quote:Quote,input:AttemptInput):Quote {
  const count=quote.activities.filter(a=>a.kind==="follow_up_attempt").length+1; const next=input.nextFollowUpAt??recommendedNextDate(input.outcomeCode,input.occurredAt,count);
  const directContact=["still_considering","needs_more_time","callback_requested","revision_requested","project_postponed","customer_interested","verbally_accepted","declined"].includes(input.outcomeCode);
  let updated=appendActivity(quote,{quoteId:quote.id,occurredAt:input.occurredAt,direction:"outbound",channel:input.channel,kind:"follow_up_attempt",provenance:"local",note:input.note?.trim()||OUTCOME_LABELS[input.outcomeCode],outcome:OUTCOME_LABELS[input.outcomeCode],outcomeCode:input.outcomeCode,directContact,nextFollowUpAt:next});
  updated={...updated,lastOutboundFollowUpAt:input.occurredAt,nextFollowUpAt:next,deferral:undefined};
  if(directContact)updated={...updated,status:"engaged",lastCustomerEngagementAt:input.occurredAt};
  if(input.outcomeCode==="callback_requested"&&next)updated={...updated,deferral:{until:next,reason:"Customer requested this callback",kind:"scheduled_callback",createdAt:input.occurredAt}};
  if(input.outcomeCode==="project_postponed"&&next)updated={...updated,deferral:{until:next,reason:"Customer postponed the project",kind:"postponed",createdAt:input.occurredAt}};
  if(input.outcomeCode==="revision_requested")updated={...updated,sellerAction:{type:"revision_required",createdAt:input.occurredAt,note:input.note}};
  if(input.outcomeCode==="wrong_contact")updated={...updated,sellerAction:{type:"fix_contact",createdAt:input.occurredAt,note:input.note}};
  if(input.closeAs==="won")return markQuoteWon(updated,input.occurredAt);
  if(input.closeAs==="lost")return markQuoteLost(updated,input.occurredAt,input.lossReason||"Declined");
  return updated;
}
export function deferQuote(quote:Quote,input:{until:string;reason:string;kind?:"scheduled_callback"|"postponed"|"snooze";occurredAt:string}):Quote {
  if(!input.until)throw new Error("A defer-until date is required."); if(input.until.slice(0,10)<=input.occurredAt.slice(0,10))throw new Error("Deferral must be a future date."); if(!input.reason.trim())throw new Error("A deferral reason is required.");
  const updated=appendActivity(quote,{quoteId:quote.id,occurredAt:input.occurredAt,direction:"system",channel:"status",kind:"deferral",provenance:"local",note:`Deferred until ${input.until.slice(0,10)} — ${input.reason.trim()}`,nextFollowUpAt:input.until});
  return {...updated,nextFollowUpAt:input.until,deferral:{until:input.until,reason:input.reason.trim(),kind:input.kind??"snooze",createdAt:input.occurredAt}};
}
export function logFollowUp(quote:Quote,input:{channel:FollowUpChannel;note:string;outcome?:string;occurredAt:string;nextFollowUpAt?:string}):Quote { const updated=logFollowUpAttempt(quote,{channel:input.channel,note:input.note,outcomeCode:legacyOutcome(input.outcome),occurredAt:input.occurredAt,nextFollowUpAt:input.nextFollowUpAt}); return input.outcome?{...updated,activities:updated.activities.map((a,index)=>index===updated.activities.length-1?{...a,outcome:input.outcome}:a)}:updated; }
export function legacyOutcome(raw?:string):FollowUpOutcomeCode { const value=(raw??"").toLowerCase(); if(value.includes("voicemail"))return "voicemail_left"; if(value.includes("no response")||value.includes("no answer"))return "no_answer"; if(value.includes("callback"))return "callback_requested"; if(value.includes("declin"))return "declined"; if(value.includes("accept"))return "verbally_accepted"; if(value.includes("interest"))return "customer_interested"; if(value.includes("consider")||value.includes("spoke"))return "still_considering"; if(value.includes("message")||value.includes("sent")||value.includes("opened"))return "message_sent"; return "other"; }
export function recordCustomerEngagement(quote:Quote,input:{channel:FollowUpChannel;note:string;occurredAt:string}):Quote { const updated=appendActivity(quote,{quoteId:quote.id,occurredAt:input.occurredAt,direction:"inbound",channel:input.channel,kind:"customer_engagement",provenance:"local",note:input.note.trim()||"Customer responded"}); return {...updated,status:quote.status==="draft"?"draft":"engaged",lastCustomerEngagementAt:input.occurredAt,lastInboundResponseAt:input.occurredAt,deferral:undefined}; }
export function setNextFollowUp(quote:Quote,nextFollowUpAt?:string,occurredAt?:string):Quote { if(!occurredAt)return {...quote,nextFollowUpAt:nextFollowUpAt||undefined}; const updated=appendActivity(quote,{quoteId:quote.id,occurredAt,direction:"system",channel:"status",kind:"schedule_change",provenance:"local",note:nextFollowUpAt?`Next follow-up set for ${nextFollowUpAt.slice(0,10)}`:"Next follow-up cleared",nextFollowUpAt}); return {...updated,nextFollowUpAt:nextFollowUpAt||undefined,deferral:undefined}; }
export function markQuoteWon(quote:Quote,occurredAt:string):Quote { const updated=appendActivity(quote,{quoteId:quote.id,occurredAt,direction:"system",channel:"status",kind:"lifecycle",provenance:"local",note:"Quote marked won"}); return {...updated,status:"won",wonAt:occurredAt,lostAt:undefined,lossReason:undefined,nextFollowUpAt:undefined,deferral:undefined,sellerAction:undefined}; }
export function markQuoteLost(quote:Quote,occurredAt:string,lossReason?:string):Quote { const reason=lossReason?.trim(); const updated=appendActivity(quote,{quoteId:quote.id,occurredAt,direction:"system",channel:"status",kind:"lifecycle",provenance:"local",note:reason?`Quote marked lost - ${reason}`:"Quote marked lost"}); return {...updated,status:"lost",lostAt:occurredAt,lossReason:reason||undefined,wonAt:undefined,nextFollowUpAt:undefined,deferral:undefined,sellerAction:undefined}; }
export function reopenQuote(quote:Quote,occurredAt:string):Quote { const updated=appendActivity(quote,{quoteId:quote.id,occurredAt,direction:"system",channel:"status",kind:"lifecycle",provenance:"local",note:"Quote reopened"}); return {...updated,status:quote.lastInboundResponseAt?"engaged":"sent",wonAt:undefined,lostAt:undefined,lossReason:undefined,deferral:undefined}; }
export function updateQuoteById(quotes:Quote[],id:string,updater:(quote:Quote)=>Quote):Quote[]{return quotes.map(q=>q.id===id?updater(q):q);}