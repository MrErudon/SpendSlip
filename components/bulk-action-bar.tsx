"use client";

import { ArrowLeftRight, Ban, Repeat, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SpendingCategory } from "@/lib/types-financial";

export function BulkActionBar({
  count,
  categories,
  onCategorize,
  onExclude,
  onMarkTransfer,
  onMarkRecurring,
  onDelete,
  onClear,
}: {
  count: number;
  categories: SpendingCategory[];
  onCategorize: (categoryId: string) => void;
  onExclude: () => void;
  onMarkTransfer: () => void;
  onMarkRecurring: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-6 py-2 text-sm">
      <Button variant="ghost" size="icon" className="size-6" onClick={onClear}>
        <X className="size-3.5" />
      </Button>
      <span className="font-medium">{count} selected</span>
      <div className="ml-auto flex items-center gap-1.5">
        <Select onValueChange={onCategorize}>
          <SelectTrigger className="h-7 w-40 text-xs">
            <SelectValue placeholder="Categorize as…" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">
                {c.emoji} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onMarkRecurring}>
          <Repeat className="size-3.5" />
          Recurring
        </Button>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onMarkTransfer}>
          <ArrowLeftRight className="size-3.5" />
          Transfer
        </Button>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onExclude}>
          <Ban className="size-3.5" />
          Exclude
        </Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}
