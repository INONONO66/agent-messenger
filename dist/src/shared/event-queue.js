export class EventQueue {
    values = [];
    pending = null;
    closed = false;
    push(value) {
        if (this.closed)
            return;
        if (this.pending) {
            const resolve = this.pending;
            this.pending = null;
            resolve({ value, done: false });
        }
        else {
            this.values.push(value);
        }
    }
    end() {
        this.closed = true;
        this.pending?.({ value: undefined, done: true });
        this.pending = null;
    }
    async *[Symbol.asyncIterator]() {
        while (true) {
            if (this.values.length) {
                // Length was checked synchronously; undefined may itself be a valid T.
                yield this.values.splice(0, 1)[0];
            }
            else if (this.closed) {
                return;
            }
            else {
                const next = await new Promise((resolve) => {
                    this.pending = resolve;
                });
                if (next.done)
                    return;
                yield next.value;
            }
        }
    }
}
//# sourceMappingURL=event-queue.js.map