"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Loader2, LogOut, Moon, Sun, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useNotificationSettings } from "@/lib/hooks/use-notification-settings";
import { useProfile } from "@/lib/profile-context";
import { cn } from "@/lib/utils";
import { FinancialAccountManager } from "@/components/financial-account-manager";
import { SpendingCategoryManager } from "@/components/spending-category-manager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

const REMINDER_DAY_OPTIONS = [1, 3, 5, 7];

export default function SettingsPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const { theme, setTheme } = useTheme();
  const { activeProfileId } = useProfile();

  const [userId, setUserId] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [nameSaving, setNameSaving] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? "");
      setDisplayName((data.user?.user_metadata?.display_name as string) ?? "");
    });
  }, [supabase]);

  const { settings, loading, update } = useNotificationSettings(userId);

  async function handleSaveName() {
    setNameSaving(true);
    await supabase.auth.updateUser({ data: { display_name: displayName } });
    setNameSaving(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account", { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      router.push("/login");
      router.refresh();
    }
  }

  function toggleReminderDay(day: number) {
    if (!settings) return;
    const has = settings.reminder_days.includes(day);
    const next = has ? settings.reminder_days.filter((d) => d !== day) : [...settings.reminder_days, day].sort((a, b) => a - b);
    update({ reminder_days: next });
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-5 overflow-y-auto px-6 py-5 scrollbar-thin">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Get an email when a bill is coming due.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email-reminders">Email reminders</Label>
              <p className="text-xs text-muted-foreground">Sent daily for upcoming bills.</p>
            </div>
            <Switch
              id="email-reminders"
              checked={settings?.email_reminders ?? false}
              disabled={loading}
              onCheckedChange={(checked) => update({ email_reminders: checked })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Remind me this many days before due</Label>
            <div className="flex gap-2">
              {REMINDER_DAY_OPTIONS.map((day) => {
                const active = settings?.reminder_days.includes(day) ?? false;
                return (
                  <button
                    key={day}
                    onClick={() => toggleReminderDay(day)}
                    disabled={loading}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                      active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {day}d
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statement imports</CardTitle>
          <CardDescription>Controls what happens to the original file after a statement is parsed.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="keep-files">Keep original statement files</Label>
              <p className="text-xs text-muted-foreground">
                Off by default — files are deleted right after parsing. When on, they&apos;re stored privately and
                scoped to your account only.
              </p>
            </div>
            <Switch
              id="keep-files"
              checked={settings?.keep_statement_files ?? false}
              disabled={loading}
              onCheckedChange={(checked) => update({ keep_statement_files: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financial accounts</CardTitle>
          <CardDescription>The checking, savings, and credit-card accounts you import statements into.</CardDescription>
        </CardHeader>
        <CardContent>
          <FinancialAccountManager profileId={activeProfileId} compact />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spending categories</CardTitle>
          <CardDescription>Used to categorize imported transactions — separate from your Bills categories.</CardDescription>
        </CardHeader>
        <CardContent>
          <SpendingCategoryManager profileId={activeProfileId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("dark")}
            >
              <Moon className="size-3.5" />
              Dark
            </Button>
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("light")}
            >
              <Sun className="size-3.5" />
              Light
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Display name</Label>
            <div className="flex gap-2">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
              <Button variant="outline" onClick={handleSaveName} disabled={nameSaving}>
                {nameSaving && <Loader2 className="size-3.5 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input value={email} disabled />
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-xs text-muted-foreground">End your session on this device.</p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-xs text-muted-foreground">Permanently deletes all your data. Cannot be undone.</p>
            </div>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-3.5" />
              Delete account
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your profiles, bills, income settings, and shared budget memberships. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
              {deleting && <Loader2 className="size-3.5 animate-spin" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
