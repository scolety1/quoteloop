const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const BUSINESS_HOUR_UTC = 15;

export function hoursBetween(earlier: string, later: string): number { return Math.max(0, (Date.parse(later) - Date.parse(earlier)) / HOUR_MS); }
export function signedHoursBetween(earlier: string, later: string): number { return (Date.parse(later) - Date.parse(earlier)) / HOUR_MS; }
export function daysBetween(earlier: string, later: string): number { return hoursBetween(earlier, later) / 24; }
export function daysUntil(future: string, now: string): number { return (Date.parse(future) - Date.parse(now)) / DAY_MS; }
export function utcDayKey(iso: string): string { return iso.slice(0, 10); }
export function compareUtcDays(left: string, right: string): number { return utcDayKey(left).localeCompare(utcDayKey(right)); }
export function isSameUtcDay(left: string, right: string): boolean { return utcDayKey(left) === utcDayKey(right); }
export function startOfUtcDay(iso: string): string { return `${utcDayKey(iso)}T00:00:00.000Z`; }
export function atBusinessHour(date: string): string { return `${date.slice(0,10)}T${String(BUSINESS_HOUR_UTC).padStart(2,"0")}:00:00.000Z`; }
export function addUtcDays(iso: string, days: number): string { const date=new Date(iso); date.setUTCDate(date.getUTCDate()+days); return date.toISOString(); }
export function startOfMonthIso(now: string): string { const date=new Date(now); return new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1)).toISOString(); }
export function formatRelativeTime(iso: string, now: string): string { const hours=hoursBetween(iso,now); if(hours<1)return "less than an hour ago"; if(hours<24)return `${Math.floor(hours)} ${Math.floor(hours)===1?"hour":"hours"} ago`; const days=Math.floor(hours/24); return `${days} ${days===1?"day":"days"} ago`; }
export function formatShortDate(iso?: string): string { if(!iso)return "Not set"; return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(iso)); }
export function toDateInput(iso?: string): string { return iso ? iso.slice(0,10) : ""; }