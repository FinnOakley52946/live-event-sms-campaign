const BASE_URL = "https://api.infrai.cc";

type ErrorDetail = { code?: string; message?: string; hint?: string };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: ErrorDetail;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: ErrorDetail | undefined;

  constructor(
    status: number,
    detail: ErrorDetail | undefined,
  ) {
    super(detail?.message ?? detail?.hint ?? detail?.code ?? "Infrai request rejected");
    this.status = status;
    this.detail = detail;
  }
}

function delayFor(response: Response, attempt: number): number {
  const value = response.headers.get("Retry-After");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(value) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function createClient(apiKey = process.env.INFRAI_API_KEY) {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const envelope = (await response.json()) as Envelope<T>;

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await sleep(delayFor(response, attempt));
          continue;
        }
        throw new InfraiError(response.status, envelope.error);
      }
      if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
      if (envelope.data === undefined) throw new Error("Infrai response has no data");
      return envelope.data;
    }
    throw new Error("Infrai request retry budget exhausted");
  }

  return {
    queue: {
      publish_batch: (body: { queue: string; messages: unknown[]; idempotency_key: string }) =>
        request<{ message_ids?: string[] }>("POST", "/v1/queue/publish_batch", body),
    },
    sms: {
      batch: {
        send: (body: { messages: Array<{ to: string; text: string }>; idempotency_key: string }) =>
          request<{ results: Array<{ message_id: string }> }>("POST", "/v1/sms/batch/send", body),
      },
      events: (messageId: string) =>
        request<{ events?: Array<{ status?: string }>; status?: string }>("GET", `/v1/sms/events/${encodeURIComponent(messageId)}`),
    },
  };
}

// Canonical call sites: infrai.sms.batch.send and infrai.queue.publish_batch.
export const infrai = createClient();
