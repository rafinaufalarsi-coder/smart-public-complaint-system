import { UserProfile } from "./types";

const TOKEN_KEY = "spcs_access_token";
const USER_KEY = "spcs_user_profile";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredSession(token: string, user: UserProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const userJson = localStorage.getItem(USER_KEY);
  if (!userJson) return null;
  try {
    return JSON.parse(userJson) as UserProfile;
  } catch {
    return null;
  }
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

