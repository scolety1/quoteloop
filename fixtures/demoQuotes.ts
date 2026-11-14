import { DEMO_NOW, type Quote, type QuoteActivity, type QuoteStatus } from "../domain/types";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const now = new Date(DEMO_NOW).getTime();

export const daysAgo = (days: number) => new Date(now - days * DAY).toISOString();
export const hoursAgo = (hours: number) => new Date(now - hours * HOUR).toISOString();
export const daysFromNow = (days: number) => new Date(now + days * DAY).toISOString();

const providers: Quote["sourceProvider"][] = ["Jobber", "ServiceTitan", "Housecall Pro", "QuickBooks", "Manual"];

function outbound(id: string, days: number, channel: QuoteActivity["channel"], note: string, outcome?: string): QuoteActivity {
  return { id: `${id}-out-${days}`, occurredAt: daysAgo(days), direction: "outbound", channel, note, outcome };
}
function inbound(id: string, when: string, channel: QuoteActivity["channel"], note: string): QuoteActivity {
  return { id: `${id}-in-${when.replace(/\D/g, "").slice(-8)}`, occurredAt: when, direction: "inbound", channel, note };
}
function statusActivity(id: string, when: string, note: string): QuoteActivity {
  return { id: `${id}-status`, occurredAt: when, direction: "system", channel: "status", note };
}

type Seed = {
  id: string; customer: string; service: string; trade: string; amount: number; sentDays?: number;
  status?: QuoteStatus; createdDays?: number; expiresAt?: string; nextFollowUpAt?: string; notes?: string;
  activities?: QuoteActivity[]; wonAt?: string; lostAt?: string; lossReason?: string;
};

function quote(seed: Seed): Quote {
  const activities = seed.activities ?? [];
  const outbounds = activities.filter((item) => item.direction === "outbound").sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const inbounds = activities.filter((item) => item.direction === "inbound").sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const numericId = Number(seed.id.replace(/\D/g, ""));
  const status = seed.status ?? (inbounds.length ? "engaged" : "sent");
  return {
    id: seed.id,
    customerName: seed.customer,
    serviceDescription: seed.service,
    trade: seed.trade,
    amount: seed.amount,
    createdAt: daysAgo(seed.createdDays ?? (seed.sentDays ?? 0) + 2),
    sentAt: seed.sentDays === undefined ? undefined : daysAgo(seed.sentDays),
    expiresAt: seed.expiresAt,
    status,
    lastCustomerEngagementAt: inbounds[0]?.occurredAt,
    lastOutboundFollowUpAt: outbounds[0]?.occurredAt,
    lastInboundResponseAt: inbounds[0]?.occurredAt,
    nextFollowUpAt: seed.nextFollowUpAt,
    wonAt: seed.wonAt,
    lostAt: seed.lostAt,
    lossReason: seed.lossReason,
    notes: seed.notes ?? "",
    originalId: `EST-${String(numericId).padStart(5, "0")}`,
    sourceProvider: providers[(numericId - 1) % providers.length],
    activities,
  };
}

