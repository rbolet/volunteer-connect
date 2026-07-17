const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })

/** "Jul 20" from an ISO datetime string; null-safe. */
export function formatDate(iso: string | null): string | null {
  return iso ? DATE_FORMAT.format(new Date(iso)) : null
}
