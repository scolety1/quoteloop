import Papa from "papaparse";
import type { ImportFinding, ParsedCsv } from "./types";

function uniqueHeaders(source: string[]): string[] {
  const used = new Set<string>();
  return source.map((value, index) => {
    const base = value.replace(/^\uFEFF/, "").trim() || `Column ${index + 1}`;
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) candidate = `${base} (${suffix++})`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

export function parseCsv(text: string): ParsedCsv {
  if (!text.trim()) {
    return {
      headers: [],
      rows: [],
      findings: [{ code: "EMPTY_FILE", severity: "error", message: "The CSV file is empty.", rowNumber: 1 }],
    };
  }

  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: "greedy",
  });
  const data = result.data;
  const headers = uniqueHeaders(data[0] ?? []);
  const findings: ImportFinding[] = result.errors.map((error) => ({
    code: `CSV_${error.code.toUpperCase()}`,
    severity: "error",
    message: error.message,
    rowNumber: Math.max(1, (error.row ?? 0) + 1),
  }));

  if (headers.length === 0) {
    findings.push({ code: "MISSING_HEADER_ROW", severity: "error", message: "A header row is required.", rowNumber: 1 });
  }

  const rows = data.slice(1).map((cells, index) => {
    const rawValues: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      // CSV headers are data, including names such as __proto__.
      Object.defineProperty(rawValues, header, {
        value: String(cells[columnIndex] ?? ""), enumerable: true, writable: true, configurable: true,
      });
    });
    if (cells.length > headers.length) {
      findings.push({
        code: "CSV_EXTRA_COLUMNS",
        severity: "error",
        message: `Row has ${cells.length - headers.length} value(s) without a header.`,
        rowNumber: index + 2,
      });
    }
    return { rowNumber: index + 2, rawValues };
  });

  return { headers, rows, findings };
}
