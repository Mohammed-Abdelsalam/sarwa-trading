import { Injectable } from '@nestjs/common';

// Every change to accounts, orders and positions runs here one at a time, so two fills, a fill
// and a cancel, or a placement and a reset can never interleave.
@Injectable()
export class ExecutionQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;

  run<T>(task: () => Promise<T>): Promise<T> {
    this.pending++;
    const result = this.tail.then(task).finally(() => {
      this.pending--;
    });
    this.tail = result.catch(() => undefined);
    return result;
  }

  // Resolves once the queue is empty, including follow-up work queued by the tasks it waited for.
  async idle(): Promise<void> {
    while (this.pending > 0) await this.tail;
  }
}
