import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AdminStatusControls, type AdminStatusControlsProps } from "../admin-status-controls"

const { changeSignupStatus } = vi.hoisted(() => ({ changeSignupStatus: vi.fn() }))
vi.mock("../../../../actions", () => ({ changeSignupStatus }))

function props(overrides: Partial<AdminStatusControlsProps> = {}): AdminStatusControlsProps {
  return {
    signupId: "signup_1",
    status: "closed",
    awardSummary: {
      total: 5,
      perTeam: [
        { teamName: "Eagles", points: 3 },
        { teamName: "Thunder", points: 2 },
      ],
    },
    ...overrides,
  }
}

beforeEach(() => {
  changeSignupStatus.mockReset().mockResolvedValue({ ok: true })
})

describe("AdminStatusControls", () => {
  it("offers Open on drafts", async () => {
    const user = userEvent.setup()
    render(<AdminStatusControls {...props({ status: "draft" })} />)
    await user.click(screen.getByRole("button", { name: "Open signup" }))
    expect(changeSignupStatus).toHaveBeenCalledWith("signup_1", "open")
  })

  it("offers Close on open signups", async () => {
    const user = userEvent.setup()
    render(<AdminStatusControls {...props({ status: "open" })} />)
    await user.click(screen.getByRole("button", { name: "Close signup" }))
    expect(changeSignupStatus).toHaveBeenCalledWith("signup_1", "closed")
  })

  it("finalize requires an explicit confirm showing the award breakdown", async () => {
    const user = userEvent.setup()
    render(<AdminStatusControls {...props()} />)
    await user.click(screen.getByRole("button", { name: /finalize & award points/i }))
    expect(changeSignupStatus).not.toHaveBeenCalled()
    expect(screen.getByText(/Award 5 pts \(Eagles \+3, Thunder \+2\)\?/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Confirm" }))
    expect(changeSignupStatus).toHaveBeenCalledWith("signup_1", "finalized")
  })

  it("finalize can be cancelled", async () => {
    const user = userEvent.setup()
    render(<AdminStatusControls {...props()} />)
    await user.click(screen.getByRole("button", { name: /finalize & award points/i }))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(changeSignupStatus).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument()
  })

  it("offers Reopen on closed signups", async () => {
    const user = userEvent.setup()
    render(<AdminStatusControls {...props()} />)
    await user.click(screen.getByRole("button", { name: "Reopen" }))
    expect(changeSignupStatus).toHaveBeenCalledWith("signup_1", "open")
  })

  it("renders no actions once finalized", () => {
    render(<AdminStatusControls {...props({ status: "finalized" })} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.getByText(/points awarded/i)).toBeInTheDocument()
  })

  it("surfaces rejection errors", async () => {
    changeSignupStatus.mockResolvedValue({ ok: false, error: "invalid_transition" })
    const user = userEvent.setup()
    render(<AdminStatusControls {...props({ status: "open" })} />)
    await user.click(screen.getByRole("button", { name: "Close signup" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't allowed anymore/)
  })

  it("has no axe violations in the confirm state", async () => {
    const user = userEvent.setup()
    const { container } = render(<AdminStatusControls {...props()} />)
    await user.click(screen.getByRole("button", { name: /finalize & award points/i }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
