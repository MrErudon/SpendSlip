"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BillCategory } from "@/lib/types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CategoryTabsProps {
  categories: BillCategory[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export function CategoryTabs({ categories, activeId, onSelect, onAdd, onRename, onRemove }: CategoryTabsProps) {
  const [dialogMode, setDialogMode] = React.useState<"add" | "rename" | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [removeId, setRemoveId] = React.useState<string | null>(null);

  function openAdd() {
    setName("");
    setDialogMode("add");
  }

  function openRename(cat: BillCategory) {
    setEditingId(cat.id);
    setName(cat.name);
    setDialogMode("rename");
  }

  async function handleSave() {
    if (!name.trim()) return;
    if (dialogMode === "add") {
      await onAdd(name.trim());
    } else if (dialogMode === "rename" && editingId) {
      await onRename(editingId, name.trim());
    }
    setDialogMode(null);
  }

  async function handleRemove() {
    if (removeId) {
      await onRemove(removeId);
      setRemoveId(null);
    }
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-4 pt-3 scrollbar-thin">
      {categories.map((cat) => (
        <ContextMenu key={cat.id}>
          <ContextMenuTrigger asChild>
            <button
              onClick={() => onSelect(cat.id)}
              className={cn(
                "shrink-0 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                cat.id === activeId
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {cat.name}
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => openRename(cat)}>Rename</ContextMenuItem>
            <ContextMenuItem variant="destructive" onSelect={() => setRemoveId(cat.id)}>
              Remove
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
      <button
        onClick={openAdd}
        className="flex shrink-0 items-center gap-1 rounded-t-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Add category"
      >
        <Plus className="size-4" />
      </button>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialogMode === "add" ? "New category" : "Rename category"}</DialogTitle>
          </DialogHeader>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Utilities"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
          />
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

      <Dialog open={removeId !== null} onOpenChange={(open) => !open && setRemoveId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove category?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bills in this category will be removed too. This can&apos;t be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
