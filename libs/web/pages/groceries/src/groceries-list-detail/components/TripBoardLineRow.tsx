'use client';

import type { CatalogItem, ListLine } from '@myorganizer/core';
import { Checkbox } from '@myorganizer/web-ui';
import { Ban, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getCategoryEmoji } from '../../shared/constants/categories';
import { formatMoney } from '../../shared/utils';

interface TripBoardLineRowProps {
  line: ListLine;
  catalogItem: CatalogItem | undefined;
  onToggleChecked: (lineId: string) => void;
  onDeleteLine: (lineId: string) => void;
  onDeleteFromCatalog: (catalogItemId: string) => void;
  isLoading?: boolean;
}

export function TripBoardLineRow({
  line,
  catalogItem,
  onToggleChecked,
  onDeleteLine,
  onDeleteFromCatalog,
  isLoading = false,
}: TripBoardLineRowProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const itemName = catalogItem?.name ?? 'Unknown item';
  const categoryEmoji = getCategoryEmoji(catalogItem?.category ?? 'other');
  const hasPrice = typeof catalogItem?.price === 'number';

  const handleToggle = useCallback(() => {
    onToggleChecked(line.id);
  }, [line.id, onToggleChecked]);

  useEffect(() => {
    if (!isConfirmingDelete) return;
    const timer = setTimeout(() => setIsConfirmingDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [isConfirmingDelete]);

  const handleDeleteClick = useCallback(() => {
    if (isConfirmingDelete) {
      onDeleteLine(line.id);
      setIsConfirmingDelete(false);
    } else {
      setIsConfirmingDelete(true);
    }
  }, [isConfirmingDelete, line.id, onDeleteLine]);

  const handleDeleteFromCatalogClick = useCallback(() => {
    if (!catalogItem) return;
    onDeleteFromCatalog(catalogItem.id);
  }, [catalogItem, onDeleteFromCatalog]);

  return (
    <div
      data-testid={`list-line-${line.id}`}
      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
        line.checked ? 'bg-muted/20' : 'bg-card'
      }`}
    >
      <Checkbox
        checked={line.checked}
        onCheckedChange={handleToggle}
        disabled={isLoading}
        aria-label={`Toggle ${itemName}`}
      />

      <span className="text-lg shrink-0 leading-none" aria-hidden="true">
        {categoryEmoji}
      </span>

      <div className="flex flex-col min-w-0 grow">
        <span
          className={`text-sm font-semibold leading-snug transition-all ${
            line.checked
              ? 'line-through text-muted-foreground'
              : 'text-foreground'
          }`}
        >
          {itemName}
        </span>

        {(line.amount || hasPrice) && (
          <div
            className={`flex items-center gap-1 mt-0.5 transition-all ${
              line.checked ? 'opacity-50' : ''
            }`}
          >
            {line.amount && (
              <span className="text-[11px] font-medium text-muted-foreground">
                {line.amount}
              </span>
            )}
            {line.amount && hasPrice && (
              <span className="text-[11px] text-muted-foreground select-none">
                •
              </span>
            )}
            {hasPrice && (
              <span className="text-[11px] font-medium text-muted-foreground">
                {formatMoney(catalogItem?.price as number)}
              </span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleDeleteClick}
        disabled={isLoading}
        className={`p-1.5 rounded-lg shrink-0 transition-colors disabled:pointer-events-none disabled:opacity-50 ${
          isConfirmingDelete
            ? 'bg-destructive/10 text-destructive'
            : 'hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
        }`}
        aria-label={
          isConfirmingDelete
            ? `Confirm delete ${itemName}`
            : `Delete ${itemName}`
        }
        title={isConfirmingDelete ? 'Click again to confirm' : 'Delete item'}
        type="button"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {catalogItem && (
        <button
          onClick={handleDeleteFromCatalogClick}
          disabled={isLoading}
          className="p-1.5 rounded-lg shrink-0 transition-colors disabled:pointer-events-none disabled:opacity-50 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          aria-label={`Delete ${itemName} from catalog`}
          title="Delete from catalog (all lists)"
          type="button"
        >
          <Ban className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
