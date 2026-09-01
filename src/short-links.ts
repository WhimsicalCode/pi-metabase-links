export const SHORT_LINK_CREATE_EVENT = "pi-short-links:create:v1";

export type ShortLinkCreateInputV1 = {
  url: string;
  title?: string;
  description?: string;
  tags?: string[];
  expiresIn?: "1h" | "1d" | "7d" | "30d" | "never";
  dedupe?: boolean;
};

export type ShortLinkCreateResultV1 = {
  shortUrl: string;
  localOnly: true;
  warnings: string[];
};

export type ShortLinkCreateRequestV1 = {
  version: 1;
  input: ShortLinkCreateInputV1;
  signal?: AbortSignal;
  claim(): boolean;
  resolve(result: ShortLinkCreateResultV1): void;
  reject(error: unknown): void;
};

type EventEmitter = {
  emit(eventName: string, data: unknown): unknown;
};

export type ShortLinkAttempt =
  { claimed: false } | { claimed: true; result: ShortLinkCreateResultV1 };

export async function requestShortLink(
  events: EventEmitter,
  input: ShortLinkCreateInputV1,
  signal?: AbortSignal,
): Promise<ShortLinkAttempt> {
  let claimed = false;
  let resolveResult!: (result: ShortLinkCreateResultV1) => void;
  let rejectResult!: (error: unknown) => void;
  const resultPromise = new Promise<ShortLinkCreateResultV1>(
    (resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    },
  );

  const request: ShortLinkCreateRequestV1 = {
    version: 1,
    input,
    ...(signal === undefined ? {} : { signal }),
    claim() {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    resolve: resolveResult,
    reject: rejectResult,
  };

  events.emit(SHORT_LINK_CREATE_EVENT, request);
  if (!claimed) return { claimed: false };

  return { claimed: true, result: await resultPromise };
}
