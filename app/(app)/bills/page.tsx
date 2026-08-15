"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { useProfile } from "@/lib/profile-context";
import { useBills, type BillWithOccurrence, type BillInput } from "@/lib/hooks/use-bills";
import { Button } from "@/components/ui/button";
import { CategoryTabs } from "@/components/category-tabs";
import { BillList } from "@/components/bill-list";
import { BillPanel } from "@/components/bill-modal";

export default function BillsPage() {
  const { activeProfile, activeProfileId } = useProfile();
  const {
    categories,
    bills,
    loading,
    addCategory,
    renameCategory,
    removeCategory,
    addBill,
    updateBill,
    deleteBill,
    toggleOccurrencePaid,
  } = useBills(activeProfileId);

  const [activeCategoryId, setActiveCategoryId] = React.useState<string | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [editingBill, setEditingBill] = React.useState<BillWithOccurrence | null>(null);

  React.useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.id === activeCategoryId)) {
      setActiveCategoryId(categories[0].id);
    }
  }, [categories, activeCategoryId]);

  const visibleBills = React.useMemo(
    () => bills.filter((b) => b.category_id === activeCategoryId),
    [bills, activeCategoryId],
  );

  function openNewBill() {
    setEditingBill(null);
    setPanelOpen(true);
  }

  function openBill(bill: BillWithOccurrence) {
    setEditingBill(bill);
    setPanelOpen(true);
  }

  async function handleSave(input: BillInput, id?: string) {
    if (id) {
      await updateBill(id, input);
    } else {
      await addBill(input);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between px-6 pt-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Bills</h1>
          <p className="text-sm text-muted-foreground">
            {activeProfile ? `${activeProfile.emoji} ${activeProfile.name}` : "Loading…"}
          </p>
        </div>
        <Button onClick={openNewBill} disabled={categories.length === 0}>
          <Plus />
          Add bill
        </Button>
      </div>

      <CategoryTabs
        categories={categories}
        activeId={activeCategoryId}
        onSelect={setActiveCategoryId}
        onAdd={addCategory}
        onRename={renameCategory}
        onRemove={removeCategory}
      />

      <BillList bills={visibleBills} loading={loading} onOpen={openBill} onTogglePaid={toggleOccurrencePaid} />

      <BillPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        categories={categories}
        defaultCategoryId={activeCategoryId}
        bill={editingBill}
        onSave={handleSave}
        onDelete={deleteBill}
      />
    </div>
  );
}
