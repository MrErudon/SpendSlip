"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationSettings } from "@/lib/types";

export function useNotificationSettings(userId: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  const [settings, setSettings] = React.useState<NotificationSettings | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase.from("notification_settings").select("*").eq("user_id", userId).maybeSingle();
    setSettings((data as NotificationSettings) ?? null);
    setLoading(false);
  }, [supabase, userId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const update = React.useCallback(
    async (patch: Partial<Pick<NotificationSettings, "email_reminders" | "reminder_days">>) => {
      if (!userId) return;
      setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
      if (settings?.id) {
        await supabase.from("notification_settings").update(patch).eq("id", settings.id);
      } else {
        const { data } = await supabase
          .from("notification_settings")
          .insert({ user_id: userId, ...patch })
          .select()
          .single();
        if (data) setSettings(data as NotificationSettings);
      }
    },
    [supabase, userId, settings?.id],
  );

  return { settings, loading, update };
}
