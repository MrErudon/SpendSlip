"use client";

import * as React from "react";

import { formatCurrency, formatDateLong } from "@/lib/utils";
import type { TransactionRow } from "@/lib/hooks/use-transactions";
import type { SpendingCategory, Transaction, TransactionType } from "@/lib/types-financial";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TRANSACTION_TYPES: TransactionType[] = [
  "purchase",
  "income",
  "transfer",
  "credit_card_payment",
  "loan_payment",
  "refund",
  "reimbursement",
  "cash_withdrawal",
  "fee",
  "interest",
  "other",
];

export function TransactionDetailPanel({
  transaction,
  categories,
  onOpenChange,
  onSave,
  onCreateMerchantRule,
}: {
  transaction: TransactionRow | null;
  categories: SpendingCategory[];
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: Partial<Transaction>) => Promise<void>;
  onCreateMerchantRule: (merchantPattern: string, categoryId: string, applyToExisting: boolean) => Promise<void>;
}) {
  const [merchant, setMerchant] = React.useState("");
  const [categoryId, setCategoryId] = React.useState<string>("__none");
  const [transactionType, setTransactionType] = React.useState<TransactionType>("purchase");
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [isExcluded, setIsExcluded] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [offerRule, setOfferRule] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (transaction) {
      setMerchant(transaction.normalized_merchant);
      setCategoryId(transaction.category_id ?? "__none");
      setTransactionType(transaction.transaction_type);
      setIsRecurring(transaction.is_recurring);
      setIsExcluded(transaction.is_excluded);
      setNotes(transaction.user_notes ?? "");
      setOfferRule(false);
    }
  }, [transaction]);

  if (!transaction) return null;

  async function handleSave() {
    if (!transaction) return;
    setSaving(true);
    await onSave(transaction.id, {
      normalized_merchant: merchant,
      category_id: categoryId === "__none" ? null : categoryId,
      transaction_type: transactionType,
      is_recurring: isRecurring,
      is_excluded: isExcluded,
      needs_review: false,
      user_notes: notes.trim() || null,
    });
    if (offerRule && categoryId !== "__none") {
      await onCreateMerchantRule(merchant, categoryId, true);
    }
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Sheet open={Boolean(transaction)} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col p-0">
        <SheetHeader>
          <SheetTitle>{transaction.raw_description}</SheetTitle>
          <SheetDescription>
            {formatDateLong(transaction.transaction_date)} · {formatCurrency(transaction.amount)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4 scrollbar-thin">
          <div className="flex flex-col gap-1.5">
            <Label>Merchant</Label>
            <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v);
                setOfferRule(v !== "__none" && v !== (transaction.category_id ?? "__none"));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Needs review</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {offerRule && (
              <label className="mt-1 flex items-center gap-2 rounded-md bg-secondary/60 px-2.5 py-2 text-xs">
                <input
                  type="checkbox"
                  className="size-3.5"
                  defaultChecked
                  onChange={(e) => setOfferRule(e.target.checked)}
                />
                Always categorize &quot;{merchant}&quot; this way?
              </label>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Transaction type</Label>
            <Select value={transactionType} onValueChange={(v) => setTransactionType(v as TransactionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
            <Label htmlFor="txn-recurring">Recurring</Label>
            <Switch id="txn-recurring" checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
            <div>
              <Label htmlFor="txn-excluded">Exclude from totals</Label>
              <p className="text-xs text-muted-foreground">Won&apos;t count toward spending or budgets.</p>
            </div>
            <Switch id="txn-excluded" checked={isExcluded} onCheckedChange={setIsExcluded} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
