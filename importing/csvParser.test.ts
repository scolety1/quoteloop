import { describe, expect, it } from "vitest";
import { parseCsv } from "./csvParser";

describe("CSV parser", () => {
  it("preserves quoted commas, blank cells, CRLF, and embedded newlines", () => {
    const parsed = parseCsv('id,notes,optional\r\n1,"Hello, world",\r\n2,"Line one\nLine two",x\r\n');
    expect(parsed.findings).toEqual([]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].rawValues.notes).toBe("Hello, world");
    expect(parsed.rows[0].rawValues.optional).toBe("");
    expect(parsed.rows[1].rawValues.notes).toBe("Line one\nLine two");
  });

  it("reports malformed quoted CSV instead of hiding it", () => {
    const parsed = parseCsv('id,name\n1,"unclosed value');
    expect(parsed.findings.some((finding) => finding.severity === "error" && finding.code.startsWith("CSV_"))).toBe(true);
  });

  it("rejects an empty file", () => {
    expect(parseCsv(" \n").findings[0].code).toBe("EMPTY_FILE");
  });
});
