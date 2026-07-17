import { expect, type Page } from "@playwright/test"

/** Switch the demo "view as" identity via the banner and wait for it to apply. */
export async function switchIdentity(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: label, exact: true }).click()
  await expect(page.getByText(`(${label})`)).toBeVisible()
}
