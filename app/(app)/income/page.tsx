"use client";

import { useProfile } from "@/lib/profile-context";
import { IncomeCalculator } from "@/components/income-calculator";

export default function IncomePage() {
  const { activeProfile } = useProfile();

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 pt-5">
        <h1 className="text-lg font-semibold tracking-tight">Income</h1>
        <p className="text-sm text-muted-foreground">
          {activeProfile ? `${activeProfile.emoji} ${activeProfile.name}` : "Loading…"}
        </p>
      </div>
      <IncomeCalculator />
    </div>
  );
}
