export class TimeoutError extends Error {
  constructor(message = "請求逾時") {
    super(message);
    this.name = "TimeoutError";
  }
}

export const DEFAULT_FETCH_TIMEOUT_MS = 12_000;

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(message));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  ms = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  return fetch(input, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(ms),
  });
}
