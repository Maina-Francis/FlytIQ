/**
 * Storage adapter for Supabase client authentication.
 * Uses browser localStorage when available.
 */
export function brokeredPreviewStorage() {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}
