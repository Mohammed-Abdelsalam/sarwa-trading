import { ExecutionQueue } from '../../src/trading/execution-queue';

describe('ExecutionQueue', () => {
  it('runs tasks one at a time in the order they were queued', async () => {
    const queue = new ExecutionQueue();
    const events: string[] = [];
    const task = (name: string, ms: number) => () =>
      new Promise<void>((resolve) => {
        events.push(`start ${name}`);
        setTimeout(() => {
          events.push(`end ${name}`);
          resolve();
        }, ms);
      });

    await Promise.all([queue.run(task('a', 20)), queue.run(task('b', 1)), queue.run(task('c', 5))]);

    expect(events).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  it('keeps running later tasks when one fails', async () => {
    const queue = new ExecutionQueue();

    const failed = queue.run(() => Promise.reject(new Error('boom')));
    const next = queue.run(() => Promise.resolve('ok'));

    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });

  it('resolves idle only after everything queued before it', async () => {
    const queue = new ExecutionQueue();
    let done = false;
    void queue.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      done = true;
    });

    await queue.idle();

    expect(done).toBe(true);
  });
});
