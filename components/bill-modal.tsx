"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

import type { BillCategory, Recurrence } from "@/lib/types";
import type { BillInput, BillWithOccurrence } from "@/lib/hooks/use-bills";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "weekly", label: "Weekly" },
  { value: "annual", label: "Annual" },
];

interface BillPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: BillCategory[];
  defaultCategoryId: string | null;
  bill: BillWithOccurrence | null;
  onSave: (input: BillInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const emptyForm: BillInput = {
  name: "",
  amount: 0,
  due_day: 1,
  payment_url: "",
  recurrence: "monthly",
  autopay: false,
  notes: "",
  category_id: "",
};

export function BillPanel({ open, onOpenChange, categories, defaultCategoryId, bill, onSave, onDelete }: BillPanelProps) {
  const [form, setForm] = React.useState<BillInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (bill) {
      setForm({
        name: bill.name,
        amount: bill.amount,
        due_day: bill.due_day,
        payment_url: bill.payment_url ?? "",
        recurrence: bill.recurrence,
        autopay: bill.autopay,
        notes: bill.notes ?? "",
        category_id: bill.category_id,
      });
    } else {
      setForm({ ...emptyForm, category_id: defaultCategoryId ?? categories[0]?.id ?? "" });
    }
  }, [bill, defaultCategoryId, categories]);

  async function handleSave() {
    if (!form.name.trim() || !form.category_id) return;
    setSaving(true);
    await onSave(
      {
        ...form,
        name: form.name.trim(),
        payment_url: form.payment_url?.trim() || null,
        notes: form.notes?.trim() || null,
      },
      bill?.id,
    );
    setSaving(false);
    onOpenChange(false);
  }

  async function handleDelete() {
    if (bill) {
      await onDelete(bill.id);
      onOpenChange(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col p-0">
        <SheetHeader>
          <SheetTitle>{bill ? "Edit bill" : "New bill"}</SheetTitle>
          <SheetDescription>
            {bill ? "Update the details for this bill." : "Add a bill to track its due date and payments."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4 scrollbar-thin">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bill-name">Name</Label>
            <Input
              id="bill-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Rent"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bill-amount">Amount</Label>
              <Input
                id="bill-amount"
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Due day</Label>
              <Select
                value={String(form.due_day)}
                onValueChange={(v) => setForm((f) => ({ ...f, due_day: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Recurrence</Label>
              <Select
                value={form.recurrence}
                onValueChange={(v) => setForm((f) => ({ ...f, recurrence: v as Recurrence }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bill-url">Payment URL</Label>
            <Input
              id="bill-url"
              type="url"
              value={form.payment_url ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, payment_url: e.target.value }))}
              placeholder="https://"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
            <div className="flex flex-col">
              <Label htmlFor="bill-autopay">Autopay</Label>
              <span className="text-xs text-muted-foreground">This bill is paid automatically.</span>
            </div>
            <Switch
              id="bill-autopay"
              checked={form.autopay}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, autopay: checked }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bill-notes">Notes</Label>
            <Textarea
              id="bill-notes"
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes"
            />
          </div>
        </div>

        <SheetFooter className="flex-row justify-between gap-2 border-t border-border pt-4">
          {bill ? (
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete}>
              <Trash2 />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              Save
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
