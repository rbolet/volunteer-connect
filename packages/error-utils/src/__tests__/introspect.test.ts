import { describe, expect, it } from "vitest"
import { introspect } from "../introspect"

describe("introspect", () => {
  it("prepends the function name to a sync thrown error", () => {
    function fetchUser(): never {
      throw new Error("record not found")
    }
    const wrapped = introspect(fetchUser)

    expect(() => wrapped()).toThrowError("fetchUser: record not found")
  })

  it("prepends the function name to an async rejected error", async () => {
    async function fetchUser(): Promise<never> {
      throw new Error("record not found")
    }
    const wrapped = introspect(fetchUser)

    await expect(wrapped()).rejects.toThrowError("fetchUser: record not found")
  })

  it("returns the value unchanged when the wrapped function succeeds", () => {
    function add(a: number, b: number) {
      return a + b
    }
    const wrapped = introspect(add)

    expect(wrapped(2, 3)).toBe(5)
  })

  it("preserves the original Error instance (instanceof, stack, extra props)", () => {
    class ApiError extends Error {
      status = 404
    }
    function fetchUser(): never {
      throw new ApiError("record not found")
    }
    const wrapped = introspect(fetchUser)

    try {
      wrapped()
      throw new Error("expected wrapped() to throw")
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(404)
      expect((err as ApiError).message).toBe("@fetchUser: record not found")
    }
  })

  it("wraps non-Error throws in a new Error carrying the original as cause", () => {
    function fetchUser(): never {
      throw "record not found"
    }
    const wrapped = introspect(fetchUser)

    try {
      wrapped()
      throw new Error("expected wrapped() to throw")
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toBe("fetchUser: record not found")
      expect((err as Error).cause).toBe("record not found")
    }
  })

  it("falls back to an explicit name for anonymous functions", () => {
    const wrapped = introspect(() => {
      throw new Error("boom")
    }, "anonFn")

    expect(() => wrapped()).toThrowError("anonFn: boom")
  })

  it("wraps every method on an object, using the property key as the name", () => {
    const repo = introspect({
      fetchUser() {
        throw new Error("record not found")
      },
      async fetchTeam() {
        throw new Error("record not found")
      },
      ok() {
        return "fine"
      },
    })

    expect(() => repo.fetchUser()).toThrowError("fetchUser: record not found")
    expect(repo.ok()).toBe("fine")
    return expect(repo.fetchTeam()).rejects.toThrowError("fetchTeam: record not found")
  })

  it("preserves `this` binding for wrapped object methods", () => {
    const counter = introspect({
      count: 0,
      increment() {
        this.count += 1
        return this.count
      },
    })

    expect(counter.increment()).toBe(1)
    expect(counter.increment()).toBe(2)
  })

  it("does not wrap non-function properties on an object", () => {
    const target = introspect({ label: "team", getLabel: () => "team" })

    expect(target.label).toBe("team")
  })
})
