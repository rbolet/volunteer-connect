export type LogMeta = Record<string, unknown>

const LEVELS = ["debug", "info", "warn", "error"] as const
export type LogLevel = (typeof LEVELS)[number]

function sinkFor(level: LogLevel): (...args: unknown[]) => void {
  switch (level) {
    case "debug":
      return console.debug
    case "info":
      return console.log
    case "warn":
      return console.warn
    case "error":
      return console.error
  }
}

function configuredLevel(): LogLevel {
  const value = process.env.LOG_LEVEL
  return (LEVELS as readonly string[]).includes(value ?? "") ? (value as LogLevel) : "info"
}

function isEnabled(level: LogLevel): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(configuredLevel())
}

export interface Logger {
  debug(msg: string, meta?: LogMeta): void
  info(msg: string, meta?: LogMeta): void
  warn(msg: string, meta?: LogMeta): void
  error(msg: string, meta?: LogMeta): void
}

function write(level: LogLevel, bindings: LogMeta, msg: string, meta?: LogMeta): void {
  if (!isEnabled(level)) return
  const payload = { ...bindings, ...meta }
  const sink = sinkFor(level)
  if (Object.keys(payload).length > 0) {
    sink(`[${level}] ${msg}`, payload)
  } else {
    sink(`[${level}] ${msg}`)
  }
}

function createLogger(bindings: LogMeta): Logger {
  return {
    debug: (msg, meta) => write("debug", bindings, msg, meta),
    info: (msg, meta) => write("info", bindings, msg, meta),
    warn: (msg, meta) => write("warn", bindings, msg, meta),
    error: (msg, meta) => write("error", bindings, msg, meta),
  }
}

export const logger: Logger = createLogger({})

export function createChildLogger(bindings: LogMeta): Logger {
  return createLogger(bindings)
}
