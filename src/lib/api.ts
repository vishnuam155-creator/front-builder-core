// Lightweight fetch wrapper for the HRMS backend with automatic JWT refresh.

const RAW_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://127.0.0.1:8000/api/";

export const API_BASE = RAW_BASE.replace(/\/+$/, "");

const ACCESS_KEY = "hrms.access";
const REFRESH_KEY = "hrms.refresh";
const USER_KEY = "hrms.user";

export type Role = "SUPER_ADMIN" | "HR_ADMIN" | "EMPLOYEE";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
}

export const tokenStore = {
  getAccess: () =>
    typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY),
  getRefresh: () =>
    typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY),
  getUser: (): AuthUser | null => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },
  set: (access: string, refresh: string, user: AuthUser) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  setAccess: (access: string) => localStorage.setItem(ACCESS_KEY, access),
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
  raw?: boolean;
}

async function refreshAccess(): Promise<string | null> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;
  const res = await fetch(`${API_BASE}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access: string };
  tokenStore.setAccess(data.access);
  return data.access;
}

export async function api<T = unknown>(
  path: string,
  opts: ApiOptions = {},
): Promise<T> {
  const { body, auth = true, raw = false, headers, ...rest } = opts;

  const buildHeaders = (token: string | null): HeadersInit => {
    const h: Record<string, string> = {
      Accept: "application/json",
      ...(headers as Record<string, string> | undefined),
    };
    const isFormData =
      typeof FormData !== "undefined" && body instanceof FormData;
    if (body !== undefined && !isFormData && !h["Content-Type"]) {
      h["Content-Type"] = "application/json";
    }
    if (auth && token) h["Authorization"] = `Bearer ${token}`;
    return h;
  };

  const doFetch = async (token: string | null) => {
    const isFormData =
      typeof FormData !== "undefined" && body instanceof FormData;
    return fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: buildHeaders(token),
      body:
        body === undefined
          ? undefined
          : isFormData
            ? (body as FormData)
            : JSON.stringify(body),
    });
  };

  let token = tokenStore.getAccess();
  let res = await doFetch(token);

  if (res.status === 401 && auth) {
    const newToken = await refreshAccess();
    if (newToken) {
      res = await doFetch(newToken);
    } else {
      tokenStore.clear();
    }
  }

  if (raw) return res as unknown as T;

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
