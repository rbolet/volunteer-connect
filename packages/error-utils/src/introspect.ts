type AnyFn = (...args: unknown[]) => unknown

function prependName(name: string, error: unknown): unknown {
  if (error instanceof Error) {
    error.message = `@${name}: ${error.message}`
    return error
  }
  return new Error(`${name}: ${String(error)}`, { cause: error })
}

function wrapFunction<T extends AnyFn>(fn: T, name: string): T {
  return new Proxy(fn, {
    apply(target, thisArg, args) {
      try {
        const result = Reflect.apply(target, thisArg, args)
        if (result instanceof Promise) {
          return result.catch((err: unknown) => {
            throw prependName(name, err)
          })
        }
        return result
      } catch (err) {
        throw prependName(name, err)
      }
    },
  }) as T
}

/**
 * Wraps a function or an object of methods so that any error thrown or
 * rejected from within has the source function/method name prepended to
 * its message, e.g. `Error: fetchUser: record not found`.
 */
export function introspect<T extends AnyFn>(fn: T, name?: string): T
export function introspect<T extends object>(target: T): T
export function introspect(target: unknown, name?: string): unknown {
  if (typeof target === "function") {
    const fn = target as AnyFn
    return wrapFunction(fn, name ?? fn.name ?? "anonymous")
  }

  if (typeof target === "object" && target !== null) {
    return new Proxy(target, {
      get(obj, prop, receiver) {
        const value = Reflect.get(obj, prop, receiver)
        if (typeof value !== "function") return value
        return wrapFunction((value as AnyFn).bind(obj), String(prop))
      },
    })
  }

  throw new TypeError("introspect() expects a function or an object of methods")
}
