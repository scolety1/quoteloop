import type { Quote } from "../domain/types";
import type { ImportLedgerEntry } from "../importing/types";

export interface QuoteRepository {
  list(): Promise<Quote[]>;
  save(quotes: Quote[]): Promise<void>;
  listImports(): Promise<ImportLedgerEntry[]>;
  saveImport(entry: ImportLedgerEntry): Promise<void>;
  reset(): Promise<Quote[]>;
}
