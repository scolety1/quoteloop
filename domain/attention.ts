import { evaluateCadence, isColdCandidate } from "./cadence";
import { daysBetween, daysUntil, formatRelativeTime, hoursBetween } from "./dates";
import { isActiveQuote, type AttentionResult, type Quote } from "./types";
export const ATTENTION_RULES={initialWaitDays:3,normalFollowUpDays:5,noFollowUpEscalationDays:7,coldSentDays:14,coldSilenceDays:10,recentInboundHours:96,expirationWindowDays:3} as const;
const usd=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});
function valueWeight(amount:number){return amount>=20000?12:amount>=10000?10:amount>=5000?8:amount>=2000?5:2;}
function clamp(score:number){return Math.max(0,Math.min(100,Math.round(score)));}
export function prioritizeQuote(quote:Quote,now:string):AttentionResult {
  if(!isActiveQuote(quote))return {lane:null,score:0,reasons:[`Quote is ${quote.status}`],recommendedAction:"No active follow-up needed"};
  const cadence=evaluateCadence(quote,now);
  if(quote.status==="draft"||!quote.sentAt)return {lane:"WATCH",score:8+valueWeight(quote.amount),reasons:["Quote is still a draft",`${usd.format(quote.amount)} quote`],recommendedAction:"Send the quote when it is ready"};
  if(cadence.state==="deferred"||cadence.state==="suppressed")return {lane:"WATCH",score:12+valueWeight(quote.amount),reasons:[cadence.reason,`${usd.format(quote.amount)} quote`],recommendedAction:cadence.recommendedAction};
  const sentDays=daysBetween(quote.sentAt,now); const inbound=quote.lastInboundResponseAt; const outbound=quote.lastOutboundFollowUpAt; const inboundHours=inbound?hoursBetween(inbound,now):Infinity; const unanswered=Boolean(inbound&&(!outbound||inbound>outbound));
  const score=10+valueWeight(quote.amount)+Math.min(10,Math.floor(sentDays/3)); const reasons:string[]=[];
  if(quote.sellerAction){reasons.push(cadence.reason,`${usd.format(quote.amount)} quote`);return {lane:"CALL_NOW",score:clamp(Math.max(score+40,82)),reasons,recommendedAction:cadence.recommendedAction};}
  if(unanswered){reasons.push(`Customer replied ${formatRelativeTime(inbound!,now)}`,"No follow-up since customer response");return {lane:"CALL_NOW",score:clamp(Math.max(score+(inboundHours<=96?45:30),82)),reasons,recommendedAction:"Call customer today"};}
  if(quote.nextFollowUpAt&&cadence.state==="overdue"){const overdue=Math.floor(daysBetween(quote.nextFollowUpAt,now));reasons.push(`Promised follow-up is ${overdue} ${overdue===1?"day":"days"} overdue`,`${usd.format(quote.amount)} quote`);return {lane:"CALL_NOW",score:clamp(Math.max(score+38,82)),reasons,recommendedAction:"Complete the promised follow-up today"};}
  if(quote.nextFollowUpAt&&cadence.state==="due"){reasons.push("Promised follow-up is due today",`${usd.format(quote.amount)} quote`);return {lane:"CALL_NOW",score:clamp(Math.max(score+38,82)),reasons,recommendedAction:"Complete the promised follow-up today"};}
  const expires=quote.expiresAt?daysUntil(quote.expiresAt,now):Infinity;
  if(expires>=0&&expires<=ATTENTION_RULES.expirationWindowDays){reasons.push(expires<1?"Quote expires today":`Quote expires in ${Math.ceil(expires)} ${Math.ceil(expires)===1?"day":"days"}`,`${usd.format(quote.amount)} quote`);return {lane:"FOLLOW_UP",score:clamp(Math.max(score+18,45)),reasons,recommendedAction:"Follow up before the quote expires"};}
  if(isColdCandidate(quote,now)){reasons.push(`${Math.floor(daysBetween(outbound??quote.sentAt,now))} days without customer activity`,"Quote is at risk of going stale",`${usd.format(quote.amount)} quote`);return {lane:"GOING_COLD",score:clamp(Math.max(score+28,62)),reasons,recommendedAction:"Re-engage before this quote goes stale"};}
  if(cadence.state==="due"||cadence.state==="overdue"){ if(!outbound)reasons.push(`No follow-up recorded in ${Math.floor(sentDays)} days`);else reasons.push(`${Math.floor(daysBetween(outbound,now))} days since last follow-up`); if(cadence.state==="overdue")reasons.push("Cadence is overdue"); if(quote.amount>=5000)reasons.push(`${usd.format(quote.amount)} quote`); return {lane:"FOLLOW_UP",score:clamp(Math.max(score+(cadence.state==="overdue"?28:18),45)),reasons,recommendedAction:cadence.recommendedAction}; }
  reasons.push(sentDays<3?`Sent ${formatRelativeTime(quote.sentAt,now)} - still in the initial wait window`:cadence.reason); if(quote.amount>=5000)reasons.push(`${usd.format(quote.amount)} quote`); return {lane:"WATCH",score:clamp(Math.min(score,44)),reasons,recommendedAction:cadence.recommendedAction};
}
export function prioritizeQuotes(quotes:Quote[],now:string){return quotes.map(quote=>({quote,attention:prioritizeQuote(quote,now)})).filter(x=>x.attention.lane!==null).sort((a,b)=>b.attention.score-a.attention.score);}