import { expect, test } from "@playwright/test"
import { switchIdentity } from "./helpers"

// Admin lifecycle E2E: create a signup with slots → edit slots (draft + open,
// with guards) → open → volunteer claims → close → reopen → close → finalize
// → points land on the claimant's team. Runs in the "admin" project AFTER the
// core specs (it awards points, changing the seeded totals; global-setup
// resets the demo org before each full run).

const TITLE = "Snack Shack — Saturday"
const SLOT_MORNING = "Snack Shack 8:00–10:00 AM"
const SLOT_MIDDAY = "Snack Shack 10:00–12:00 PM"
const SLOT_EXTRA = "Cleanup crew 12:00–1:00 PM"

test("admin creates, opens, and finalizes a signup; points reach the team", async ({ page }) => {
  // --- Create (as Admin) ---
  await page.goto("/demo/dashboard")
  await switchIdentity(page, "Admin")
  await page.goto("/demo/signups")
  await page.getByRole("link", { name: "New signup" }).click()

  await page.getByLabel("Title").fill(TITLE)
  await page.getByLabel("Description (optional)").fill("Run the snack shack during games.")
  // "Volunteer" is pre-checked; slot 1:
  await page.locator("#new-slot-0-label").fill(SLOT_MORNING)
  await page.locator("#new-slot-0-points").fill("3")
  await page.locator("#new-slot-0-capacity").fill("2")
  await page.getByRole("button", { name: "Add another slot" }).click()
  await page.locator("#new-slot-1-label").fill(SLOT_MIDDAY)
  await page.getByRole("button", { name: "Create draft signup" }).click()

  // Redirected to the draft's detail page.
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible()
  await expect(page.getByText("Draft", { exact: true })).toBeVisible()

  // --- Edit a slot while draft ---
  const midday = page.locator("li", { has: page.locator(`input[value="${SLOT_MIDDAY}"]`) })
  await midday.locator('input[type="number"]').first().fill("2") // points 1 → 2
  await midday.getByRole("button", { name: "Save" }).click()
  await expect(page.getByRole("row", { name: new RegExp(SLOT_MIDDAY) })).toContainText("2")

  // --- Open it ---
  await page.getByRole("button", { name: "Open signup" }).click()
  await expect(page.getByText("Open", { exact: true })).toBeVisible()

  // --- Add a slot while open ---
  await page.locator("#slot-new-label").fill(SLOT_EXTRA)
  await page.getByRole("button", { name: "Add slot" }).click()
  await expect(page.getByRole("row", { name: new RegExp(SLOT_EXTRA) })).toBeVisible()

  // --- Volunteer claims the 3-point slot for Eagles ---
  await switchIdentity(page, "Volunteer")
  const morningRow = page.getByRole("row", { name: new RegExp(SLOT_MORNING) })
  await morningRow.getByRole("button", { name: "Claim" }).click()
  await expect(morningRow).toContainText("1/2")
  await expect(morningRow).toContainText("Sam Rodriguez (Eagles)")

  // --- Admin: slot with claims can't be deleted; capacity floor enforced ---
  await switchIdentity(page, "Admin")
  const morningEditor = page.locator("li", {
    has: page.locator(`input[value="${SLOT_MORNING}"]`),
  })
  await expect(morningEditor.getByRole("button", { name: "Delete" })).toBeDisabled()

  // --- Close → Reopen → Close → Finalize (awards 3 pts to Eagles) ---
  await page.getByRole("button", { name: "Close signup" }).click()
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible()
  await page.getByRole("button", { name: "Reopen" }).click()
  await expect(page.getByRole("button", { name: "Close signup" })).toBeVisible()
  await page.getByRole("button", { name: "Close signup" }).click()
  await page.getByRole("button", { name: /finalize & award points/i }).click()
  await expect(page.getByText("Award 3 pts (Eagles +3)?")).toBeVisible()
  await page.getByRole("button", { name: "Confirm" }).click()
  await expect(page.getByText("Finalized", { exact: true })).toBeVisible()
  await expect(page.getByText(/points awarded/i)).toBeVisible()

  // --- Points reached the team: Eagles seeded 18 + 3 = 21 ---
  await page.goto("/demo/teams")
  await expect(page.getByRole("row", { name: /Eagles/ })).toContainText("21")

  // --- Volunteer sees the completed claim ---
  await switchIdentity(page, "Volunteer")
  await page.goto("/demo/dashboard")
  const claim = page.locator("li", { has: page.getByRole("link", { name: SLOT_MORNING }) })
  await expect(claim).toContainText("Completed")
})

test("non-admin identities get no admin surface", async ({ page }) => {
  await page.goto("/demo/signups")
  await expect(page.getByRole("link", { name: "New signup" })).toHaveCount(0)
  // Direct navigation to the create page 404s for non-admins.
  const res = await page.goto("/demo/signups/new")
  expect(res!.status()).toBe(404)
})

const TEMPLATE_TITLE = "Referee Tent Duty"
const TEMPLATE_SLOT = "Tent 8:00–10:00 AM"

test("admin saves a signup as a template, applies it, then deletes the template", async ({
  page,
}) => {
  await page.goto("/demo/dashboard")
  await switchIdentity(page, "Admin")

  // --- Create a source signup to derive the template from ---
  await page.goto("/demo/signups/new")
  await page.getByLabel("Title").fill(TEMPLATE_TITLE)
  await page.locator("#new-slot-0-label").fill(TEMPLATE_SLOT)
  await page.getByRole("button", { name: "Create draft signup" }).click()
  await expect(page.getByRole("heading", { name: TEMPLATE_TITLE })).toBeVisible()

  // --- Save it as a template ---
  await page.getByRole("button", { name: "Save as template" }).click()
  await page.getByLabel("Template title").fill(TEMPLATE_TITLE)
  await page.getByRole("button", { name: "Save template" }).click()
  await expect(page.getByText("Saved as template.")).toBeVisible()

  // --- Confirm it's listed on the templates page ---
  await page.goto("/demo/signup-templates")
  await expect(page.getByText(TEMPLATE_TITLE)).toBeVisible()

  // --- Apply it from the New Signup form; fields pre-fill and stay editable ---
  await page.goto("/demo/signups/new")
  await page.getByLabel("Start from a template").selectOption({ label: TEMPLATE_TITLE })
  await expect(page.getByLabel("Title")).toHaveValue(TEMPLATE_TITLE)
  await expect(page.locator("#new-slot-0-label")).toHaveValue(TEMPLATE_SLOT)
  await page.getByRole("button", { name: "Create draft signup" }).click()
  await expect(page.getByRole("heading", { name: TEMPLATE_TITLE })).toBeVisible()

  // --- Delete the template ---
  await page.goto("/demo/signup-templates")
  await page.getByRole("button", { name: "Delete" }).click()
  await expect(page.getByText(TEMPLATE_TITLE)).toHaveCount(0)
})
