import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "./page";

describe("Home page", () => {
  it("renders intro message and send button", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { name: /ai orchestrating counselor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });
});
