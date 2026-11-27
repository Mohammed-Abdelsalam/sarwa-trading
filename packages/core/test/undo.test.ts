import { createRemovalQueue } from '../src/undo';

describe('createRemovalQueue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('commits the removal once the undo window ends', () => {
    const queue = createRemovalQueue(5_000);
    const commit = jest.fn();

    queue.schedule('AAPL', commit);
    expect(queue.getPending()).toBe('AAPL');
    jest.advanceTimersByTime(4_999);
    expect(commit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(queue.getPending()).toBeNull();
  });

  it('drops the removal on undo without committing it', () => {
    const queue = createRemovalQueue();
    const commit = jest.fn();

    queue.schedule('AAPL', commit);
    queue.undo();
    jest.runAllTimers();

    expect(commit).not.toHaveBeenCalled();
    expect(queue.getPending()).toBeNull();
  });

  it('commits the earlier removal when a second one is scheduled', () => {
    const queue = createRemovalQueue();
    const first = jest.fn();
    const second = jest.fn();

    queue.schedule('AAPL', first);
    queue.schedule('TSLA', second);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(queue.getPending()).toBe('TSLA');
  });

  it('commits right away on flush and tells subscribers about each change', () => {
    const queue = createRemovalQueue();
    const commit = jest.fn();
    const listener = jest.fn();
    const unsubscribe = queue.subscribe(listener);

    queue.schedule('AAPL', commit);
    queue.flush();
    unsubscribe();
    queue.schedule('TSLA', jest.fn());

    expect(commit).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
