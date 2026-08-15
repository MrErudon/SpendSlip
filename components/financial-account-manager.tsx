"use client";

import * as React from "react";
import { Landmark, MoreHorizontal, Plus } from "lucide-react";

import { useFinancialAccounts, ACCOUNT_TYPE_OPTIONS, type FinancialAccountInput } from "@/lib/hooks/use-financial-accounts";
import type { AccountType } from "@/lib/types-financial";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = Object.fromEntries(
  ACCOUNT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<AccountType, string>;

const emptyForm: FinancialAccountInput = {
  institution_name: "",
  account_name: "",
  account_type: "checking",
  last_four: "",
};

/** Reused on both the Statements page and Settings → account management. */
export function FinancialAccountManager({ profileId, compact }: { profileId: string | null; compact?: boolean }) {
  const { accounts, loading, addAccount, updateAccount, archiveAccount, deleteAccount } = useFinancialAccounts(profileId);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FinancialAccountInput>(emptyForm);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    const acct = accounts.find((a) => a.id === id);
    if (!acct) return;
    setEditingId(id);
    setForm({
      institution_name: acct.institution_name,
      account_name: acct.account_name,
      account_type: acct.account_type,
      last_four: acct.last_four,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.account_name.trim()) return;
    if (editingId) {
      await updateAccount(editingId, form);
    } else {
      await addAccount(form);
    }
    setDialogOpen(false);
  }

  async function handleDelete() {
    if (deleteId) {
      await deleteAccount(deleteId);
      setDeleteId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {!compact && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Accounts</h3>
          <Button size="sm" variant="outline" onClick={openAdd}>
            <Plus className="size-3.5" />
            Add account
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center text-muted-foreground">
          <Landmark className="size-6" />
          <p className="text-sm font-medium">No accounts yet</p>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-3.5" />
            Add your first account
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
              <Landmark className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{account.account_name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {ACCOUNT_TYPE_LABEL[account.account_type]}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {account.institution_name ?? "—"}
                  {account.last_four && ` •••• ${account.last_four}`}
                </span>
              </div>
              {compact && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7">
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => openEdit(account.id)}>Rename / edit</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => archiveAccount(account.id)}>Archive</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleteId(account.id)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
          {compact && (
            <Button size="sm" variant="outline" className="mt-1 self-start" onClick={openAdd}>
              <Plus className="size-3.5" />
              Add account
            </Button>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit account" : "Add a financial account"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Account name</Label>
              <Input
                value={form.account_name}
                onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))}
                placeholder="Chase Checking"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Institution</Label>
              <Input
                value={form.institution_name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, institution_name: e.target.value }))}
                placeholder="Chase"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Type</Label>
                <Select value={form.account_type} onValueChange={(v) => setForm((f) => ({ ...f, account_type: v as AccountType }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Last 4 digits</Label>
                <Input
                  value={form.last_four ?? ""}
                  maxLength={4}
                  onChange={(e) => setForm((f) => ({ ...f, last_four: e.target.value.replace(/\D/g, "") }))}
                  placeholder="1234"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.account_name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this account?</DialogTitle>
            <DialogDescription>
              Its imported transactions and statement history will be deleted too. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
