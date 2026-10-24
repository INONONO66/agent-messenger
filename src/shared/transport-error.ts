export interface TransportDetails {
  readonly httpStatus?: number
  readonly retryAfter?: number
  readonly cause?: Error
}

export function transportCode(cause: Error | undefined): string | undefined {
  return cause && 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined
}
