import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SaveAsTemplateButton } from "../save-as-template-button"

const { saveSignupAsTemplate } = vi.hoisted(() => ({ saveSignupAsTemplate: vi.fn() }))
vi.mock("../../../../actions", () => ({ saveSignupAsTemplate }))

beforeEach(() => {
  saveSignupAsTemplate.mockReset().mockResolvedValue({ ok: true, id: "template_new" })
})

describe("SaveAsTemplateButton", () => {
  it("opens an inline title input prefilled with the signup's title", async () => {
    const user = userEvent.setup()
    render(<SaveAsTemplateButton signupId="signup_1" signupTitle="Snack Shack — Saturday" />)
    await user.click(screen.getByRole("button", { name: "Save as template" }))
    expect(screen.getByLabelText("Template title")).toHaveValue("Snack Shack — Saturday")
  })

  it("saves with the (possibly edited) title", async () => {
    const user = userEvent.setup()
    render(<SaveAsTemplateButton signupId="signup_1" signupTitle="Snack Shack — Saturday" />)
    await user.click(screen.getByRole("button", { name: "Save as template" }))
    const input = screen.getByLabelText("Template title")
    await user.clear(input)
    await user.type(input, "Weekly Snack Shack")
    await user.click(screen.getByRole("button", { name: "Save template" }))
    expect(saveSignupAsTemplate).toHaveBeenCalledWith("signup_1", "Weekly Snack Shack")
    expect(await screen.findByText("Saved as template.")).toBeInTheDocument()
  })

  it("can be cancelled without saving", async () => {
    const user = userEvent.setup()
    render(<SaveAsTemplateButton signupId="signup_1" signupTitle="Snack Shack — Saturday" />)
    await user.click(screen.getByRole("button", { name: "Save as template" }))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(saveSignupAsTemplate).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Save as template" })).toBeInTheDocument()
  })

  it("surfaces errors", async () => {
    saveSignupAsTemplate.mockResolvedValue({ ok: false, error: "unknown_error" })
    const user = userEvent.setup()
    render(<SaveAsTemplateButton signupId="signup_1" signupTitle="Snack Shack — Saturday" />)
    await user.click(screen.getByRole("button", { name: "Save as template" }))
    await user.click(screen.getByRole("button", { name: "Save template" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i)
  })

  it("has no axe violations in the open state", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <SaveAsTemplateButton signupId="signup_1" signupTitle="Snack Shack — Saturday" />
    )
    await user.click(screen.getByRole("button", { name: "Save as template" }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
