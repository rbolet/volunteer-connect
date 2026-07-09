import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"
import rootConfig from "../../eslint.config.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...rootConfig,
  { ignores: [".next/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals"),
]

export default eslintConfig
