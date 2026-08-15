import { createBrowserClient } from "@supabase/ssr";

// Note: we intentionally don't pass a `Database` generic here. Threading a
// hand-written schema type through supabase-js's nested
// `Schema extends GenericSchema` resolution is fragile across supabase-js
// versions (it can silently collapse table Insert/Update types to `never`).
// Query results are cast to the domain types in `lib/types.ts` at each call
// site instead, which keeps things explicit and avoids that footgun.

/**
 * Browser Supabase client. Use inside Client Components.
 * Reads/writes the auth session via cookies so it stays in sync
 * with the server client and middleware.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
