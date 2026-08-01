'use client';

import { Button } from '@myorganizer/web-ui';
import { Plus, Trash2 } from 'lucide-react';

interface TripBoardLifecycleToolbarProps {
  checkedCount: number;
  onUncheckAll: () => void;
  onRemoveChecked: () => void;
  onAddItem: () => void;
  isLoading?: boolean;
}

export function TripBoardLifecycleToolbar({
  checkedCount,
  onUncheckAll,
  onRemoveChecked,
  onAddItem,
  isLoading = false,
}: TripBoardLifecycleToolbarProps) {
  const hasCheckedItems = checkedCount > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onAddItem} disabled={isLoading} className="gap-2">
        <Plus className="h-4 w-4" />
        Add Item
      </Button>

      <Button
        variant="outline"
        onClick={onUncheckAll}
        disabled={isLoading || !hasCheckedItems}
      >
        Uncheck All
      </Button>

      <Button
        variant="destructive"
        onClick={onRemoveChecked}
        disabled={isLoading || !hasCheckedItems}
        className="gap-2"
      >
        <Trash2 className="h-4 w-4" />
        Remove Checked ({checkedCount})
      </Button>
    </div>
  );
}
