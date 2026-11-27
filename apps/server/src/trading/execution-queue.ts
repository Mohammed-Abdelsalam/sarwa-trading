import { Injectable } from '@nestjs/common';

// Every change to accounts, orders and positions runs here one at a time, so two fills, a fill
// and a cancel, or a placement and a reset can never interleave.
@Injectable()
export class ExecutionQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task);
    this.tail = result.catch(() => undefined);
    return result;
  }

  // Resolves once everything queued so far has run.
  idle(): Promise<void> {
    return this.run(() => Promise.resolve());
  }
}
