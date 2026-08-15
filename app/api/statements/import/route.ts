import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeFingerprint } from "@/lib/statements/transaction-fingerprint";
import { reconcileTransfers } from "@/lib/statements/reconcile-transfers";
import type { ImportRequestRow, ImportResponse } from "@/lib/statements/types";
import type { StatementSourceType } from "@/lib/types-financial";

export const runtime = "nodejs";

interface ImportMeta {
  financial_account_id: string;
  filename: string;
  source_type: StatementSourceType;
  detected_provider: string | null;
  statement_start_date: string | null;
  statement_end_date: string | null;
  rows: ImportRequestRow[];
}

const INSERT_CHUNK_SIZE = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in", imported: 0, skippedDuplicates: 0 } satisfies ImportResponse, {
      status: 401,
    });
  }

  const form = await request.formData();
  const metaRaw = form.get("meta");
  const file = form.get("file");
  if (typeof metaRaw !== "string") {
    return NextResponse.json({ ok: false, error: "Missing import data.", imported: 0, skippedDuplicates: 0 } satisfies ImportResponse, {
      status: 400,
    });
  }
  const meta = JSON.parse(metaRaw) as ImportMeta;

  const { data: account } = await supabase
    .from("financial_accounts")
    .select("id, budget_profile_id")
    .eq("id", meta.financial_account_id)
    .single();
  if (!account) {
    return NextResponse.json({ ok: false, error: "Account not found.", imported: 0, skippedDuplicates: 0 } satisfies ImportResponse, {
      status: 404,
    });
  }
  const budgetProfileId = account.budget_profile_id as string;

  // Recompute fingerprints server-side — never trust client-provided values.
  const withFingerprints = meta.rows.map((row) => ({
    ...row,
    fingerprint: computeFingerprint({
      financialAccountId: meta.financial_account_id,
      amount: row.amount,
      transactionDate: row.transactionDate,
      normalizedDescription: row.normalizedMerchant,
    }),
  }));

  const { data: existing } = await supabase
    .from("transactions")
    .select("fingerprint")
    .eq("financial_account_id", meta.financial_account_id);
  const existingSet = new Set((existing ?? []).map((r) => r.fingerprint as string));

  const toInsert = withFingerprints.filter((r) => !existingSet.has(r.fingerprint));
  const skippedDuplicates = withFingerprints.length - toInsert.length;

  if (toInsert.length === 0) {
    return NextResponse.json({
      ok: true,
      imported: 0,
      skippedDuplicates,
    } satisfies ImportResponse);
  }

  const { data: categories } = await supabase
    .from("spending_categories")
    .select("id, name")
    .eq("budget_profile_id", budgetProfileId);
  const categoryByName = new Map((categories ?? []).map((c) => [c.name.toLowerCase(), c.id as string]));

  const { data: settings } = await supabase
    .from("notification_settings")
    .select("keep_statement_files")
    .eq("user_id", user.id)
    .maybeSingle();
  const keepFile = settings?.keep_statement_files === true;

  const { data: statementImport, error: importError } = await supabase
    .from("statement_imports")
    .insert({
      user_id: user.id,
      budget_profile_id: budgetProfileId,
      financial_account_id: meta.financial_account_id,
      filename: meta.filename,
      source_type: meta.source_type,
      detected_provider: meta.detected_provider,
      statement_start_date: meta.statement_start_date,
      statement_end_date: meta.statement_end_date,
      transaction_count: toInsert.length,
      import_status: toInsert.some((r) => r.needsReview) ? "review" : "completed",
      imported_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (importError || !statementImport) {
    return NextResponse.json(
      { ok: false, error: importError?.message ?? "Failed to create import record.", imported: 0, skippedDuplicates } satisfies ImportResponse,
      { status: 500 },
    );
  }

  if (keepFile && file instanceof File) {
    const path = `${user.id}/${statementImport.id}/${meta.filename}`;
    const { error: uploadError } = await supabase.storage.from("statement-files").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (!uploadError) {
      await supabase.from("statement_imports").update({ original_file_path: path }).eq("id", statementImport.id);
    }
  }

  const rowsToPersist = toInsert.map((r) => ({
    user_id: user.id,
    budget_profile_id: budgetProfileId,
    financial_account_id: meta.financial_account_id,
    statement_import_id: statementImport.id,
    transaction_date: r.transactionDate,
    posted_date: r.postedDate,
    raw_description: r.rawDescription,
    normalized_merchant: r.normalizedMerchant,
    amount: r.amount,
    direction: r.direction,
    transaction_type: r.transactionType,
    category_id: r.categoryName ? (categoryByName.get(r.categoryName.toLowerCase()) ?? null) : null,
    is_transfer: r.isTransferGuess,
    is_income: r.transactionType === "income",
    is_refund: r.transactionType === "refund",
    is_reimbursement: r.transactionType === "reimbursement",
    needs_review: r.needsReview,
    fingerprint: r.fingerprint,
  }));

  let imported = 0;
  for (const batch of chunk(rowsToPersist, INSERT_CHUNK_SIZE)) {
    const { error, count } = await supabase.from("transactions").insert(batch, { count: "exact" });
    if (!error) imported += count ?? batch.length;
  }

  // Re-run transfer/credit-card-payment matching across the whole profile
  // now that new candidates exist — this is what catches a checking
  // "TRANSFER TO SAVINGS" imported today against a savings statement
  // imported last month, not just pairs within this one file.
  if (imported > 0) {
    await reconcileTransfers(supabase, budgetProfileId);
  }

  return NextResponse.json({
    ok: true,
    statementImportId: statementImport.id,
    imported,
    skippedDuplicates,
  } satisfies ImportResponse);
}
