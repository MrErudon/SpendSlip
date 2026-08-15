"use client";

import * as React from "react";
import { ArrowLeft, MoreHorizontal, Plus, Trash2, UserPlus } from "lucide-react";

import { useSharedBudgetDetail } from "@/lib/hooks/use-shared-budget-detail";
import { formatCurrency, formatDateLong, initials } from "@/lib/utils";
import type { MemberRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GoalProgress } from "@/components/goal-progress";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

export function SharedBudgetDetail({
  budgetId,
  userId,
  onBack,
  onDeleted,
}: {
  budgetId: string;
  userId: string;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const {
    budget,
    members,
    incomes,
    contributions,
    loading,
    myMember,
    isOwner,
    inviteMember,
    removeMember,
    setMyIncome,
    logContribution,
    updateBudget,
    deleteBudget,
  } = useSharedBudgetDetail(budgetId, userId);

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [contribOpen, setContribOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [myIncomeInput, setMyIncomeInput] = React.useState("");

  const myIncomeRow = incomes.find((i) => i.member_id === myMember?.id);
  React.useEffect(() => {
    setMyIncomeInput(myIncomeRow ? String(myIncomeRow.net_monthly_income) : "");
  }, [myIncomeRow]);

  if (loading || !budget) {
    return <div className="px-6 py-10 text-sm text-muted-foreground">Loading…</div>;
  }

  const totalIncome = incomes.reduce((sum, i) => sum + Number(i.net_monthly_income), 0);
  const totalContributed = contributions.reduce((sum, c) => sum + Number(c.amount), 0);

  async function handleDelete() {
    await deleteBudget();
    onDeleted();
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between px-6 pt-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span>{budget.emoji}</span> {budget.name}
            </h1>
            {budget.goal_label && <p className="text-sm text-muted-foreground">{budget.goal_label}</p>}
          </div>
        </div>
        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>Edit budget</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                Delete budget
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 py-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Goal progress</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <GoalProgress
              label={budget.goal_label ?? "Goal"}
              contributed={totalContributed}
              goal={budget.goal_amount ?? 0}
              deadline={budget.deadline}
            />
            <Button size="sm" variant="outline" className="self-start" onClick={() => setContribOpen(true)}>
              <Plus className="size-3.5" />
              Log contribution
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Combined overview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Combined net income</span>
              <span className="font-semibold">{formatCurrency(totalIncome)}/mo</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total contributed</span>
              <span className="font-semibold">{formatCurrency(totalContributed)}</span>
            </div>
            <div className="flex flex-col gap-1.5 border-t border-border pt-3">
              <Label className="text-xs text-muted-foreground">Your monthly net income (private entry)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  value={myIncomeInput}
                  onChange={(e) => setMyIncomeInput(e.target.value)}
                />
                <Button size="sm" onClick={() => setMyIncome(Number(myIncomeInput) || 0)}>
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="px-6 pb-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Members</CardTitle>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                <UserPlus className="size-3.5" />
                Invite
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {members.map((member) => {
              const income = incomes.find((i) => i.member_id === member.id)?.net_monthly_income ?? 0;
              const pct = totalIncome > 0 ? (income / totalIncome) * 100 : 0;
              const contributed = contributions
                .filter((c) => c.member_id === member.id)
                .reduce((sum, c) => sum + Number(c.amount), 0);

              return (
                <div key={member.id} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
                  <Avatar className="size-8">
                    <AvatarFallback>{initials(member.display_name ?? member.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{member.display_name ?? member.email}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {member.role}
                      </Badge>
                      {member.status === "pending" && (
                        <Badge variant="warning" className="text-[10px]">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{member.email}</span>
                  </div>
                  <div className="hidden text-right text-xs text-muted-foreground sm:block">
                    <div>{formatCurrency(income)}/mo · {pct.toFixed(0)}%</div>
                    <div>{formatCurrency(contributed)} contributed</div>
                  </div>
                  {isOwner && member.user_id !== userId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => removeMember(member.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="px-6 pb-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent contributions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {contributions.length === 0 && <p className="text-sm text-muted-foreground">No contributions logged yet.</p>}
            {contributions.map((c) => {
              const member = members.find((m) => m.id === c.member_id);
              return (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{member?.display_name ?? member?.email ?? "Someone"}</span>
                    {c.note && <span className="text-muted-foreground"> — {c.note}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-medium text-success">{formatCurrency(c.amount)}</span>
                    <span className="text-xs text-muted-foreground">{formatDateLong(c.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvite={inviteMember} />
      <ContributionDialog open={contribOpen} onOpenChange={setContribOpen} onLog={logContribution} />
      <EditBudgetDialog open={settingsOpen} onOpenChange={setSettingsOpen} budget={budget} onSave={updateBudget} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this shared budget?</DialogTitle>
            <DialogDescription>All members, income entries, and contributions will be removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
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

function InviteDialog({
  open,
  onOpenChange,
  onInvite,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (email: string, role: MemberRole) => Promise<void>;
}) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<MemberRole>("editor");

  async function handleInvite() {
    if (!email.trim()) return;
    await onInvite(email.trim(), role);
    onOpenChange(false);
    setEmail("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>They&apos;ll see this invite the next time they sign in.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={!email.trim()}>
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContributionDialog({
  open,
  onOpenChange,
  onLog,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLog: (amount: number, note: string | null) => Promise<void>;
}) {
  const [amount, setAmount] = React.useState(0);
  const [note, setNote] = React.useState("");

  async function handleLog() {
    if (amount <= 0) return;
    await onLog(amount, note.trim() || null);
    onOpenChange(false);
    setAmount(0);
    setNote("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log a contribution</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Amount</Label>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="From this week's OT" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleLog} disabled={amount <= 0}>
            Log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditBudgetDialog({
  open,
  onOpenChange,
  budget,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: { name: string; emoji: string; goal_label: string | null; goal_amount: number | null; deadline: string | null };
  onSave: (input: {
    name: string;
    emoji: string;
    goal_label: string | null;
    goal_amount: number | null;
    deadline: string | null;
  }) => Promise<void>;
}) {
  const [name, setName] = React.useState(budget.name);
  const [goalLabel, setGoalLabel] = React.useState(budget.goal_label ?? "");
  const [goalAmount, setGoalAmount] = React.useState(budget.goal_amount ?? 0);
  const [deadline, setDeadline] = React.useState(budget.deadline ?? "");

  React.useEffect(() => {
    setName(budget.name);
    setGoalLabel(budget.goal_label ?? "");
    setGoalAmount(budget.goal_amount ?? 0);
    setDeadline(budget.deadline ?? "");
  }, [budget]);

  async function handleSave() {
    await onSave({
      name: name.trim(),
      emoji: budget.emoji,
      goal_label: goalLabel.trim() || null,
      goal_amount: goalAmount || null,
      deadline: deadline || null,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit shared budget</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Goal label</Label>
            <Input value={goalLabel} onChange={(e) => setGoalLabel(e.target.value)} />
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
          <Button onClick={handleSave} disabled={!name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
