"use client";

import * as React from "react";

import { useProfile } from "@/lib/profile-context";
import { StatementUploader } from "@/components/statement-uploader";
import { ImportHistoryList } from "@/components/import-history-list";

export default function StatementsPage() {
  const { activeProfile, activeProfileId } = useProfile();
  const historyRef = React.useRef<{ refresh: () => void }>(null);

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <div className="shrink-0 px-6 pt-5">
        <h1 className="text-lg font-semibold tracking-tight">Statements</h1>
        <p className="text-sm text-muted-foreground">
          {activeProfile ? `${activeProfile.emoji} ${activeProfile.name}` : "Loading…"} · Upload a bank or
          credit-card statement to start building your spending history.
        </p>
      </div>

      <div className="flex flex-col gap-8 px-6 py-5">
        <StatementUploader profileId={activeProfileId} onImported={() => historyRef.current?.refresh()} />
        <ImportHistoryList profileId={activeProfileId} ref={historyRef} />
      </div>
    </div>
  );
}
