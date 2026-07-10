import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createChildLogger, logger } from "../logger"

describe("logger", () => {
  const originalLogLevel = process.env.LOG_LEVEL

  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {})
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.LOG_LEVEL = originalLogLevel
  })

  it("routes info to console.log with a level-prefixed message", () => {
    logger.info("signup created")

    expect(console.log).toHaveBeenCalledWith("[info] signup created")
  })

  it("routes warn to console.warn and error to console.error", () => {
    logger.warn("slot nearly full")
    logger.error("slot claim failed")

    expect(console.warn).toHaveBeenCalledWith("[warn] slot nearly full")
    expect(console.error).toHaveBeenCalledWith("[error] slot claim failed")
  })

  it("passes meta as a second argument when present", () => {
    logger.info("signup created", { signupId: "abc" })

    expect(console.log).toHaveBeenCalledWith("[info] signup created", { signupId: "abc" })
  })

  it("omits the second argument entirely when there is no meta", () => {
    logger.info("no meta here")

    expect(console.log).toHaveBeenCalledWith("[info] no meta here")
    expect((console.log as ReturnType<typeof vi.fn>).mock.calls[0]).toHaveLength(1)
  })

  it("suppresses debug output by default (LOG_LEVEL unset defaults to info)", () => {
    delete process.env.LOG_LEVEL
    logger.debug("verbose detail")

    expect(console.debug).not.toHaveBeenCalled()
  })

  it("honors LOG_LEVEL to filter lower-priority levels", () => {
    process.env.LOG_LEVEL = "warn"
    logger.info("should be suppressed")
    logger.warn("should be emitted")

    expect(console.log).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith("[warn] should be emitted")
  })

  it("falls back to info level for an unrecognized LOG_LEVEL value", () => {
    process.env.LOG_LEVEL = "verbose"
    logger.debug("suppressed")
    logger.info("emitted")

    expect(console.debug).not.toHaveBeenCalled()
    expect(console.log).toHaveBeenCalledWith("[info] emitted")
  })

  describe("createChildLogger", () => {
    it("merges bound context into every call's meta", () => {
      const child = createChildLogger({ requestId: "req-1" })
      child.info("handled request", { status: 200 })

      expect(console.log).toHaveBeenCalledWith("[info] handled request", {
        requestId: "req-1",
        status: 200,
      })
    })

    it("lets per-call meta override a bound key of the same name", () => {
      const child = createChildLogger({ status: "pending" })
      child.info("status changed", { status: "confirmed" })

      expect(console.log).toHaveBeenCalledWith("[info] status changed", { status: "confirmed" })
    })

    it("still emits bindings-only payload when no per-call meta is passed", () => {
      const child = createChildLogger({ requestId: "req-1" })
      child.warn("timeout")

      expect(console.warn).toHaveBeenCalledWith("[warn] timeout", { requestId: "req-1" })
    })
  })
})
