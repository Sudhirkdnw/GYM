import {
  ApiResponse,
  ApiErrorResponse,
  HTTP_HEADERS,
} from "@gymos/shared-types";

export class ApiClientError extends Error {
  public statusCode: number;
  public errorResponse?: ApiErrorResponse;

  constructor(
    statusCode: number,
    message: string,
    errorResponse?: ApiErrorResponse,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.errorResponse = errorResponse;
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Generate client-side correlation ID
  if (!headers.has(HTTP_HEADERS.CORRELATION_ID)) {
    headers.set(
      HTTP_HEADERS.CORRELATION_ID,
      `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    );
  }

  // Attach selected branch header if present in browser storage
  if (typeof window !== "undefined") {
    const activeBranchId = localStorage.getItem("gymos_selected_branch_id");
    if (activeBranchId && !headers.has("x-branch-id")) {
      headers.set("x-branch-id", activeBranchId);
    }
  }

  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | null;
    const errorMessage = errorPayload?.message
      ? Array.isArray(errorPayload.message)
        ? errorPayload.message.join(", ")
        : errorPayload.message
      : `HTTP ${response.status}: ${response.statusText}`;

    throw new ApiClientError(
      response.status,
      errorMessage,
      errorPayload || undefined,
    );
  }

  // If payload is wrapped in standard ApiResponse envelope, unwrap data
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    "success" in payload
  ) {
    return (payload as ApiResponse<T>).data;
  }

  return payload as T;
}
