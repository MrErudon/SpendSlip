"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Plus, Sparkles, X, Trash2 } from "lucide-react";

import { useProfile } from "@/lib/profile-context";
import { usePlanner } from "@/lib/hooks/use-planner";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Bill, PayFrequency } from "@/lib/types";
import { PaycheckCard } from "@/components/paycheck-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

const FREQUENCIES: { value: PayFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "semimonthly", label: "Semi-monthly" },
  { value: "monthly", label: "Monthly" },
];

export function PaycheckPlanner() {
  const { activeProfileId } = useProfile();
  const {
    paychecks,
    bills,
    unassignedBills,
    loading,
    addManualPaycheck,
    autoGenerate,
    deletePaycheck,
    assignBill,
    unassignBill,
  } = usePlanner(activeProfileId);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [autoOpen, setAutoOpen] = React.useState(false);
  const assignedColumnRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (paychecks.length > 0 && !paychecks.some((p) => p.id === selectedId)) {
      setSelectedId(paychecks[0].id);
    }
    if (paychecks.length === 0) setSelectedId(null);
  }, [paychecks, selectedId]);

  const selected = paychecks.find((p) => p.id === selectedId) ?? null;

  async function handleDrop(bill: Bill, pointerX: number, pointerY: number) {
    const rect = assignedColumnRef.current?.getBoundingClientRect();
    if (!rect || !selected) return;
    const inside = pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.bottom;
    if (inside) {
      await assignBill(selected.id, bill);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between px-6 pt-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Paycheck Planner</h1>
          <p className="text-sm text-muted-foreground">Assign bills to the paycheck that covers them.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAutoOpen(true)}>
            <Sparkles />
            Auto-generate
          </Button>
          <Button onClick={() => setManualOpen(true)}>
            <Plus />
            Add paycheck
          </Button>
        </div>
      </div>

      <div className="mt-4 flex shrink-0 gap-3 overflow-x-auto px-6 pb-4 scrollbar-thin">
        {loading ? (
          <p className="py-4 text-sm text-muted-foreground">Loading paychecks…</p>
        ) : paychecks.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No paychecks yet. Add one to start planning.</p>
        ) : (
          paychecks.map((p) => (
            <PaycheckCard
              key={p.id}
              paycheck={p}
              selected={p.id === selectedId}
              unassignedCount={unassignedBills.length}
              onSelect={() => setSelectedId(p.id)}
            />
          ))
        )}
      </div>

      {selected && (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-hidden border-t border-border px-6 py-4">
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Assigned to {formatDate(selected.date)}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                onClick={() => deletePaycheck(selected.id)}
              >
                <Trash2 className="size-3.5" />
                Delete check
              </Button>
            </div>
            <div
              ref={assignedColumnRef}
              className="flex min-h-[200px] flex-1 flex-col gap-1.5 overflow-y-auto rounded-lg border border-dashed border-border p-2 scrollbar-thin"
            >
              {selected.allocations.length === 0 && (
                <p className="p-3 text-center text-xs text-muted-foreground">
                  Drag bills here, or click one on the right.
                </p>
              )}
              {selected.allocations.map((alloc) => (
                <button
                  key={alloc.id}
                  onClick={() => unassignBill(alloc.id)}
                  className="group flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/70"
                >
                  <span className="truncate">{bills.find((b) => b.id === alloc.bill_id)?.name ?? "Bill"}</span>
                  <span className="flex items-center gap-2 tabular-nums text-muted-foreground">
                    {formatCurrency(alloc.amount)}
                    <X className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <h2 className="text-sm font-semibold">Unassigned bills</h2>
            <div className="flex min-h-[200px] flex-1 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border p-2 scrollbar-thin">
              {unassignedBills.length === 0 && (
                <p className="p-3 text-center text-xs text-muted-foreground">Every bill is assigned. 🎉</p>
              )}
              {unassignedBills.map((bill) => (
                <UnassignedBillItem
                  key={bill.id}
                  bill={bill}
                  paychecks={paychecks}
                  onDrop={handleDrop}
                  onPick={(paycheckId) => assignBill(paycheckId, bill)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <AddManualPaycheckDialog open={manualOpen} onOpenChange={setManualOpen} onSave={addManualPaycheck} />
      <AutoGenerateDialog open={autoOpen} onOpenChange={setAutoOpen} onGenerate={autoGenerate} />
    </div>
  );
}

function UnassignedBillItem({
  bill,
  paychecks,
  onDrop,
  onPick,
}: {
  bill: Bill;
  paychecks: { id: string; date: string }[];
  onDrop: (bill: Bill, x: number, y: number) => void;
  onPick: (paycheckId: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <motion.div
        drag
        dragSnapToOrigin
        dragElastic={0.15}
        whileDrag={{ scale: 1.04, zIndex: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
        onDragEnd={(_, info) => onDrop(bill, info.point.x, info.point.y)}
        className="flex flex-1 cursor-grab items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm active:cursor-grabbing"
      >
        <span className="truncate">{bill.name}</span>
        <span className="tabular-nums text-muted-foreground">{formatCurrency(bill.amount)}</span>
      </motion.div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7 shrink-0">
            <Plus className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {paychecks.map((p) => (
            <DropdownMenuItem key={p.id} onSelect={() => onPick(p.id)}>
              {formatDate(p.date)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function AddManualPaycheckDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (date: string, amount: number, label: string | null) => Promise<void>;
}) {
  const [date, setDate] = React.useState("");
  const [amount, setAmount] = React.useState(0);
  const [label, setLabel] = React.useState("");

  async function handleSave() {
    if (!date || amount <= 0) return;
    await onSave(date, amount, label.trim() || null);
    onOpenChange(false);
    setDate("");
    setAmount(0);
    setLabel("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add a one-off paycheck</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Amount</Label>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Label (optional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Bonus check" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!date || amount <= 0}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AutoGenerateDialog({
  open,
  onOpenChange,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (frequency: PayFrequency, startDate: string, count: number, amount: number) => Promise<void>;
}) {
  const [frequency, setFrequency] = React.useState<PayFrequency>("biweekly");
  const [startDate, setStartDate] = React.useState("");
  const [count, setCount] = React.useState(6);
  const [amount, setAmount] = React.useState(0);

  async function handleGenerate() {
    if (!startDate || amount <= 0 || count <= 0) return;
    await onGenerate(frequency, startDate, count, amount);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Auto-generate paychecks</DialogTitle>
          <DialogDescription>Creates a series of paychecks on a repeating schedule.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as PayFrequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label># of checks</Label>
              <Input type="number" min={1} max={52} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Amount per check</Label>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={!startDate || amount <= 0}>
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
