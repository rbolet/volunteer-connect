import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ClaimCell, type ClaimCellProps } from "../claim-cell"

const { claimSlot, withdrawResponse } = vi.hoisted(() => ({
  claimSlot: vi.fn(),
  withdrawResponse: vi.fn(),
}))
vi.mock("../../../../actions", () => ({ claimSlot, withdrawResponse }))

function props(overrides: Partial<ClaimCellProps> = {}): ClaimCellProps {
  return {
    slotId: "slot_1",
    signupOpen: true,
    eligible: true,
    seatsLeft: 1,
    myResponse: null,
    myTeams: [{ id: "team_eagles", name: "Eagles" }],
    ...overrides,
  }
}

beforeEach(() => {
  claimSlot.mockReset().mockResolvedValue({ ok: true })
  withdrawResponse.mockReset().mockResolvedValue({ ok: true })
})

describe("ClaimCell", () => {
  it("claims for the user's team on click", async () => {
    const user = userEvent.setup()
    render(<ClaimCell {...props()} />)
    await user.click(screen.getByRole("button", { name: "Claim" }))
    expect(claimSlot).toHaveBeenCalledWith("slot_1", "team_eagles")
  })

  it("offers a team picker only when the user has multiple teams", async () => {
    const user = userEvent.setup()
    render(
      <ClaimCell
        {...props({
          myTeams: [
            { id: "team_eagles", name: "Eagles" },
            { id: "team_sharks", name: "Sharks" },
          ],
        })}
      />
    )
    const picker = screen.getByRole("combobox", { name: /team to credit/i })
    await user.selectOptions(picker, "team_sharks")
    await user.click(screen.getByRole("button", { name: "Claim" }))
    expect(claimSlot).toHaveBeenCalledWith("slot_1", "team_sharks")
  })

  it("hides the picker for a single team", () => {
    render(<ClaimCell {...props()} />)
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })

  it("claims with the current teams even when mounted with none (identity switch)", async () => {
    // Regression: the demo identity switcher swaps the session without
    // remounting — a cell first mounted for a team-less admin must not claim
    // with a stale empty team once a volunteer's teams arrive via props.
    const user = userEvent.setup()
    const { rerender } = render(<ClaimCell {...props({ myTeams: [] })} />)
    rerender(<ClaimCell {...props({ myTeams: [{ id: "team_eagles", name: "Eagles" }] })} />)
    await user.click(screen.getByRole("button", { name: "Claim" }))
    expect(claimSlot).toHaveBeenCalledWith("slot_1", "team_eagles")
  })

  it("shows an error message when the claim is rejected", async () => {
    claimSlot.mockResolvedValue({ ok: false, error: "slot_full" })
    const user = userEvent.setup()
    render(<ClaimCell {...props()} />)
    await user.click(screen.getByRole("button", { name: "Claim" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("This slot just filled up.")
  })

  it("offers withdraw for an own pending claim while open", async () => {
    const user = userEvent.setup()
    render(<ClaimCell {...props({ myResponse: { id: "resp_1", status: "pending" } })} />)
    await user.click(screen.getByRole("button", { name: "Withdraw" }))
    expect(withdrawResponse).toHaveBeenCalledWith("resp_1")
  })

  it("marks a locked-in own claim as Yours without a withdraw button", () => {
    render(
      <ClaimCell
        {...props({ signupOpen: false, myResponse: { id: "resp_1", status: "completed" } })}
      />
    )
    expect(screen.getByText("Yours")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("renders Full when no seats remain", () => {
    render(<ClaimCell {...props({ seatsLeft: 0 })} />)
    expect(screen.getByText("Full")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("renders Not eligible for ineligible roles", () => {
    render(<ClaimCell {...props({ eligible: false })} />)
    expect(screen.getByText("Not eligible")).toBeInTheDocument()
  })

  it("renders no actions on a closed signup", () => {
    render(<ClaimCell {...props({ signupOpen: false })} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("has no axe violations in the claimable state", async () => {
    const { container } = render(
      <ClaimCell
        {...props({
          myTeams: [
            { id: "team_eagles", name: "Eagles" },
            { id: "team_sharks", name: "Sharks" },
          ],
        })}
      />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
