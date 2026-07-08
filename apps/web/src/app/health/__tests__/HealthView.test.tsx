import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { HealthView } from "../HealthView"

describe("HealthView", () => {
  it("renders the Don't Panic heading", () => {
    render(<HealthView health={{ status: "ok" }} />)
    expect(
      screen.getByRole("heading", { name: /don't panic/i })
    ).toBeInTheDocument()
  })

  it("shows green status and timestamp when API is ok", () => {
    render(
      <HealthView
        health={{ status: "ok", timestamp: "2026-07-07T00:00:00.000Z" }}
      />
    )
    const status = screen.getByText(/api: ok/i, { selector: "p" })
    expect(status).toBeInTheDocument()
    expect(status).toHaveClass("text-green-400")
    expect(screen.getByText("2026-07-07T00:00:00.000Z")).toBeInTheDocument()
  })

  it("shows red status when API is unreachable", () => {
    render(<HealthView health={{ status: "unreachable" }} />)
    const status = screen.getByText(/api: unreachable/i, { selector: "p" })
    expect(status).toBeInTheDocument()
    expect(status).toHaveClass("text-red-400")
  })
})
