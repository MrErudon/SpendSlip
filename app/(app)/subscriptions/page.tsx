"use client";

import { Loader2, RefreshCw, Repeat } from "lucide-react";

import { useProfile } from "@/lib/profile-context";
import { useRecurringGroups } from "@/lib/hooks/use-recurring";
import { useBills } from "@/lib/hooks/use-bills";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SubscriptionCard } from "@/components/subscription-card";

export default function SubscriptionsPage() {
  const { activeProfile, activeProfileId } = useProfile();
  const { groups, loading, scanning, metrics, rescan, confirm, ignore, attachToBill, createBillFromGroup } =
    useRecurringGroups(activeProfileId);
  const { bills } = useBills(activeProfileId);

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between px-6 pt-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">
            {activeProfile ? `${activeProfile.emoji} ${activeProfile.name}` : "Loading…"} · Recurring charges found in
            your transaction history.
          </p>
        </div>
        <Button variant="outline" onClick={rescan} disabled={scanning}>
          {scanning ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Re-scan
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 px-6 pt-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Monthly recurring spend</p>
            <p className="text-lg font-semibold tabular-nums">{formatCurrency(metrics.monthlyTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Annual recurring spend</p>
            <p className="text-lg font-semibold tabular-nums">{formatCurrency(metrics.annualTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Subscriptions detected</p>
            <p className="text-lg font-semibold tabular-nums">{metrics.count}</p>
          </CardContent>
        </Card>
      </div>

      <div className="px-6 py-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Repeat className="size-8" />
            <p className="text-sm font-medium">No recurring charges detected yet</p>
            <p className="text-xs">Import a few months of statements, then re-scan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <SubscriptionCard
                key={group.id}
                group={group}
                bills={bills}
                onConfirm={() => confirm(group.id)}
                onIgnore={() => ignore(group.id)}
                onAttach={(billId) => attachToBill(group.id, billId)}
                onCreateBill={() => createBillFromGroup(group, group.category_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
