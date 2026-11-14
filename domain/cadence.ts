import { addUtcDays, compareUtcDays, daysBetween, daysUntil, isSameUtcDay } from "./dates";
import { isActiveQuote, isStructuredAttempt, type CadenceResult, type FollowUpOutcomeCode, type Quote } from "./types";

export const CADENCE_RULES = { initialWaitDays:3, dueSoonDays:1, noAnswerDays:[3,4,7], conversationDays:5, interestedDays:2, coldQuoteDays:14, coldSilenceDays:10, expirationWindowDays:3 } as const;
export const OUTCOME_LABELS: Record<FollowUpOutcomeCode,string> = {
  no_answer:"No answer", voicemail_left:"Voicemail left", message_sent:"Message sent", still_considering:"Spoke — still considering", needs_more_time:"Spoke — needs more time", callback_requested:"Callback requested", revision_requested:"Revision requested", project_postponed:"Customer postponed project", customer_interested:"Customer interested", verbally_accepted:"Verbally accepted / ready to proceed", declined:"Declined", wrong_contact:"Wrong / unreachable contact", other:"Other",
};
export const OUTCOME_OPTIONS = Object.entries(OUTCOME_LABELS).map(([value,label])=>({value:value as FollowUpOutcomeCode,label}));

function attempts(quote:Quote){return quote.activities.filter(isStructuredAttempt).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt));}
function lastActivityAt(quote:Quote):string { return [quote.sentAt,quote.lastInboundResponseAt,quote.lastOutboundFollowUpAt,...quote.activities.map(a=>a.occurredAt)].filter((v):v is string=>Boolean(v)).sort().at(-1) ?? quote.createdAt; }
function suggestedFor(outcome:FollowUpOutcomeCode|undefined, at:string, count:number):string|undefined {
  if(outcome==="no_answer"||outcome==="voicemail_left"||outcome==="message_sent") return addUtcDays(at,CADENCE_RULES.noAnswerDays[Math.min(count-1,CADENCE_RULES.noAnswerDays.length-1)]);
  if(outcome==="customer_interested") return addUtcDays(at,CADENCE_RULES.interestedDays);
  if(outcome==="still_considering"||outcome==="needs_more_time") return addUtcDays(at,CADENCE_RULES.conversationDays);
  return addUtcDays(at,CADENCE_RULES.conversationDays);
}
function stateForDue(dueAt:string,now:string):CadenceResult["state"] { const cmp=compareUtcDays(dueAt,now); if(cmp<0)return "overdue"; if(cmp===0)return "due"; return daysUntil(dueAt,now)<=CADENCE_RULES.dueSoonDays?"due_soon":"not_due"; }
export function evaluateCadence(quote:Quote,now:string):CadenceResult {
  const history=attempts(quote); const last=history.at(-1); const lastOutcome=last?.outcomeCode; const attemptCount=history.length;
  if(!isActiveQuote(quote)||quote.status==="draft") return {state:"suppressed",reason:quote.status==="draft"?"Quote has not been sent":`Quote is ${quote.status}`,recommendedAction:"No follow-up needed",attemptCount,lastOutcome,suppressed:true};
  if(quote.expiresAt&&compareUtcDays(quote.expiresAt,now)<0) return {state:"suppressed",dueAt:quote.expiresAt,reason:"Quote has expired",recommendedAction:"Review lifecycle status before any follow-up",attemptCount,lastOutcome,suppressed:true};
  if(quote.sellerAction) return {state:"due",dueAt:quote.sellerAction.createdAt,becameDueAt:quote.sellerAction.createdAt,reason:quote.sellerAction.type==="revision_required"?"Customer requested a quote revision":"Contact information needs correction",recommendedAction:quote.sellerAction.type==="revision_required"?"Prepare the requested revision":"Fix the contact information",attemptCount,lastOutcome,suppressed:false};
  if(quote.deferral && compareUtcDays(quote.deferral.until,now)>0) return {state:"deferred",dueAt:quote.deferral.until,reason:`Deferred until ${quote.deferral.until.slice(0,10)} — ${quote.deferral.reason}`,recommendedAction:"Wait until the scheduled date",attemptCount,lastOutcome,suppressed:true};
  const inboundUnanswered=Boolean(quote.lastInboundResponseAt&&(!quote.lastOutboundFollowUpAt||quote.lastInboundResponseAt>quote.lastOutboundFollowUpAt));
  if(inboundUnanswered) return {state:"due",dueAt:quote.lastInboundResponseAt,becameDueAt:quote.lastInboundResponseAt,reason:"Customer response is waiting for seller action",recommendedAction:"Respond to the customer today",suggestedNextFollowUpAt:addUtcDays(now,2),attemptCount,lastOutcome,suppressed:false};
  let dueAt=quote.deferral?.until ?? quote.nextFollowUpAt;
  let reason=quote.deferral?`Scheduled ${quote.deferral.kind.replaceAll("_"," ")}`:quote.nextFollowUpAt?"Promised follow-up date":"";
  if(!dueAt){ if(!quote.sentAt)return {state:"suppressed",reason:"Quote has not been sent",recommendedAction:"Send the quote",attemptCount,lastOutcome,suppressed:true}; dueAt=last?suggestedFor(lastOutcome,last.occurredAt,attemptCount):addUtcDays(quote.sentAt,CADENCE_RULES.initialWaitDays); reason=last?`${OUTCOME_LABELS[lastOutcome!] ?? "Previous attempt"} set the next cadence` : "Initial follow-up window elapsed"; }
  if(!dueAt) throw new Error("Active sent quote cadence must resolve a due date.");
  if(quote.expiresAt&&daysUntil(quote.expiresAt,now)>=0&&compareUtcDays(quote.expiresAt,dueAt)<=0){dueAt=quote.expiresAt;reason="Quote expiration is the next deadline";}
  if(reason==="Quote expiration is the next deadline"&&daysUntil(dueAt,now)<=CADENCE_RULES.expirationWindowDays) return {state:"due",dueAt,becameDueAt:now,reason,recommendedAction:"Follow up before the quote expires",suggestedNextFollowUpAt:suggestedFor(lastOutcome,now,attemptCount+1),attemptCount,lastOutcome,suppressed:false};
  const state=stateForDue(dueAt,now); const overdue=state==="overdue";
  return {state,dueAt,becameDueAt:dueAt,reason,recommendedAction:overdue?"Complete the overdue follow-up":state==="due"?"Follow up today":state==="due_soon"?"Prepare the next follow-up":"Wait until the cadence date",suggestedNextFollowUpAt:suggestedFor(lastOutcome,now,attemptCount+1),attemptCount,lastOutcome,suppressed:false};
}
export function cadenceLabel(state:CadenceResult["state"]):string{return {not_due:"Not due",due_soon:"Due soon",due:"Due today",overdue:"Overdue",deferred:"Deferred",suppressed:"Suppressed"}[state];}
export function isActionableCadence(result:CadenceResult):boolean{return result.state==="due"||result.state==="overdue";}
export function isColdCandidate(quote:Quote,now:string):boolean{return Boolean(quote.sentAt&&daysBetween(quote.sentAt,now)>=CADENCE_RULES.coldQuoteDays&&daysBetween(lastActivityAt(quote),now)>=CADENCE_RULES.coldSilenceDays);}
export function callbackIsDueToday(quote:Quote,now:string):boolean{return Boolean(quote.nextFollowUpAt&&isSameUtcDay(quote.nextFollowUpAt,now));}