export const API_BASE = "https://contort-sanctity-strategy.ngrok-free.dev";

export type ApiRequestOptions = {
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string) {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export function isNewCodeLongEnough(code: string): boolean {
  return code.length >= 8;
}

export function buildApiHeaders(token?: string, includesBody = false): Headers {
  const headers = new Headers({
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
  });

  if (includesBody) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return headers;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const request: RequestInit = {
    method: options.method ?? "GET",
    headers: buildApiHeaders(options.token, options.body !== undefined),
  };

  if (options.body !== undefined) request.body = JSON.stringify(options.body);

  const response = await fetch(`${API_BASE}${path}`, request);
  const payload: unknown = await response.json().catch((): null => null);

  if (!response.ok) {
    const message = getResponseMessage(payload, response.status);
    if (response.status === 401) throw new UnauthorizedError(message);
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

function getResponseMessage(payload: unknown, status: number): string {
  if (typeof payload === "object" && payload !== null) {
    const message = (payload as Record<string, unknown>)["error"];
    if (typeof message === "string" && message.trim()) return message;
  }

  if (status === 401) return "Your session has expired. Please sign in again.";
  return "We couldn't complete that request. Please try again.";
}

export function getFriendlyError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "We couldn't connect to SomaStep. Check your connection and try again.";
}