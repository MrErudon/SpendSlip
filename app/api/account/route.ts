import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

// Deletes the signed-in user's account. Requires the service role key
// (SUPABASE_SERVICE_ROLE_KEY) since self-deletion isn't exposed by the
// anon-key client SDK. All of the user's rows cascade-delete via the FK
// `on delete cascade` constraints in the schema.
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
