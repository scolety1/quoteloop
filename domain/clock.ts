export interface Clock { now(): string; }
export class SystemClock implements Clock { now(): string { return new Date().toISOString(); } }
export class FixedClock implements Clock { constructor(private readonly instant: string) {} now(): string { return this.instant; } }
export function clockId(clock: Clock): string { return clock.now().replace(/\D/g, ""); }