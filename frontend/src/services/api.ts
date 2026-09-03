import type { Session } from "@/types";

export const API_URL = import.meta.env.VITE_API_URL ?? "/api";
const SESSION_KEY = "torresoft.session";

export function storedSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export function storeSession(session: Session | null): void {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

async function refreshSession(session: Session): Promise<boolean> {
  const refreshed = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken })
  });
  if (!refreshed.ok) return false;
  storeSession(await refreshed.json() as Session);
  return true;
}

export async function authenticatedFetch(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const session = storedSession();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...options.headers
    }
  });
  if (response.status === 401 && session && retry && !path.startsWith("/auth/")) {
    const refreshed = await refreshSession(session);
    if (refreshed) return authenticatedFetch(path, options, false);
    storeSession(null);
    window.location.assign("/login");
  }
  return response;
}

async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await authenticatedFetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({ message: "Falha de comunicacao." })) as { message?: string };
    throw new Error(result.message ?? "Falha de comunicacao.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => call<T>(path),
  post: <T>(path: string, body: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => call<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path: string) => call<void>(path, { method: "DELETE" }),
  download: async (path: string, filename: string): Promise<void> => {
    const response = await authenticatedFetch(path);
    if (!response.ok) throw new Error("Nao foi possivel exportar o relatorio.");
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  downloadPost: async (path: string, body: unknown, fallbackFilename: string): Promise<void> => {
    const response = await authenticatedFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({ message: "Nao foi possivel gerar o backup." })) as { message?: string };
      throw new Error(result.message ?? "Nao foi possivel gerar o backup.");
    }
    const disposition = response.headers.get("Content-Disposition");
    const fileName = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackFilename;
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
};