const openQuotes: Quote[] = [
  quote({ id: "q001", customer: "Maya Johnson", service: "Standing-seam roof replacement", trade: "Roofing", amount: 8400, sentDays: 6, activities: [outbound("q001", 3, "email", "Shared shingle color options", "Options sent"), inbound("q001", hoursAgo(9), "text", "Likes charcoal; asked whether installation can start next week")], notes: "Customer wants work completed before a family visit.", expiresAt: daysFromNow(9) }),
  quote({ id: "q002", customer: "Ravi Patel", service: "Emergency mini-split replacement", trade: "HVAC", amount: 1850, sentDays: 2, activities: [inbound("q002", hoursAgo(6), "call", "Confirmed the electrical panel is accessible and asked for earliest availability")], notes: "Small job, high intent. Upstairs unit is currently offline." }),
  quote({ id: "q003", customer: "Erin Thompson", service: "200A electrical panel upgrade", trade: "Electrical", amount: 4200, sentDays: 5, notes: "Referred by an existing customer." }),
  quote({ id: "q004", customer: "Luis Romero", service: "Whole-home repipe", trade: "Plumbing", amount: 12600, sentDays: 9, notes: "Estimate delivered after an on-site walkthrough." }),
  quote({ id: "q005", customer: "Dana Clark", service: "Roof deck repair and reroof", trade: "Roofing", amount: 11700, sentDays: 21, activities: [outbound("q005", 15, "call", "Left voicemail after estimate review", "Voicemail"), outbound("q005", 12, "email", "Sent financing information", "No response"), outbound("q005", 10, "text", "Checked whether questions came up", "No response")], notes: "Three attempts with no reply; financing may be the blocker." }),
  quote({ id: "q006", customer: "Marcus Ellis", service: "Heat pump tune-up and duct sealing", trade: "HVAC", amount: 3250, sentDays: 10, activities: [outbound("q006", 6, "call", "Customer asked to reconnect after payday", "Callback requested")], nextFollowUpAt: daysAgo(2), notes: "Promised a call Tuesday morning." }),
  quote({ id: "q007", customer: "Kim Nguyen", service: "Spring irrigation repair", trade: "Landscaping", amount: 940, sentDays: 1, notes: "New estimate; give the customer breathing room." }),
  quote({ id: "q008", customer: "Owen Sullivan", service: "Garage EV charger installation", trade: "Electrical", amount: 6800, sentDays: 8, activities: [outbound("q008", 4, "email", "Sent permit and charger compatibility details", "Opened")], expiresAt: daysFromNow(2), notes: "Material pricing is held only through Friday." }),
  quote({ id: "q009", customer: "Janelle Carter", service: "Sewer line trenchless replacement", trade: "Plumbing", amount: 15400, sentDays: 35, activities: [outbound("q009", 24, "call", "Left a voicemail about project timing", "Voicemail")], notes: "No activity since the first call; estimate is aging." }),
  quote({ id: "q010", customer: "Noah Brooks", service: "Kitchen cabinet refacing", trade: "Remodeling", amount: 7600, sentDays: 28, activities: [outbound("q010", 20, "email", "Shared revised door samples", "No response"), inbound("q010", hoursAgo(12), "email", "Reopened the conversation and asked if the walnut option is still available")], notes: "Conversation restarted after a long quiet period." }),
  quote({ id: "q011", customer: "Sofia Garcia", service: "Commercial service upgrade", trade: "Electrical", amount: 23000, sentDays: 3, activities: [outbound("q011", 2, "email", "Delivered requested insurance certificates", "Received")], notes: "Facilities manager is comparing budget windows." }),
  quote({ id: "q012", customer: "Caleb White", service: "Furnace and thermostat replacement", trade: "HVAC", amount: 5600, sentDays: 7, activities: [outbound("q012", 1, "text", "Answered thermostat compatibility question", "Customer reviewing")], notes: "Recent seller reply; no immediate action needed." }),
  quote({ id: "q013", customer: "Avery Adams", service: "Tankless water heater conversion", trade: "Plumbing", amount: 2850, sentDays: 12, activities: [outbound("q013", 7, "email", "Sent venting clarification", "Opened")], notes: "Follow-up cadence is due." }),
  quote({ id: "q014", customer: "Jordan Brown", service: "Storm-damage roof repair", trade: "Roofing", amount: 9800, sentDays: 17, activities: [outbound("q014", 11, "call", "Left voicemail about insurance paperwork", "Voicemail")], notes: "Insurance claim is still unresolved." }),
  quote({ id: "q015", customer: "Casey Moore", service: "Ceiling fan and dimmer installation", trade: "Electrical", amount: 1200, sentDays: 4, notes: "Straightforward residential project." }),
  quote({ id: "q016", customer: "Aria Martin", service: "Primary bathroom renovation", trade: "Remodeling", amount: 18500, sentDays: 2, activities: [outbound("q016", 1, "email", "Sent fixture allowance breakdown", "Opened")], notes: "Customer is reviewing allowances with their designer." }),
  quote({ id: "q017", customer: "Eli Lee", service: "Ductless system for home office", trade: "HVAC", amount: 4300, sentDays: 13, activities: [outbound("q017", 8, "call", "Discussed condenser placement", "Considering")], notes: "Decision expected after HOA review." }),
  quote({ id: "q018", customer: "Mae Wilson", service: "Backyard drainage and grading", trade: "Landscaping", amount: 7200, sentDays: 16, activities: [outbound("q018", 14, "email", "Sent drainage sketch", "Opened"), outbound("q018", 11, "call", "Left voicemail", "No answer")], notes: "Two touches, then silence." }),
  quote({ id: "q019", customer: "Nina Davis", service: "Kitchen faucet and disposal replacement", trade: "Plumbing", amount: 1600, sentDays: 6, notes: "No follow-up logged yet." }),
  quote({ id: "q020", customer: "Grant Taylor", service: "Detached-garage electrical rough-in", trade: "Electrical", amount: 9900, sentDays: 4, activities: [outbound("q020", 3, "email", "Sent trench requirements", "Opened"), inbound("q020", daysAgo(2.5), "email", "Asked whether the trench can share the utility corridor")], notes: "Technical question is waiting for an answer." }),
  quote({ id: "q021", customer: "Mia Anderson", service: "Cedar shake roof replacement", trade: "Roofing", amount: 35000, sentDays: 9, activities: [outbound("q021", 4, "call", "Reviewed warranty options", "Customer evaluating")], nextFollowUpAt: daysFromNow(2), notes: "High value, but customer gave a specific future date." }),
  quote({ id: "q022", customer: "Sam Thomas", service: "AC compressor repair", trade: "HVAC", amount: 2400, sentDays: 3, activities: [outbound("q022", 2, "text", "Confirmed equipment model", "Seen")], notes: "Normal evaluation window." }),
  quote({ id: "q023", customer: "Alicia Jackson", service: "Basement ejector pump replacement", trade: "Plumbing", amount: 6100, sentDays: 11, activities: [outbound("q023", 6, "email", "Sent alternate pump option", "Opened")], notes: "Follow-up due on the alternate option." }),
  quote({ id: "q024", customer: "Theo Harris", service: "Basement finishing package", trade: "Remodeling", amount: 14600, sentDays: 19, activities: [outbound("q024", 12, "call", "Left voicemail after design review", "Voicemail")], notes: "Budget conversation has gone quiet." }),
  quote({ id: "q025", customer: "Iris Flores", service: "Exterior hose bib repair", trade: "Plumbing", amount: 890, sentDays: 6, activities: [outbound("q025", 1, "text", "Confirmed frost-free fixture availability", "Seen")], notes: "Recent touch; watch for now." }),
  quote({ id: "q026", customer: "Henry Young", service: "Workshop lighting retrofit", trade: "Electrical", amount: 5200, sentDays: 15, activities: [outbound("q026", 9, "email", "Sent lighting layout", "Opened")], notes: "Decision stalled after layout approval." }),
  quote({ id: "q027", customer: "Zoe King", service: "Privacy fence replacement", trade: "Fencing", amount: 7800, sentDays: 2, notes: "Fresh estimate with no engagement yet." }),
  quote({ id: "q028", customer: "Miles Wright", service: "Interior repaint - main floor", trade: "Painting", amount: 3000, sentDays: 7, notes: "No first follow-up recorded." }),
  quote({ id: "q029", customer: "Leah Lopez", service: "Dual-zone heat pump conversion", trade: "HVAC", amount: 19600, sentDays: 22, activities: [outbound("q029", 17, "call", "Reviewed rebate eligibility", "Interested"), inbound("q029", daysAgo(16), "email", "Asked for a rebate link"), outbound("q029", 15, "email", "Sent rebate link and updated total", "Opened")], notes: "Answered the last question, then the lead went quiet." }),
  quote({ id: "q030", customer: "Cole Hill", service: "Main water shutoff replacement", trade: "Plumbing", amount: 4450, sentDays: 10, activities: [outbound("q030", 5, "call", "Discussed access window", "Needs scheduling")], notes: "Follow-up becomes due today." }),
  quote({ id: "q031", customer: "Reese Scott", service: "Patio cover electrical package", trade: "Electrical", amount: 6700, status: "draft", createdDays: 2, notes: "Awaiting final fixture counts before sending." }),
  quote({ id: "q032", customer: "Amara Green", service: "Custom mudroom build", trade: "Remodeling", amount: 15500, status: "draft", createdDays: 1, notes: "Draft scope is under internal review." }),
];

