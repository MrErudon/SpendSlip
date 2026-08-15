"use client";

import * as React from "react";
import { MoreHorizontal, Plus } from "lucide-react";

import { useSpendingCategories, type SpendingCategoryInput } from "@/lib/hooks/use-spending-categories";
import type { SpendingTag } from "@/lib/types-financial";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const EMOJI_CHOICES = ["🗂️", "🏠", "💡", "🛒", "🍽️", "🚌", "⛽", "🛍️", "🎬", "🔁", "🏥", "💪", "✈️", "💇", "🎓", "💳", "🛡️", "🐾", "🎁", "💵"];

const TAG_OPTIONS: { value: SpendingTag | "__none"; label: string }[] = [
  { value: "__none", label: "Untagged" },
  { value: "fixed", label: "Fixed" },
  { value: "variable_essential", label: "Variable — essential" },
  { value: "discretionary", label: "Discretionary" },
  { value: "savings", label: "Savings" },
  { value: "debt", label: "Debt" },
];

const emptyForm: SpendingCategoryInput = { name: "", emoji: EMOJI_CHOICES[0], spending_tag: null, budget_amount: null };

/** Category management for transaction categorization — distinct from
 * components/category-tabs.tsx, which manages Bills categories. */
export function SpendingCategoryManager({ profileId }: { profileId: string | null }) {
  const { categories, loading, addCategory, updateCategory, archiveCategory } = useSpendingCategories(profileId);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<SpendingCategoryInput>(emptyForm);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    setEditingId(id);
    setForm({ name: cat.name, emoji: cat.emoji, spending_tag: cat.spending_tag, budget_amount: cat.budget_amount });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    if (editingId) await updateCategory(editingId, form);
    else await addCategory(form);
    setDialogOpen(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Used to categorize imported transactions.</span>
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="size-3.5" />
          Add category
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <span>{cat.emoji}</span>
              <span className="min-w-0 flex-1 truncate">{cat.name}</span>
              {cat.spending_tag && (
                <Badge variant="outline" className="text-[10px]">
                  {TAG_OPTIONS.find((t) => t.value === cat.spending_tag)?.label ?? cat.spending_tag}
                </Badge>
              )}
              {cat.budget_amount != null && (
                <span className="text-xs text-muted-foreground">{formatCurrency(cat.budget_amount)}</span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-6 shrink-0">
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => openEdit(cat.id)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => archiveCategory(cat.id)}>
                    Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Hobbies" autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_CHOICES.map((e) => (
                  <button
                    key={e}
                    onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                    className={`flex size-8 items-center justify-center rounded-md border text-base transition-colors ${
                      form.emoji === e ? "border-primary bg-primary/15" : "border-border hover:bg-secondary"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Tag</Label>
                <Select
                  value={form.spending_tag ?? "__none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, spending_tag: v === "__none" ? null : (v as SpendingTag) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAG_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Budget amount</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.budget_amount ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, budget_amount: e.target.value === "" ? null : Number(e.target.value) }))}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
