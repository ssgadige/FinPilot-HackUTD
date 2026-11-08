import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PatternForm } from "../../src/app/ui/pattern-form";

describe("shared form interactions", () => {
  it("associates actionable validation with the field, moves focus, and preserves entered values", async () => {
    const user = userEvent.setup();
    render(<PatternForm />);
    const amount = screen.getByLabelText("Amount (USD)");
    await user.type(amount, "-5");
    await user.click(screen.getByRole("button", { name: "Validate example" }));
    expect(amount).toHaveFocus();
    expect(amount).toHaveValue("-5");
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(amount).toHaveAccessibleDescription(/positive USD amount/);
    await user.clear(amount);
    await user.type(amount, "120.25");
    await user.click(screen.getByRole("button", { name: "Validate example" }));
    expect(screen.getByRole("status")).toHaveTextContent("Nothing was saved");
    expect(amount).not.toHaveAttribute("aria-invalid");
    expect(amount).toHaveValue("120.25");
  });

  it("preserves input through the recoverable error example", async () => {
    const user = userEvent.setup();
    render(<PatternForm />);
    await user.type(screen.getByLabelText("Amount (USD)"), "42");
    await user.click(
      screen.getByRole("button", { name: "Show error example" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "intentional UI example",
    );
    await user.click(
      screen.getByRole("button", { name: "Dismiss error example" }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Amount (USD)")).toHaveValue("42");
  });
});
