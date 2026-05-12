import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "./page";

describe("Home page", () => {
  it("renders intro message and send button", () => {
    render(<Page />);
    expect(screen.getByText(/Hello! I am your/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });
});