function closedQuote(seed: Seed & { status: "won" | "lost"; closedAt: string }): Quote {
  const sentDays = seed.sentDays ?? 20;
  const first = outbound(seed.id, Math.max(1, sentDays - 3), "call", "Reviewed the estimate", "Spoke with customer");
  const closing = statusActivity(seed.id, seed.closedAt, seed.status === "won" ? "Quote marked won" : `Quote marked lost${seed.lossReason ? ` - ${seed.lossReason}` : ""}`);
  return quote({ ...seed, sentDays, activities: [first, ...(seed.activities ?? []), closing], wonAt: seed.status === "won" ? seed.closedAt : undefined, lostAt: seed.status === "lost" ? seed.closedAt : undefined });
}

const closedQuotes: Quote[] = [
  closedQuote({ id: "q033", customer: "Tessa Baker", service: "Whole-home surge protection", trade: "Electrical", amount: 6800, status: "won", sentDays: 12, closedAt: daysAgo(1), notes: "Deposit received; scheduling is outside QuoteLoop." }),
  closedQuote({ id: "q034", customer: "Ben Nelson", service: "High-efficiency boiler replacement", trade: "HVAC", amount: 14500, status: "won", sentDays: 18, closedAt: daysAgo(5), notes: "Won after a financing review." }),
  closedQuote({ id: "q035", customer: "June Perez", service: "Laundry drain relocation", trade: "Plumbing", amount: 2200, status: "won", sentDays: 14, closedAt: daysAgo(10), notes: "Customer approved the revised scope." }),
  closedQuote({ id: "q036", customer: "Drew Roberts", service: "Historic-home reroof", trade: "Roofing", amount: 31500, status: "won", sentDays: 31, closedAt: daysAgo(15), notes: "Won late last month after preservation approval." }),
  closedQuote({ id: "q037", customer: "Alex Turner", service: "Fence gate rebuild", trade: "Fencing", amount: 980, status: "won", sentDays: 9, closedAt: daysAgo(3), notes: "Quick approval by text." }),
  closedQuote({ id: "q038", customer: "Paige Phillips", service: "Roof ventilation upgrade", trade: "Roofing", amount: 7900, status: "lost", sentDays: 20, closedAt: daysAgo(2), lossReason: "Price", notes: "Customer selected a lower bid." }),
  closedQuote({ id: "q039", customer: "Omar Campbell", service: "Restaurant makeup-air unit", trade: "HVAC", amount: 12400, status: "lost", sentDays: 24, closedAt: daysAgo(6), lossReason: "Competitor", notes: "Incumbent vendor retained the work." }),
  closedQuote({ id: "q040", customer: "Lena Parker", service: "Guest bath refresh", trade: "Remodeling", amount: 3600, status: "lost", sentDays: 16, closedAt: daysAgo(8), lossReason: "Project postponed", notes: "Customer may revisit after the holidays." }),
  closedQuote({ id: "q041", customer: "Isaac Evans", service: "Warehouse LED retrofit", trade: "Electrical", amount: 18200, status: "lost", sentDays: 35, closedAt: daysAgo(18), lossReason: "No response", notes: "Closed after the final attempt and 30 days of silence." }),
  closedQuote({ id: "q042", customer: "Ruby Edwards", service: "Powder-room fixture swap", trade: "Plumbing", amount: 1500, status: "lost", sentDays: 13, closedAt: daysAgo(11), lossReason: "Scope changed", notes: "Customer decided to bundle the work with a remodel." }),
];

