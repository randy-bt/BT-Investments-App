export class RateLimiter {
  private requests: Map<string, number[]> = new Map()

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  check(key: string): boolean {
    const now = Date.now()
    const timestamps = this.requests.get(key) ?? []

    // Remove expired timestamps
    const valid = timestamps.filter((t) => now - t < this.windowMs)

    if (valid.length >= this.maxRequests) {
      this.requests.set(key, valid)
      return false
    }

    valid.push(now)
    this.requests.set(key, valid)
    return true
  }
}
