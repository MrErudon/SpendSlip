import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// See the note in lib/supabase/client.ts: no `Database` generic here on
// purpose. Results are cast to lib/types.ts domain types at the call site.

/**
 * Server Supabase client. Use inside Server Components, Server Actions,
 * and Route Handlers. Cookie writes are silently ignored when called
 * from a Server Component (the middleware handles session refresh there).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component - middleware refreshes the
            // session instead, so this can be safely ignored.
          }
        },
      },
    },
  );
}

/**
 * Admin/service-role client for trusted server-only contexts (Edge Functions,
 * cron jobs). Never import this into anything reachable from the browser.
 */
export function createServiceRoleClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  );
}
