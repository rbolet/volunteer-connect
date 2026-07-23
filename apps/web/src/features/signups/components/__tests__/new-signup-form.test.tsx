import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SignupTemplateListItem } from "@vc/types"
import { NewSignupForm } from "../new-signup-form"

const { createSignup } = vi.hoisted(() => ({ createSignup: vi.fn() }))
vi.mock("@/features/signups/actions", () => ({ createSignup }))

const { useRouter } = vi.hoisted(() => ({ useRouter: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter }))

const template: SignupTemplateListItem = {
  id: "template_1",
  title: "Saturday Tent Duty",
  description: "Standard tent shift template.",
  eligibleRoles: ["referee"],
  slots: [{ label: "Tent 8:00–10:00 AM", pointValue: 2, capacity: 2 }],
}

beforeEach(() => {
  createSignup.mockReset().mockResolvedValue({ ok: true, id: "signup_new" })
  useRouter.mockReset().mockReturnValue({ push: vi.fn() })
})

describe("NewSignupForm", () => {
  it("does not render a template picker when there are no templates", () => {
    render(<NewSignupForm />)
    expect(screen.queryByLabelText("Start from a template")).not.toBeInTheDocument()
  })

  it("populates the form from a selected template, still editable before submit", async () => {
    const user = userEvent.setup()
    render(<NewSignupForm templates={[template]} />)

    await user.selectOptions(screen.getByLabelText("Start from a template"), template.id)

    expect(screen.getByLabelText("Title")).toHaveValue(template.title)
    expect(screen.getByLabelText("Description (optional)")).toHaveValue(template.description)
    expect(screen.getByLabelText("Referee")).toBeChecked()
    expect(screen.getByLabelText("Label", { selector: "#new-slot-0-label" })).toHaveValue(
      template.slots[0].label
    )

    // Still editable after applying the template.
    await user.clear(screen.getByLabelText("Title"))
    await user.type(screen.getByLabelText("Title"), "Edited title")
    await user.click(screen.getByRole("button", { name: "Create draft signup" }))

    expect(createSignup).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Edited title", eligibleRoles: ["referee"] })
    )
  })

  it("has no axe violations with a template picker present", async () => {
    const { container } = render(<NewSignupForm templates={[template]} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
