import type {
  Avatar,
  Element,
  Session,
  SpaceDetail,
  SpaceSummary,
} from "./types";

const TOKEN_KEY = "nexus_token";
const USER_KEY = "nexus_user";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  const raw = localStorage.getItem(USER_KEY);
  if (!token || !raw) return null;
  try {
    return { token, ...(JSON.parse(raw) as Omit<Session, "token">) };
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      userId: session.userId,
      role: session.role,
      username: session.username,
    })
  );
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const session = getSession();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...options.headers,
    },
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }

  return body as T;
}

export const api = {
  signup: (username: string, password: string, type: "user" | "admin") =>
    request<{ message: string; userId: string }>("/signup", {
      method: "POST",
      body: JSON.stringify({ username, password, type }),
    }),

  signin: (username: string, password: string) =>
    request<{ token: string }>("/signin", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  elements: () => request<{ elements: Element[] }>("/elements"),

  avatars: () => request<{ avatars: Avatar[] }>("/avatar"),

  updateMetadata: (avatarId: string) =>
    request<{ message: string }>("/user/metadata", {
      method: "POST",
      body: JSON.stringify({ avatarId }),
    }),

  mySpaces: () => request<{ spaces: SpaceSummary[] }>("/space/all"),

  createSpace: (input: {
    name: string;
    dimensions: string;
    mapId?: string;
  }) =>
    request<{ spaceId: string; message?: string }>("/space", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getSpace: (spaceId: string) =>
    request<SpaceDetail>(`/space/${spaceId}`),

  addElementToSpace: (input: {
    spaceId: string;
    elementId: string;
    x: number;
    y: number;
  }) =>
    request<{ message: string }>("/space/element", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  deleteSpace: (spaceId: string) =>
    request<{ message: string }>(`/space/${spaceId}`, { method: "DELETE" }),
};
