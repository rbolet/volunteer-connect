import js from "@eslint/js"
import tseslint from "typescript-eslint"
import eslintConfigPrettier from "eslint-config-prettier"

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/.next/**", "**/build/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // TS compiler already catches undefined references; no-undef misfires on TS-only globals.
    rules: {
      "no-undef": "off",
    },
  },
  eslintConfigPrettier,
)
