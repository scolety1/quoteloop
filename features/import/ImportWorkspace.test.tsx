import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuoteLoopApp } from "../QuoteLoopApp";

const oneQuoteCsv = `quote_id,customer_name,job_description,quoted_amount,created_date,sent_date,expiration_date,status,notes,source,source_id,trade
UI-1,Test Import Customer,Generator inspection,"$6,400",2026-08-01,2026-08-02,2026-09-02,sent,Imported in UI test,UI Test Source,UI-1,Electrical`;

function csvFile(name = "ui-import.csv") {
  const file = new File([oneQuoteCsv], name, { type: "text/csv" });
  Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue(oneQuoteCsv) });
  return file;
}

async function chooseCsv(file = csvFile()) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  fireEvent.change(input!, { target: { files: [file] } });
  await screen.findByText("No repository changes yet");
}

describe("QuoteLoop import UI", () => {
  it("previews before mutation, commits once, and exposes provenance", async () => {
    render(<QuoteLoopApp />);
    fireEvent.click(screen.getByRole("button", { name: /Import/ }));
    await chooseCsv();

    expect(screen.getByRole("button", { name: /All quotes/ })).toHaveTextContent("42");
    expect(screen.getByText("This file contains").parentElement).toHaveTextContent("$6,400");
    expect(screen.getByText("New pending revenue to add").parentElement).toHaveTextContent("$6,400");
    fireEvent.click(screen.getByRole("button", { name: "Confirm import" }));
    await screen.findByText("Import complete");
    expect(screen.getByRole("button", { name: /All quotes/ })).toHaveTextContent("43");
    expect(screen.getByText("ui-import.csv", { selector: ".history-list strong" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /All quotes/ }));
    fireEvent.change(screen.getByPlaceholderText("Search customer or service..."), { target: { value: "Test Import Customer" } });
    fireEvent.click(screen.getByRole("button", { name: /Test Import Customer/ }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Source provenance")).toBeInTheDocument();
    expect(within(drawer).getByText("ui-import.csv")).toBeInTheDocument();
    expect(within(drawer).getAllByText("UI Test Source").length).toBeGreaterThan(0);
  });

  it("shows an identical re-import as a skipped duplicate with no commit selection", async () => {
    render(<QuoteLoopApp />);
    fireEvent.click(screen.getByRole("button", { name: /Import/ }));
    await chooseCsv();
    fireEvent.click(screen.getByRole("button", { name: "Confirm import" }));
    await screen.findByText("Import complete");
    fireEvent.click(screen.getByRole("button", { name: "Import another file" }));
    await chooseCsv();
    await waitFor(() => expect(screen.getByText("Duplicates skipped").parentElement).toHaveTextContent("1"));
    expect(screen.getByRole("button", { name: "Confirm import" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /All quotes/ })).toHaveTextContent("43");
  });

  it("creates a manual quote in the same register", async () => {
    render(<QuoteLoopApp />);
    fireEvent.click(screen.getByRole("button", { name: /Import/ }));
    fireEvent.click(screen.getByRole("button", { name: /Add quote manually/ }));
    fireEvent.change(screen.getByLabelText("Customer"), { target: { value: "Manual Test Customer" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Service panel" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "3500" } });
    fireEvent.click(screen.getByRole("button", { name: "Create quote" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /All quotes/ })).toHaveTextContent("43"));
    fireEvent.click(screen.getByRole("button", { name: /All quotes/ }));
    fireEvent.change(screen.getByPlaceholderText("Search customer or service..."), { target: { value: "Manual Test Customer" } });
    expect(screen.getByRole("button", { name: /Manual Test Customer/ })).toBeInTheDocument();
  });
});
