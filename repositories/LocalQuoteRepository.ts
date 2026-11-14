import { SystemClock, type Clock } from "../domain/clock";
import { freshDemoQuotes } from "../fixtures/demoQuotes";
import type { ImportLedgerEntry } from "../importing/types";
import type { QuoteRepository } from "./QuoteRepository";
import type { Quote } from "../domain/types";
import { migratePersistedState, type PersistedStateV3 } from "./migration";
export const QUOTELOOP_STORAGE_KEY="quoteloop-demo-v1";
export const QUOTELOOP_IMPORT_HISTORY_KEY="quoteloop-import-history-v1";
export const QUOTELOOP_V3_STORAGE_KEY="quoteloop-state-v3";
export const QUOTELOOP_CORRUPT_STORAGE_KEY="quoteloop-state-v3-corrupt";
export class LocalQuoteRepository implements QuoteRepository{
  constructor(private readonly clock:Clock=new SystemClock()){}
  private fallback(){return freshDemoQuotes(this.clock.now());}
  private read():PersistedStateV3{if(typeof window==="undefined")return {version:3,quotes:this.fallback(),imports:[]};const current=window.localStorage.getItem(QUOTELOOP_V3_STORAGE_KEY);if(current){try{const parsed=JSON.parse(current);if(parsed?.version!==3||!Array.isArray(parsed.quotes))throw new Error("Unsupported QuoteLoop storage schema");}catch(error){window.localStorage.setItem(QUOTELOOP_CORRUPT_STORAGE_KEY,current);window.localStorage.removeItem(QUOTELOOP_V3_STORAGE_KEY);console.error("QuoteLoop quarantined invalid persisted state; business data was not interpreted.",error);}}const validCurrent=window.localStorage.getItem(QUOTELOOP_V3_STORAGE_KEY);const legacy=validCurrent??window.localStorage.getItem(QUOTELOOP_STORAGE_KEY);const state=migratePersistedState(legacy,window.localStorage.getItem(QUOTELOOP_IMPORT_HISTORY_KEY),this.fallback());if(!validCurrent)this.write(state);return state;}
  private write(state:PersistedStateV3){if(typeof window!=="undefined"){window.localStorage.setItem(QUOTELOOP_V3_STORAGE_KEY,JSON.stringify(state));window.localStorage.removeItem(QUOTELOOP_STORAGE_KEY);window.localStorage.removeItem(QUOTELOOP_IMPORT_HISTORY_KEY);}}
  async list():Promise<Quote[]>{return this.read().quotes;}
  async save(quotes:Quote[]):Promise<void>{const state=this.read();this.write({...state,quotes});}
  async listImports():Promise<ImportLedgerEntry[]>{return this.read().imports;}
  async saveImport(entry:ImportLedgerEntry):Promise<void>{const state=this.read();this.write({...state,imports:[entry,...state.imports.filter(x=>x.id!==entry.id)].slice(0,20)});}
  async reset():Promise<Quote[]>{const quotes=this.fallback();this.write({version:3,quotes,imports:[]});return quotes;}
}