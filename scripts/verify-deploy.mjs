#!/usr/bin/env node
// Smoke-tests each deployed service. Checks run independently — one failing
// (e.g. Railway asleep on the free tier) doesn't stop the others from running.
//
// Usage:
//   DEPLOY_WEB_URL=https://your-app.vercel.app \
//   DEPLOY_API_URL=https://your-api.up.railway.app \
//   pnpm verify:deploy
//
// Or set DEPLOY_WEB_URL / DEPLOY_API_URL in a root-level .env (gitignored,
// copy .env.example to get started) to avoid passing them every time.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")

function readEnvFile(path) {
  const out = {}
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (match) out[match[1]] = match[2].trim().replace(/^"|"$/g, "")
    }
  } catch {
    // no .env file present — fall through to process.env only
  }
  return out
}

const rootEnv = readEnvFile(join(repoRoot, ".env"))
const webEnv = readEnvFile(join(repoRoot, "apps/web/.env"))

const WEB_URL = process.env.DEPLOY_WEB_URL ?? rootEnv.DEPLOY_WEB_URL
const API_URL = process.env.DEPLOY_API_URL ?? rootEnv.DEPLOY_API_URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? webEnv.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? webEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

const results = []

async function check(name, fn) {
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail })
  } catch (err) {
    results.push({ name, ok: false, detail: err.message })
  }
}

await check("Vercel (apps/web)", async () => {
  if (!WEB_URL) throw new Error("DEPLOY_WEB_URL not set")
  const res = await fetch(WEB_URL, { redirect: "follow" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.text()
  if (!body.includes("Don&#x27;t Panic") && !body.includes("Don't Panic")) {
    throw new Error("200 OK but health page content not found in response")
  }
  return `HTTP ${res.status} — health page rendered`
})

await check("Railway (apps/api)", async () => {
  if (!API_URL) throw new Error("DEPLOY_API_URL not set")
  const res = await fetch(`${API_URL.replace(/\/$/, "")}/health`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.status !== "ok") throw new Error(`unexpected body: ${JSON.stringify(json)}`)
  return `HTTP ${res.status} — status=${json.status}`
})

await check("Supabase (db)", async () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not set")
  }
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/organizations?select=id&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return `HTTP ${res.status} — "organizations" table reachable (migration applied)`
})

console.log("\nDeployment verification")
console.log("=".repeat(50))
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name} — ${r.detail}`)
}
console.log("=".repeat(50))

const failed = results.filter((r) => !r.ok).length
console.log(`${results.length - failed}/${results.length} passed`)
process.exit(failed > 0 ? 1 : 0)
