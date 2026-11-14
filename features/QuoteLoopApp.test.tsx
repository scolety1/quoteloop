import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuoteLoopApp } from "./QuoteLoopApp";

describe("QuoteLoop central workflow", () => {
  it("opens a prioritized quote, explains it, logs a follow-up, and removes answered urgency", async () => {
    render(<QuoteLoopApp />);
    expect(screen.getByText("Revenue that needs attention")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open quote for Maya Johnson" }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Customer replied 9 hours ago")).toBeInTheDocument();
    expect(within(drawer).getByText("No follow-up since customer response")).toBeInTheDocument();
    expect(within(drawer).getByText("Call customer today")).toBeInTheDocument();
    fireEvent.change(within(drawer).getByPlaceholderText("What happened? Keep it short and useful."), { target: { value: "Confirmed installation availability" } });
    fireEvent.click(within(drawer).getByRole("button", { name: /Log follow-up/ }));
    await waitFor(() => {
      expect(within(screen.getByRole("dialog")).queryByText("No follow-up since customer response")).not.toBeInTheDocument();
      expect(within(screen.getByRole("dialog")).getByText("Confirmed installation availability")).toBeInTheDocument();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Follow-up logged");
  });

  it("marks an active quote won, updates metrics, and removes it from active lanes", async () => {
    render(<QuoteLoopApp />);
    const pendingBefore = screen.getByText("Pending revenue").parentElement?.querySelector("strong")?.textContent;
    fireEvent.click(screen.getByRole("button", { name: "Open quote for Erin Thompson" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Mark won/ }));
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("No active follow-up")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Open quote for Erin Thompson" })).not.toBeInTheDocument();
    const pendingAfter = screen.getByText("Pending revenue").parentElement?.querySelector("strong")?.textContent;
    expect(pendingAfter).not.toBe(pendingBefore);
    expect(screen.getByRole("status")).toHaveTextContent("Quote marked won");
  });

  it("searches the complete quote register", () => {
    render(<QuoteLoopApp />);
    fireEvent.click(screen.getByRole("button", { name: /All quotes/ }));
    fireEvent.change(screen.getByPlaceholderText("Search customer or service..."), { target: { value: "Maya Johnson" } });
    expect(screen.getByRole("button", { name: /Maya Johnson/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Erin Thompson/ })).not.toBeInTheDocument();
    expect(screen.getByText("1 of 42 quotes shown")).toBeInTheDocument();
  });
});