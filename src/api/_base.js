// Single source of truth for the API base URL.
// Set VITE_API_BASE in .env.production (or Vercel env vars) to point at the
// Render backend. Defaults to relative `/api` so local dev with the Vite
// proxy keeps working unchanged.

const RAW = import.meta.env.VITE_API_BASE ?? '';
const STRIPPED = String(RAW).replace(/\/+$/, '');

export const API_BASE = STRIPPED;

export function apiUrl(path) {
  // path always starts with `/api/...`
  return `${API_BASE}${path}`;
}
