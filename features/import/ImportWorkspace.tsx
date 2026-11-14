import { useState, type DragEvent, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Download, FileCheck2, FileSearch, History, Plus, ShieldCheck, UploadCloud, XCircle } from "lucide-react";
import type { ManualQuoteInput } from "../../domain/manualQuote";
import type { Quote, QuoteStatus } from "../../domain/types";
import { buildImportPreview } from "../../importing/importService";
import { fieldLabels } from "../../importing/headerMapping";
import { canonicalFields, type HeaderMapping, type ImportCommitResult, type ImportLedgerEntry, type ImportPreview } from "../../importing/types";
import { formatCurrency, statusLabels } from "../format";

const requiredFields = new Set(["customerName", "serviceDescription", "amount", "createdDate", "status"]);
const actionLabels = {
  create: "New",
  update: "Update",
  skip_duplicate: "Duplicate",
  needs_review: "Review",
  rejected: "Rejected",
} as const;

export function ImportWorkspace({ quotes, history, now, onCommit, onManualCreate }: {
  quotes: Quote[];
  history: ImportLedgerEntry[];
  now: string;
  onCommit: (preview: ImportPreview, includedRows: ReadonlySet<number>) => Promise<ImportCommitResult>;
  onManualCreate: (input: ManualQuoteInput) => Promise<void>;
}) {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [includedRows, setIncludedRows] = useState<Set<number>>(new Set());
  const [completion, setCompletion] = useState<ImportCommitResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [fileError, setFileError] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualError, setManualError] = useState("");

  function setFromPreview(next: ImportPreview) {
    setPreview(next);
    setIncludedRows(new Set(next.rows.filter((row) => row.includedByDefault).map((row) => row.sourceRow)));
    setCompletion(null);
  }

  async function loadFile(file?: File) {
    if (!file) return;
    setFileError("");
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setFileError("Choose a .csv file. No data was changed.");
      return;
    }
    try {
      const text = await file.text();
      setCsvText(text);
      setFromPreview(buildImportPreview({ csvText: text, filename: file.name, existingQuotes: quotes, importedAt: now }));
    } catch {
      setFileError("QuoteLoop could not read this file. No data was changed.");
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    void loadFile(event.dataTransfer.files[0]);
  }

  function changeMapping(field: keyof HeaderMapping, header: string) {
    if (!preview) return;
    const mappingOverrides: HeaderMapping = { ...preview.mapping, [field]: header || undefined };
    setFromPreview(buildImportPreview({ csvText, filename: preview.filename, existingQuotes: quotes, importedAt: preview.createdAt, mappingOverrides }));
  }

  function toggleRow(rowNumber: number) {
    setIncludedRows((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber); else next.add(rowNumber);
      return next;
    });
  }

  async function commit() {
    if (!preview || includedRows.size === 0) return;
    setIsCommitting(true);
    try {
      const result = await onCommit(preview, includedRows);
      setCompletion(result);
      setIncludedRows(new Set());
    } finally {
      setIsCommitting(false);
    }
  }

  function clearPreview() {
    setCsvText("");
    setPreview(null);
    setIncludedRows(new Set());
    setCompletion(null);
    setFileError("");
  }

  async function createManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setManualError("");
    const data = new FormData(event.currentTarget);
    const status = String(data.get("status")) as QuoteStatus;
    const dateIso = (name: string) => {
      const value = String(data.get(name) ?? "");
      return value ? `${value}T15:00:00.000Z` : undefined;
    };
    try {
      await onManualCreate({
        customerName: String(data.get("customerName") ?? ""),
        serviceDescription: String(data.get("serviceDescription") ?? ""),
        amount: Number(data.get("amount")),
        createdAt: dateIso("createdAt") ?? "",
        sentAt: dateIso("sentAt"),
        status,
        trade: String(data.get("trade") ?? ""),
        notes: String(data.get("notes") ?? ""),
      });
      event.currentTarget.reset();
      setShowManual(false);
    } catch (error) {
      setManualError(error instanceof Error ? error.message : "The quote could not be created.");
    }
  }

  const acceptedCount = preview?.rows.filter((row) => includedRows.has(row.sourceRow) && (row.action === "create" || row.action === "update")).length ?? 0;

  return (
    <section className="import-workspace">
      <div className="import-toolbar">
        <div><span className="eyebrow">Safe ingestion</span><h2>Bring real quotes into the loop</h2><p>Parse and inspect everything locally. Nothing reaches your quote register until you confirm the preview.</p></div>
        <button className="button button--secondary" type="button" onClick={() => setShowManual((value) => !value)}><Plus size={16} /> Add quote manually</button>
      </div>

      {showManual && (
        <form className="manual-quote-form" onSubmit={createManual}>
          <div className="manual-form-heading"><div><span className="eyebrow">Manual entry</span><h3>One quote, same canonical model</h3></div><button className="icon-button" type="button" onClick={() => setShowManual(false)} aria-label="Close manual quote form"><XCircle size={18} /></button></div>
          <div className="manual-form-grid">
            <label className="field-label">Customer<input name="customerName" required /></label>
            <label className="field-label">Description<input name="serviceDescription" required /></label>
            <label className="field-label">Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label>
            <label className="field-label">Trade<input name="trade" placeholder="General" /></label>
            <label className="field-label">Created date<input name="createdAt" type="date" defaultValue={now.slice(0, 10)} required /></label>
            <label className="field-label">Sent date<input name="sentAt" type="date" defaultValue={now.slice(0, 10)} /></label>
            <label className="field-label">Lifecycle<select name="status" defaultValue="sent">{(["draft", "sent", "engaged", "won", "lost", "expired"] as QuoteStatus[]).map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></label>
            <label className="field-label manual-notes">Notes<input name="notes" /></label>
          </div>
          {manualError && <div className="import-alert import-alert--error"><AlertTriangle size={16} />{manualError}</div>}
          <div className="manual-form-actions"><button className="button button--primary" type="submit"><Plus size={16} /> Create quote</button><span>Saved locally and prioritized immediately.</span></div>
        </form>
      )}

      {!preview ? (
        <div className="import-start-grid">
          <label className={`file-dropzone ${isDragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
            <input type="file" accept=".csv,text/csv" onChange={(event) => { void loadFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
            <span className="dropzone-icon"><UploadCloud size={25} /></span>
            <strong>Drop a CSV here or choose a file</strong>
            <small>Parsed in this browser. Uploading alone never changes your quotes.</small>
            <span className="button button--primary">Choose CSV</span>
          </label>
          <aside className="format-card">
            <div className="format-card-icon"><FileCheck2 size={20} /></div>
            <span className="eyebrow">QuoteLoop standard CSV</span>
            <h3>Start with a known-good shape</h3>
            <p>Customer, description, amount, created date, and status are the core fields. Common export aliases are detected automatically.</p>
            <a className="button button--secondary" href="/samples/A-clean-standard.csv" download><Download size={15} /> Download example CSV</a>
          </aside>
        </div>
      ) : (
        <>
          <div className="preview-banner">
            <div className="preview-file"><FileSearch size={19} /><span><strong>{preview.filename}</strong><small>{preview.summary.rowsDetected} data rows detected / preview only</small></span></div>
            <div className="preview-safety"><ShieldCheck size={18} /><span><strong>No repository changes yet</strong><small>Only checked rows marked New or Update can be committed.</small></span></div>
            <button className="button button--ghost" type="button" onClick={clearPreview}>Choose another file</button>
          </div>

          {preview.fileFindings.length > 0 && <div className="file-findings" role="alert">{preview.fileFindings.map((finding, index) => <div key={`${finding.code}-${index}`}><AlertTriangle size={15} /><span><strong>{finding.code.replaceAll("_", " ")}</strong>{finding.message}</span></div>)}</div>}

          <details className="mapping-panel" open={preview.detection.ambiguities.length > 0 || preview.detection.missingRequired.length > 0}>
            <summary><span><strong>Column mapping</strong><small>{Object.values(preview.mapping).filter(Boolean).length} fields recognized / {preview.detection.unmappedHeaders.length} ignored</small></span><span>{preview.detection.ambiguities.length ? `${preview.detection.ambiguities.length} ambiguous` : "Review mapping"}</span></summary>
            <p>Each source column can be mapped explicitly. Required fields are marked with an asterisk; ambiguous matches remain unselected.</p>
            <div className="mapping-grid">
              {canonicalFields.map((field) => <label key={field}><span>{fieldLabels[field]}{requiredFields.has(field) ? " *" : ""}</span><select aria-label={`Map ${fieldLabels[field]}`} value={preview.mapping[field] ?? ""} onChange={(event) => changeMapping(field, event.target.value)}><option value="">Not mapped</option>{preview.headers.map((header) => <option value={header} key={header}>{header}</option>)}</select></label>)}
            </div>
          </details>

          <div className="preview-summary" aria-label="Import preview summary">
            <div><span>Rows detected</span><strong>{preview.summary.rowsDetected}</strong></div>
            <div className="summary-ready"><span>New</span><strong>{preview.summary.readyToCreate}</strong></div>
            <div className="summary-update"><span>Updates</span><strong>{preview.summary.updates}</strong></div>
            <div><span>Duplicates skipped</span><strong>{preview.summary.duplicatesSkipped}</strong></div>
            <div className="summary-review"><span>Needs review</span><strong>{preview.summary.needsReview}</strong></div>
            <div className="summary-rejected"><span>Rejected</span><strong>{preview.summary.rejected}</strong></div>
          </div>
          <div className="financial-preview">
            <div><span>This file contains</span><strong>{formatCurrency(preview.summary.fileQuotedTotal)}</strong><small>All parseable quoted amounts, including duplicate and rejected rows.</small></div>
            <div><span>New pending revenue to add</span><strong>{formatCurrency(preview.summary.newPendingRevenue)}</strong><small>Only new checked sent or engaged quotes. Updates are not presented as new revenue.</small></div>
          </div>

          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead><tr><th>Use</th><th>Row</th><th>Customer / job</th><th>Source status</th><th>Amount</th><th>Decision</th><th>Quality evidence</th></tr></thead>
              <tbody>{preview.rows.map((row) => {
                const selectable = row.action === "create" || row.action === "update";
                return <tr key={row.sourceRow} className={`preview-row--${row.action}`}>
                  <td><input type="checkbox" aria-label={`Include source row ${row.sourceRow}`} checked={includedRows.has(row.sourceRow)} disabled={!selectable || Boolean(completion)} onChange={() => toggleRow(row.sourceRow)} /></td>
                  <td>{row.sourceRow}</td>
                  <td><strong>{row.values.customerName || "Missing customer"}</strong><span>{row.values.serviceDescription || "Missing description"}</span></td>
                  <td>{row.values.status || "Blank"}</td>
                  <td>{parseFloat(row.values.amount.replace(/[$,]/g, "")) > 0 ? formatCurrency(parseFloat(row.values.amount.replace(/[$,]/g, ""))) : "Invalid"}</td>
                  <td><span className={`import-action import-action--${row.action}`}>{actionLabels[row.action]}</span></td>
                  <td><div className="finding-list">{row.findings.length ? row.findings.map((finding, index) => <span className={`finding finding--${finding.severity}`} key={`${finding.code}-${index}`} title={finding.message}><b>{finding.code.replaceAll("_", " ")}</b>{finding.message}</span>) : <span className="finding finding--clear"><CheckCircle2 size={12} /> Validated</span>}</div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>

          <div className="commit-bar">
            <div><strong>{acceptedCount} row{acceptedCount === 1 ? "" : "s"} will be imported</strong><span>Review and rejected rows stay out. Duplicate rows are always skipped.</span></div>
            <button className="button button--primary" type="button" disabled={acceptedCount === 0 || isCommitting || Boolean(completion)} onClick={() => void commit()}><ShieldCheck size={16} />{isCommitting ? "Importing..." : "Confirm import"}</button>
          </div>
          {completion && <div className="completion-card" role="status"><CheckCircle2 size={21} /><div><strong>Import complete</strong><p>{completion.ledgerEntry.createdCount} created, {completion.ledgerEntry.updatedCount} updated, {completion.ledgerEntry.skippedDuplicateCount} duplicate{completion.ledgerEntry.skippedDuplicateCount === 1 ? "" : "s"} skipped. Dashboard and priorities now use the committed quotes.</p></div><button className="button button--secondary" type="button" onClick={clearPreview}>Import another file</button></div>}
        </>
      )}
      {fileError && <div className="import-alert import-alert--error" role="alert"><AlertTriangle size={16} />{fileError}</div>}

      <section className="import-history">
        <div className="section-heading"><div><span className="eyebrow">Local audit trail</span><h2>Recent imports</h2></div><p>Stored on this device and cleared by Reset data.</p></div>
        {history.length ? <div className="history-list">{history.map((entry) => <div key={entry.id}><History size={17} /><span><strong>{entry.filename}</strong><small>{new Date(entry.importedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} / {entry.rowCount} rows</small></span><dl><div><dt>Created</dt><dd>{entry.createdCount}</dd></div><div><dt>Updated</dt><dd>{entry.updatedCount}</dd></div><div><dt>Duplicates</dt><dd>{entry.skippedDuplicateCount}</dd></div><div><dt>Review / rejected</dt><dd>{entry.reviewCount + entry.rejectedCount}</dd></div></dl><code>{entry.id}</code></div>)}</div> : <div className="empty-history"><History size={22} /><strong>No imports yet</strong><span>Confirmed CSV imports will appear here.</span></div>}
      </section>
    </section>
  );
}
