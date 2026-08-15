"use client";

import * as React from "react";
import { Plus, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useSharedBudgets } from "@/lib/hooks/use-shared-budgets";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SharedBudgetDetail } from "@/components/shared-budget";

const EMOJI_CHOICES = ["🤝", "🏡", "✈️", "💍", "🎓", "🚗", "🎉", "🐶"];

export default function SharedPage() {
  const supabase = React.useMemo(() => createClient(), []);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? null);
    });
  }, [supabase]);

  const { budgets, pendingInvites, loading, createBudget, acceptInvite, declineInvite } = useSharedBudgets(
    userId,
    userEmail,
  );

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  if (selectedId && userId) {
    return (
      <SharedBudgetDetail
        budgetId={selectedId}
        userId={userId}
        onBack={() => setSelectedId(null)}
        onDeleted={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between px-6 pt-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Shared Budgets</h1>
          <p className="text-sm text-muted-foreground">Save toward goals together.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          New shared budget
        </Button>
      </div>

      {pendingInvites.length > 0 && (
        <div className="mx-6 mt-4 flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
          {pendingInvites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between text-sm">
              <span>
                <strong>{invite.budget?.name ?? "A budget"}</strong> invited you as {invite.role}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => declineInvite(invite.id)}>
                  Decline
                </Button>
                <Button size="sm" onClick={() => acceptInvite(invite.id)}>
                  Accept
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : budgets.length === 0 ? (
          <div className="col-span-full flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Users className="size-8" />
            <p className="text-sm font-medium">No shared budgets yet</p>
            <p className="text-xs">Create one to start saving toward a goal together.</p>
          </div>
        ) : (
          budgets.map((budget) => (
            <button
              key={budget.id}
              onClick={() => setSelectedId(budget.id)}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-secondary/50"
            >
              <div className="flex items-center gap-2 text-base font-semibold">
                <span>{budget.emoji}</span>
                {budget.name}
              </div>
              {budget.goal_label && <p className="text-sm text-muted-foreground">{budget.goal_label}</p>}
              {budget.goal_amount != null && (
                <p className="text-sm font-medium text-primary">{formatCurrency(budget.goal_amount)} goal</p>
              )}
            </button>
          ))
        )}
      </div>

      <CreateBudgetDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={createBudget} />
    </div>
  );
}

function CreateBudgetDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: {
    name: string;
    emoji: string;
    goal_label: string | null;
    goal_amount: number | null;
    deadline: string | null;
  }) => Promise<unknown>;
}) {
  const [name, setName] = React.useState("");
  const [emoji, setEmoji] = React.useState(EMOJI_CHOICES[0]);
  const [goalLabel, setGoalLabel] = React.useState("");
  const [goalAmount, setGoalAmount] = React.useState(0);
  const [deadline, setDeadline] = React.useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    await onCreate({
      name: name.trim(),
      emoji,
      goal_label: goalLabel.trim() || null,
      goal_amount: goalAmount || null,
      deadline: deadline || null,
    });
    onOpenChange(false);
    setName("");
    setGoalLabel("");
    setGoalAmount(0);
    setDeadline("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New shared budget</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Our vacation fund" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Emoji</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`flex size-8 items-center justify-center rounded-md border text-base transition-colors ${
                    emoji === e ? "border-primary bg-primary/15" : "border-border hover:bg-secondary"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Goal label</Label>
            <Input value={goalLabel} onChange={(e) => setGoalLabel(e.target.value)} placeholder="Trip to Japan" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Goal amount</Label>
              <Input type="number" min={0} value={goalAmount} onChange={(e) => setGoalAmount(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Deadline</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
