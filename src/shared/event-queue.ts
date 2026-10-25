export class EventQueue<T> implements AsyncIterable<T> {
  private values: T[] = []
  private pending: ((result: IteratorResult<T>) => void) | null = null
  private closed = false

  push(value: T): void {
    if (this.closed) return
    if (this.pending) {
      const resolve = this.pending
      this.pending = null
      resolve({ value, done: false })
    } else {
      this.values.push(value)
    }
  }

  end(): void {
    this.closed = true
    this.pending?.({ value: undefined, done: true })
    this.pending = null
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    while (true) {
      if (this.values.length) {
        // Length was checked synchronously; undefined may itself be a valid T.
        yield this.values.splice(0, 1)[0]
      } else if (this.closed) {
        return
      } else {
        const next = await new Promise<IteratorResult<T>>((resolve) => {
          this.pending = resolve
        })
        if (next.done) return
        yield next.value
      }
    }
  }
}
