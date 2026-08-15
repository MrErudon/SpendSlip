"use client";

import * as React from "react";
import { Plus, MoreHorizontal } from "lucide-react";

import { useProfile } from "@/lib/profile-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const EMOJI_CHOICES = ["🏠", "💼", "✈️", "🎓", "👨‍👩‍👧", "🐾", "🎮", "🏋️", "🚗", "🛒", "💳", "📈", "🎉", "🧾", "❤️", "⭐️"];

export function ProfileSwitcher() {
  const { profiles, activeProfileId, setActiveProfileId, createProfile, renameProfile, deleteProfile } =
    useProfile();

  const [dialogMode, setDialogMode] = React.useState<"create" | "rename" | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [emoji, setEmoji] = React.useState(EMOJI_CHOICES[0]);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  function openCreate() {
    setName("");
    setEmoji(EMOJI_CHOICES[0]);
    setDialogMode("create");
  }

  function openRename(id: string, currentName: string, currentEmoji: string) {
    setEditingId(id);
    setName(currentName);
    setEmoji(currentEmoji);
    setDialogMode("rename");
  }

  async function handleSave() {
    if (!name.trim()) return;
    if (dialogMode === "create") {
      await createProfile(name.trim(), emoji);
    } else if (dialogMode === "rename" && editingId) {
      await renameProfile(editingId, name.trim(), emoji);
    }
    setDialogMode(null);
  }

  async function handleDelete() {
    if (deleteId) {
      await deleteProfile(deleteId);
      setDeleteId(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
      {profiles.map((profile) => (
        <ContextMenu key={profile.id}>
          <ContextMenuTrigger asChild>
            <div className="group relative">
              <button
                onClick={() => setActiveProfileId(profile.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  profile.id === activeProfileId
                    ? "border-primary/40 bg-primary/15 text-foreground"
                    : "border-transparent bg-transparent text-muted-foreground hover:bg-secondary",
                )}
              >
                <span>{profile.emoji}</span>
                <span className="max-w-[80px] truncate">{profile.name}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="absolute -right-1 -top-1 hidden size-4 items-center justify-center rounded-full bg-secondary text-muted-foreground group-hover:flex"
                    aria-label={`${profile.name} options`}
                  >
                    <MoreHorizontal className="size-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={() => openRename(profile.id, profile.name, profile.emoji)}>
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={profiles.length <= 1}
                    onSelect={() => setDeleteId(profile.id)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => openRename(profile.id, profile.name, profile.emoji)}>
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              variant="destructive"
              disabled={profiles.length <= 1}
              onSelect={() => setDeleteId(profile.id)}
            >
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}

      <Button
        variant="ghost"
        size="icon"
        className="size-6 rounded-full text-muted-foreground"
        onClick={openCreate}
        aria-label="Add profile"
      >
        <Plus className="size-3.5" />
      </Button>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "New budget profile" : "Rename profile"}</DialogTitle>
            <DialogDescription>Separate bills, income, and categories for this profile.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-name">Name</Label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Business" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_CHOICES.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md border text-base transition-colors",
                      emoji === e ? "border-primary bg-primary/15" : "border-border hover:bg-secondary",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete profile?</DialogTitle>
            <DialogDescription>
              This permanently removes the profile and all of its bills, income settings, and paychecks.
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
