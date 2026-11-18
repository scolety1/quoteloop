import { describe, expect, it } from "vitest";
import { parseCsv } from "./csvParser";

describe("CSV parser", () => {
  it("keeps every value when duplicate suffixes collide with existing headers", () => {
    const parsed = parseCsv('Name,Name,Name (2),name (2),\nfirst,second,third,fourth,fifth');
    expect(new Set(parsed.headers.map((name) => name.toLowerCase())).size).toBe(5);
    expect(parsed.headers.map((name) => parsed.rows[0].rawValues[name])).toEqual(['first','second','third','fourth','fifth']);
  });

  it("preserves prototype-named CSV columns as own data properties", () => {
    const parsed = parseCsv('__proto__,constructor,toString\nfirst,second,third');
    expect(Object.hasOwn(parsed.rows[0].rawValues, '__proto__')).toBe(true);
    expect(parsed.headers.map((name) => parsed.rows[0].rawValues[name])).toEqual(['first','second','third']);
    expect(Object.getPrototypeOf(parsed.rows[0].rawValues)).toBe(Object.prototype);
  });
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
