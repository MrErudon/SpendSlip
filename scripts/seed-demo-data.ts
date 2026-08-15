/**
 * Dev-only demo data seeder. NOT wired into any route, page, or API —
 * run manually against a Supabase project you control:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/seed-demo-data.ts you@example.com
 *
 * Seeds ~3 months of realistic transactions on two demo accounts
 * (checking + credit card) covering everything the statement-import
 * pipeline is meant to handle: payroll income, recurring subscriptions
 * (Netflix/Spotify), groceries/dining/gas/shopping spend, a
 * checking->credit-card payment (must be excluded from spend totals,
 * not double-counted against the card's own purchases), a refund, and a
 * few merchant-format variants for normalization. Idempotent: re-running
 * it against the same accounts skips transactions whose fingerprint
 * already exists, the same duplicate-detection path a real re-import
 * would take.
 *
 * Never run this against a production user's real account.
 */
import { createClient } from "@supabase/supabase-js";
import { computeFingerprint } from "../lib/statements/transaction-fingerprint";
import { normalizeMerchant } from "../lib/statements/normalize";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!email) {
  console.error("Usage: npx tsx scripts/seed-demo-data.ts <user_email>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface DemoRow {
  daysAgo: number;
  merchant: string; // raw, as it'd appear on a statement
  amount: number; // signed
  type: string;
}

function threeMonthsOfRows(): DemoRow[] {
  const rows: DemoRow[] = [];

  // Biweekly payroll (checking)
  for (let i = 0; i < 6; i++) {
    rows.push({ daysAgo: i * 14 + 3, merchant: "ACME CORP PAYROLL DIRECT DEP", amount: 2450, type: "checking" });
  }

  // Monthly rent (checking) — fixed housing cost
  for (let i = 0; i < 3; i++) {
    rows.push({ daysAgo: i * 30 + 1, merchant: "GREENWOOD APARTMENTS RENT", amount: -1850, type: "checking" });
  }

  // Recurring subscriptions (credit card) — should be detected as recurring
  for (let i = 0; i < 3; i++) {
    rows.push({ daysAgo: i * 30 + 5, merchant: "NETFLIX.COM", amount: -22.99, type: "credit" });
    rows.push({ daysAgo: i * 30 + 8, merchant: "SPOTIFY USA", amount: -11.99, type: "credit" });
  }

  // Groceries — several merchant-format variants for normalization
  const groceryMerchants = ["WAL-MART #4832", "TRADER JOE'S #221", "WHOLE FOODS MKT", "COSTCO WHSE #445"];
  for (let i = 0; i < 10; i++) {
    rows.push({
      daysAgo: i * 8 + 2,
      merchant: groceryMerchants[i % groceryMerchants.length],
      amount: -(40 + Math.round(Math.random() * 60)),
      type: "credit",
    });
  }

  // Dining
  const diningMerchants = ["SQ *JOES COFFEE 48392", "TST*THE LOCAL BAR", "CHIPOTLE 1122", "MCDONALD'S F4021"];
  for (let i = 0; i < 14; i++) {
    rows.push({
      daysAgo: i * 6 + 1,
      merchant: diningMerchants[i % diningMerchants.length],
      amount: -(8 + Math.round(Math.random() * 30)),
      type: "credit",
    });
  }

  // Gas, biweekly
  for (let i = 0; i < 6; i++) {
    rows.push({ daysAgo: i * 14 + 6, merchant: "SHELL OIL 57291", amount: -(35 + Math.round(Math.random() * 20)), type: "credit" });
  }

  // Shopping, occasional larger purchase — includes one refund
  rows.push({ daysAgo: 12, merchant: "AMZN Mktp US*X7A394", amount: -142.5, type: "credit" });
  rows.push({ daysAgo: 40, merchant: "AMZN Mktp US*Y2C110", amount: -487.2, type: "credit" }); // deliberately large -> "large transaction" insight
  rows.push({ daysAgo: 9, merchant: "AMAZON.COM REFUND", amount: 34.99, type: "credit" }); // refund

  // Checking -> credit card payment: must net out to zero extra spend
  for (let i = 0; i < 3; i++) {
    const amount = -(300 + i * 40);
    rows.push({ daysAgo: i * 30 + 20, merchant: "CHASE CREDIT CARD PAYMENT", amount, type: "checking" });
    rows.push({ daysAgo: i * 30 + 20, merchant: "PAYMENT THANK YOU", amount: -amount, type: "credit" });
  }

  return rows;
}

async function main() {
  const { data: usersPage, error: userErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (userErr) throw userErr;
  const user = usersPage.users.find((u) => u.email === email);
  if (!user) throw new Error(`No user found with email ${email}`);
  const userId = user.id;

  const { data: profiles } = await supabase.from("budget_profiles").select("id, is_default").eq("user_id", userId);
  const profile = profiles?.find((p) => p.is_default) ?? profiles?.[0];
  if (!profile) throw new Error("User has no budget profile yet — sign in once first.");
  const budgetProfileId = profile.id as string;

  async function ensureAccount(name: string, type: "checking" | "credit_card") {
    const { data: existing } = await supabase
      .from("financial_accounts")
      .select("id")
      .eq("budget_profile_id", budgetProfileId)
      .eq("account_name", name)
      .maybeSingle();
    if (existing) return existing.id as string;

    const { data: created, error } = await supabase
      .from("financial_accounts")
      .insert({ user_id: userId, budget_profile_id: budgetProfileId, account_name: name, account_type: type, institution_name: "Demo Bank" })
      .select("id")
      .single();
    if (error || !created) throw error;
    return created.id as string;
  }

  const checkingId = await ensureAccount("Demo Checking", "checking");
  const creditId = await ensureAccount("Demo Credit Card", "credit_card");

  const { data: existingFingerprints } = await supabase
    .from("transactions")
    .select("fingerprint")
    .in("financial_account_id", [checkingId, creditId]);
  const seen = new Set((existingFingerprints ?? []).map((r) => r.fingerprint as string));

  const rows = threeMonthsOfRows();
  const toInsert = [];
  const today = new Date();

  for (const row of rows) {
    const date = new Date(today);
    date.setDate(date.getDate() - row.daysAgo);
    const transactionDate = date.toISOString().slice(0, 10);
    const financialAccountId = row.type === "checking" ? checkingId : creditId;
    const normalizedMerchant = normalizeMerchant(row.merchant);
    const fingerprint = computeFingerprint({ financialAccountId, amount: row.amount, transactionDate, normalizedDescription: normalizedMerchant });
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    toInsert.push({
      user_id: userId,
      budget_profile_id: budgetProfileId,
      financial_account_id: financialAccountId,
      transaction_date: transactionDate,
      raw_description: row.merchant,
      normalized_merchant: normalizedMerchant,
      amount: row.amount,
      direction: row.amount < 0 ? "outflow" : "inflow",
      transaction_type: "purchase",
      fingerprint,
      needs_review: true, // left for the app's own categorization/transfer/recurring passes to resolve
    });
  }

  if (toInsert.length === 0) {
    console.log("Nothing new to seed — already up to date.");
    return;
  }

  const { error: insertError } = await supabase.from("transactions").insert(toInsert);
  if (insertError) throw insertError;

  console.log(`Seeded ${toInsert.length} demo transactions for ${email}.`);
  console.log("Open Transactions and re-run categorization by visiting Statements, or just browse — needs_review rows are visible via the \"Needs review\" filter.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
