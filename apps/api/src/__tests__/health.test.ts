import { describe, expect, it } from "vitest"
import request from "supertest"
import { app } from "../app"

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health")
    expect(res.status).toBe(200)
    expect(res.body.status).toBe("ok")
  })

  it("includes an ISO timestamp", async () => {
    const res = await request(app).get("/health")
    expect(res.body.timestamp).toBeDefined()
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp)
  })
})
