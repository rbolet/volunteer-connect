# Lessons

## 2026-07-15 — Verification belongs in tests, not ad-hoc terminal commands

**What happened:** End-to-end verification of the demo flow (redirects, cookie issuance, page renders, claim/withdraw) was being driven with one-off `curl` pipelines in the terminal. User stopped it: these checks should be written as actual tests.

**Rule:** When verifying a flow end-to-end, ask first: "would this check be worth re-running after the next change?" If yes (almost always for user-facing flows), write it as a durable test in the layer TESTING.md designates — Playwright for full-stack flows, Supertest for API routes, Vitest for logic — and run that. Ad-hoc terminal probing is acceptable only for one-time environment diagnosis (connectivity, credentials, tool availability), not for behavior verification.
