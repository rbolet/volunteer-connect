import { expect, test } from "@playwright/test"
import { switchIdentity } from "./helpers"

// Core demo flows (TESTING.md → E2E): entry + session issuance, browse,
// claim/withdraw on the open signup, view-as switching, team point totals.
// Runs against the seeded demo org — every mutation cleans itself up
// (claim → withdraw), so the suite leaves the data as it found it.

const OPEN_SIGNUP = "Referee Tent Duty — Saturday"
// Deliberately-unclaimed afternoon slot in the seed data (demo-data.ts).
const FREE_SLOT = "Ref Tent 12:00–1:00 PM"

test("landing page offers the demo and carries no demo banner", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Volunteer Connect" })).toBeVisible()
  await expect(page.getByText("Demo mode")).toHaveCount(0)
  await expect(page.getByRole("link", { name: /view the live demo/i })).toBeVisible()
})

test("/demo redirects to the dashboard with a signed demo cookie and banner", async ({
  page,
  context,
}) => {
  await page.goto("/demo")
  await expect(page).toHaveURL(/\/demo\/dashboard$/)

  const cookies = await context.cookies()
  const demoCookie = cookies.find((c) => c.name === "demo_session")
  expect(demoCookie).toBeDefined()
  expect(demoCookie!.httpOnly).toBe(true)
  // identity.signature — the identity half is the default volunteer
  expect(demoCookie!.value).toMatch(/^volunteer\./)

  // Banner reflects the default identity (seeded volunteer Sam Rodriguez).
  await expect(page.getByText("Demo mode")).toBeVisible()
  await expect(page.getByText(/viewing as Sam Rodriguez \(Volunteer\)/)).toBeVisible()
})

test("dashboard shows open signups, my claims, and team points", async ({ page }) => {
  await page.goto("/demo/dashboard")
  await expect(page.getByRole("heading", { name: "Open signups" })).toBeVisible()
  await expect(page.getByRole("link", { name: OPEN_SIGNUP })).toBeVisible()
  // Seeded volunteer has a completed field-prep claim.
  await expect(page.getByRole("heading", { name: "My claims" })).toBeVisible()
  await expect(page.getByText(/Field 5 Lining & Setup/)).toBeVisible()
  await expect(page.getByRole("heading", { name: "Team points" })).toBeVisible()
})

test("teams page shows the seeded point totals", async ({ page }) => {
  await page.goto("/demo/teams")
  // Hand-computed from demo-data.ts: 2×8pt field-prep completions + board
  // tent completions per team (see seed content).
  for (const [team, points] of [
    ["Sharks", "18"],
    ["Comets", "18"],
    ["Thunder", "17"],
    ["Lightning", "17"],
    ["Eagles", "18"],
    ["Wildcats", "9"],
  ] as const) {
    const row = page.getByRole("row", { name: new RegExp(team) })
    await expect(row).toContainText(points)
  }
})

test("volunteer sees only their own responses on the open signup", async ({ page }) => {
  await page.goto("/demo/signups")
  await page.getByRole("link", { name: new RegExp(OPEN_SIGNUP) }).click()
  await expect(page.getByRole("heading", { name: OPEN_SIGNUP })).toBeVisible()
  // 5 seeded pending claims exist, but none belong to the default volunteer —
  // names are redacted while the signup is open, counts stay visible.
  await expect(page.getByText("Jordan Lee", { exact: false })).toHaveCount(0)
  await expect(page.getByText("1 claimed", { exact: true })).toHaveCount(3) // 8-9, 9-10, 10-11 slots
})

test("referee can claim and withdraw an open slot, updating seat counts", async ({ page }) => {
  await page.goto("/demo/dashboard")
  await switchIdentity(page, "Referee")

  await page.goto("/demo/signups")
  await page.getByRole("link", { name: new RegExp(OPEN_SIGNUP) }).click()

  const slotRow = page.getByRole("row", { name: new RegExp(FREE_SLOT) })
  await expect(slotRow).toBeVisible()

  // Self-heal if a previous crashed run left a claim behind.
  if (await slotRow.getByRole("button", { name: "Withdraw" }).isVisible()) {
    await slotRow.getByRole("button", { name: "Withdraw" }).click()
    await expect(slotRow.getByRole("button", { name: "Claim" })).toBeVisible()
  }

  await expect(slotRow).toContainText("0/2")
  await slotRow.getByRole("button", { name: "Claim" }).click()

  // Claim landed: seat count updates, own name appears, button flips.
  await expect(slotRow).toContainText("1/2")
  await expect(slotRow).toContainText("Jordan Lee (Thunder)")
  await expect(slotRow.getByRole("button", { name: "Withdraw" })).toBeVisible()

  // And it shows up on the dashboard as a pending claim.
  await page.goto("/demo/dashboard")
  await expect(page.getByText(FREE_SLOT)).toBeVisible()

  // Withdraw to restore the seed state.
  await page.goto("/demo/signups")
  await page.getByRole("link", { name: new RegExp(OPEN_SIGNUP) }).click()
  await slotRow.getByRole("button", { name: "Withdraw" }).click()
  await expect(slotRow.getByRole("button", { name: "Claim" })).toBeVisible()
  await expect(slotRow).toContainText("0/2")
})

test("admin sees the full roster while the signup is open", async ({ page }) => {
  await page.goto("/demo/dashboard")
  await switchIdentity(page, "Admin")
  await expect(page.getByText(/viewing as Carlos Torres \(Admin\)/)).toBeVisible()

  await page.goto("/demo/signups")
  await page.getByRole("link", { name: new RegExp(OPEN_SIGNUP) }).click()
  // Seeded pending claims are visible by name to the admin.
  await expect(page.getByText("Jordan Lee (Thunder)")).toBeVisible()
  await expect(page.getByText("Tom Baker (Lightning)")).toBeVisible()

  // Back to the default identity so later runs start from a known state.
  await switchIdentity(page, "Volunteer")
})