export const demoQuotes: Quote[] = [...openQuotes, ...closedQuotes];
function shiftIso(iso: string | undefined, delta: number): string | undefined { return iso ? new Date(Date.parse(iso) + delta).toISOString() : undefined; }
function outcomeCode(raw?: string): import("../domain/types").FollowUpOutcomeCode { const value=(raw??"").toLowerCase(); if(value.includes("voicemail"))return "voicemail_left"; if(value.includes("no response")||value.includes("no answer"))return "no_answer"; if(value.includes("callback")||value.includes("scheduling"))return "callback_requested"; if(value.includes("interest"))return "customer_interested"; if(value.includes("consider")||value.includes("review"))return "still_considering"; if(value.includes("sent")||value.includes("opened")||value.includes("received")||value.includes("seen"))return "message_sent"; return "other"; }
export function freshDemoQuotes(anchor: string = DEMO_NOW): Quote[] {
  const delta=Date.parse(anchor)-Date.parse(DEMO_NOW);
  return structuredClone(demoQuotes).map((quote)=>{
    const shifted: Quote={...quote,createdAt:shiftIso(quote.createdAt,delta)!,sentAt:shiftIso(quote.sentAt,delta),expiresAt:shiftIso(quote.expiresAt,delta),lastCustomerEngagementAt:shiftIso(quote.lastCustomerEngagementAt,delta),lastOutboundFollowUpAt:shiftIso(quote.lastOutboundFollowUpAt,delta),lastInboundResponseAt:shiftIso(quote.lastInboundResponseAt,delta),nextFollowUpAt:shiftIso(quote.nextFollowUpAt,delta),wonAt:shiftIso(quote.wonAt,delta),lostAt:shiftIso(quote.lostAt,delta),activities:quote.activities.map((activity)=>({...activity,quoteId:quote.id,occurredAt:shiftIso(activity.occurredAt,delta)!,kind:activity.direction==="outbound"?"follow_up_attempt":activity.direction==="inbound"?"customer_engagement":"lifecycle",provenance:"demo",outcomeCode:activity.direction==="outbound"?outcomeCode(activity.outcome):undefined,directContact:activity.direction==="outbound"?!["no_answer","voicemail_left","message_sent"].includes(outcomeCode(activity.outcome)):undefined}))};
    if(shifted.id==="q021"&&shifted.nextFollowUpAt)shifted.deferral={until:shifted.nextFollowUpAt,reason:"Customer requested this follow-up date",kind:"scheduled_callback",createdAt:shiftIso(daysAgo(4),delta)!};
    if(shifted.id==="q016"){const until=shiftIso(daysFromNow(30),delta)!;shifted.nextFollowUpAt=until;shifted.deferral={until,reason:"Customer postponed the decision for 30 days",kind:"postponed",createdAt:shiftIso(daysAgo(1),delta)!};}
    if(shifted.id==="q020")shifted.sellerAction={type:"revision_required",createdAt:shiftIso(daysAgo(2.5),delta)!,note:"Clarify trench scope in the estimate"};
    return shifted;
  });
}