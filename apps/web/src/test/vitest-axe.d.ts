// vitest-axe ships type augmentation only for the legacy `Vi` global namespace
// (vitest ≤0.34); vitest 3 needs a module augmentation instead. Keeps
// expect(container).toHaveNoViolations() typed — the runtime matcher is
// registered in setup.ts.
import type { AxeMatchers } from "vitest-axe/matchers"

declare module "vitest" {
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
}
