type LoggerOptions = { debug?: boolean }

export type Logger = {
  logMessage: (...any) => void
  logOperation: (start: [number, number], status: string, msg?: string) => void
}

export function createLogger(opts?: LoggerOptions): Logger {
  if (opts?.debug) {
    return DebugLogger()
  }
  return EmptyLogger()
}

function EmptyLogger() {
  return {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    logMessage: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    logOperation: () => {},
  }
}

function DebugLogger() {
  return {
    logMessage: console.log,
    logOperation: (
      start: [number, number],
      status: string,
      msg?: string
    ): void => {
      const [secs, ns] = process.hrtime(start)
      const ms = ns / 1000000
      const timeS = `${secs > 0 ? secs + 's' : ''}`
      const timeMs = `${secs === 0 ? ms.toFixed(1) : ms.toFixed(0)}ms`
      const time = timeS + (secs > 1 ? '' : timeMs)
      console.log('%s | %s: %s', time.padStart(7), status.padEnd(6), msg)
    },
  }
}
