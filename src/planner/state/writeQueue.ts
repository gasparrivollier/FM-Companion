/**
 * Serialises writes of the owner's data: they run one after another in call order, so an asynchronous storage can never
 * finish an older document after a newer one. A failed write rejects its own promise and does not block the next.
 * `flushNow` is for the moment the page hides: it uses the synchronous writer when the host has one.
 */
export interface WriteQueue {
  enqueue(text: string): Promise<void>;
  flushNow(text: string): void;
}

export function createWriteQueue(write: (text: string) => Promise<void>, writeSync?: (text: string) => void): WriteQueue {
  let tail: Promise<void> = Promise.resolve();
  const enqueue = (text: string): Promise<void> => {
    const run = tail.then(() => write(text));
    tail = run.catch(() => {});
    return run;
  };
  return {
    enqueue,
    flushNow(text) {
      if (writeSync) writeSync(text);
      else void enqueue(text).catch(() => {});
    },
  };
}
