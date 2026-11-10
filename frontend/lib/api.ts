import { getStoredToken } from "./auth";
import { ApiResponse } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  customToken?: string
): Promise<ApiResponse<T>> {
  const token = customToken ?? getStoredToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      payload.message ??
      (response.status === 401
        ? "Sesi Anda telah kedaluwarsa. Silakan login kembali."
        : response.status === 403
        ? "Anda tidak memiliki izin untuk melakukan tindakan ini."
        : `Permintaan gagal (Status: ${response.status})`);
    throw new Error(errorMsg);
  }

  return payload as ApiResponse<T>;
}

