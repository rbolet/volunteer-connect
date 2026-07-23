import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SlotEditor, type EditableSlot } from "../slot-editor"

const { addSlot, updateSlot, deleteSlot } = vi.hoisted(() => ({
  addSlot: vi.fn(),
  updateSlot: vi.fn(),
  deleteSlot: vi.fn(),
}))
vi.mock("@/features/signups/actions", () => ({ addSlot, updateSlot, deleteSlot }))

const freeSlot: EditableSlot = {
  id: "slot_free",
  label: "Morning shift",
  pointValue: 1,
  capacity: 2,
  claimedCount: 0,
}
const claimedSlot: EditableSlot = {
  id: "slot_claimed",
  label: "Afternoon shift",
  pointValue: 2,
  capacity: 2,
  claimedCount: 1,
}

beforeEach(() => {
  addSlot.mockReset().mockResolvedValue({ ok: true })
  updateSlot.mockReset().mockResolvedValue({ ok: true })
  deleteSlot.mockReset().mockResolvedValue({ ok: true })
})

describe("SlotEditor", () => {
  it("saves an edited slot with its new values", async () => {
    const user = userEvent.setup()
    render(<SlotEditor signupId="signup_1" slots={[freeSlot]} />)
    const label = screen.getByLabelText("Label", { selector: `#slot-${freeSlot.id}-label` })
    await user.clear(label)
    await user.type(label, "Early shift")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(updateSlot).toHaveBeenCalledWith("slot_free", {
      label: "Early shift",
      pointValue: 1,
      capacity: 2,
    })
  })

  it("disables Save until something changes", () => {
    render(<SlotEditor signupId="signup_1" slots={[freeSlot]} />)
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("deletes an unclaimed slot but disables delete for a claimed one", async () => {
    const user = userEvent.setup()
    render(<SlotEditor signupId="signup_1" slots={[freeSlot, claimedSlot]} />)
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" })
    expect(deleteButtons[0]).toBeEnabled()
    expect(deleteButtons[1]).toBeDisabled()
    await user.click(deleteButtons[0])
    expect(deleteSlot).toHaveBeenCalledWith("slot_free")
  })

  it("adds a new slot and clears the add row", async () => {
    const user = userEvent.setup()
    render(<SlotEditor signupId="signup_1" slots={[]} />)
    const addButton = screen.getByRole("button", { name: "Add slot" })
    expect(addButton).toBeDisabled() // empty label
    await user.type(screen.getByLabelText("Label"), "Extra shift")
    await user.click(addButton)
    expect(addSlot).toHaveBeenCalledWith("signup_1", {
      label: "Extra shift",
      pointValue: 1,
      capacity: 1,
    })
    expect(await screen.findByLabelText("Label")).toHaveValue("")
  })

  it("surfaces guard rejections from the server", async () => {
    updateSlot.mockResolvedValue({ ok: false, error: "capacity_below_claims" })
    const user = userEvent.setup()
    render(<SlotEditor signupId="signup_1" slots={[claimedSlot]} />)
    const capacity = screen.getByLabelText("Seats", {
      selector: `#slot-${claimedSlot.id}-capacity`,
    })
    await user.clear(capacity)
    await user.type(capacity, "3")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/capacity can't be lower/i)
  })

  it("has no axe violations", async () => {
    const { container } = render(<SlotEditor signupId="signup_1" slots={[freeSlot, claimedSlot]} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
