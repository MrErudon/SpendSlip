"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { BudgetProfile } from "@/lib/types";

interface ProfileContextValue {
  userId: string;
  profiles: BudgetProfile[];
  activeProfile: BudgetProfile | null;
  activeProfileId: string | null;
  setActiveProfileId: (id: string) => void;
  loading: boolean;
  refreshProfiles: () => Promise<void>;
  createProfile: (name: string, emoji: string) => Promise<BudgetProfile | null>;
  renameProfile: (id: string, name: string, emoji: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
}

const ProfileContext = React.createContext<ProfileContextValue | null>(null);

const STORAGE_KEY_PREFIX = "spendslip:activeProfile:";

export function ProfileProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [profiles, setProfiles] = React.useState<BudgetProfile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refreshProfiles = React.useCallback(async () => {
    const { data } = await supabase
      .from("budget_profiles")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    const list = (data ?? []) as BudgetProfile[];
    setProfiles(list);

    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_PREFIX + userId) : null;
    const stillExists = stored && list.some((p) => p.id === stored);
    if (stillExists) {
      setActiveProfileIdState(stored);
    } else if (list.length > 0) {
      const fallback = list.find((p) => p.is_default) ?? list[0];
      setActiveProfileIdState(fallback.id);
    }
    setLoading(false);
  }, [supabase, userId]);

  React.useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  const setActiveProfileId = React.useCallback(
    (id: string) => {
      setActiveProfileIdState(id);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_PREFIX + userId, id);
      }
    },
    [userId],
  );

  const createProfile = React.useCallback(
    async (name: string, emoji: string) => {
      const { data, error } = await supabase
        .from("budget_profiles")
        .insert({ user_id: userId, name, emoji, sort_order: profiles.length })
        .select()
        .single();
      if (error || !data) return null;

      // Seed starter categories for the new profile, same as signup.
      await supabase.from("bill_categories").insert([
        { profile_id: data.id, name: "Bills", sort_order: 0 },
        { profile_id: data.id, name: "Credit Cards", sort_order: 1 },
        { profile_id: data.id, name: "Loans", sort_order: 2 },
        { profile_id: data.id, name: "Subscriptions", sort_order: 3 },
      ]);
      await supabase.from("income_settings").insert({ profile_id: data.id });

      await refreshProfiles();
      setActiveProfileId(data.id);
      return data as BudgetProfile;
    },
    [supabase, userId, profiles.length, refreshProfiles, setActiveProfileId],
  );

  const renameProfile = React.useCallback(
    async (id: string, name: string, emoji: string) => {
      await supabase.from("budget_profiles").update({ name, emoji }).eq("id", id);
      await refreshProfiles();
    },
    [supabase, refreshProfiles],
  );

  const deleteProfile = React.useCallback(
    async (id: string) => {
      await supabase.from("budget_profiles").delete().eq("id", id);
      if (activeProfileId === id) {
        localStorage.removeItem(STORAGE_KEY_PREFIX + userId);
      }
      await refreshProfiles();
    },
    [supabase, refreshProfiles, activeProfileId, userId],
  );

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  return (
    <ProfileContext.Provider
      value={{
        userId,
        profiles,
        activeProfile,
        activeProfileId,
        setActiveProfileId,
        loading,
        refreshProfiles,
        createProfile,
        renameProfile,
        deleteProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = React.useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within a ProfileProvider");
  return ctx;
}
