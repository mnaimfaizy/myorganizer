'use client';

import type { CatalogItem, ListLine } from '@myorganizer/core';
import {
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from '@myorganizer/web-ui';
import {
  AlertTriangle,
  Edit2,
  FileText,
  Link2,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  getCategoryEmoji,
  getCategoryLabel,
} from '../../shared/constants/categories';
import { formatMoney } from '../../shared/utils';

interface TripBoardLineRowProps {
  line: ListLine;
  catalogItem: CatalogItem | undefined;
  onToggleChecked: (lineId: string) => void;
  onDeleteLine: (lineId: string) => void;
  onDeleteFromCatalog: (catalogItemId: string) => void;
  onEditListLine: (lineId: string) => void;
  onEditCatalogItem: (catalogItemId: string) => void;
  isLoading?: boolean;
}

export function TripBoardLineRow({
  line,
  catalogItem,
  onToggleChecked,
  onDeleteLine,
  onDeleteFromCatalog,
  onEditListLine,
  onEditCatalogItem,
  isLoading = false,
}: TripBoardLineRowProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const itemName = catalogItem?.name ?? 'Unknown item';
  const category = catalogItem?.category ?? 'other';
  const categoryEmoji = getCategoryEmoji(category);
  const hasPrice = typeof catalogItem?.price === 'number';

  const handleToggle = useCallback(() => {
    onToggleChecked(line.id);
  }, [line.id, onToggleChecked]);

  const handleEditLine = useCallback(() => {
    onEditListLine(line.id);
  }, [line.id, onEditListLine]);

  const handleEditCatalog = useCallback(() => {
    if (catalogItem) onEditCatalogItem(catalogItem.id);
  }, [catalogItem, onEditCatalogItem]);

  useEffect(() => {
    if (!isConfirmingDelete) return;
    const timer = setTimeout(() => setIsConfirmingDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [isConfirmingDelete]);

  const handleRemoveSelect = useCallback(
    (event: Event) => {
      if (isConfirmingDelete) {
        onDeleteLine(line.id);
        setIsConfirmingDelete(false);
        return;
      }
      event.preventDefault();
      setIsConfirmingDelete(true);
    },
    [isConfirmingDelete, line.id, onDeleteLine],
  );

  const removeLineLabel = isConfirmingDelete
    ? 'Confirm remove line'
    : 'Remove from list';

  const handleDeleteFromCatalogClick = useCallback(() => {
    if (!catalogItem) return;
    onDeleteFromCatalog(catalogItem.id);
  }, [catalogItem, onDeleteFromCatalog]);

  return (
    <div
      data-testid={`list-line-${line.id}`}
      className={cn(
        'group flex items-center gap-3 border-b border-border/60 px-3 py-3 transition-colors last:border-b-0 hover:bg-muted/60',
        line.checked && 'bg-muted/40',
      )}
    >
      <Checkbox
        checked={line.checked}
        onCheckedChange={handleToggle}
        disabled={isLoading}
        aria-label={`Toggle ${itemName}`}
        className="h-5 w-5 shrink-0"
      />

      <span className="shrink-0 text-lg leading-none" aria-hidden="true">
        {categoryEmoji}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className={cn(
              'font-semibold text-foreground',
              line.checked && 'text-muted-foreground line-through',
            )}
          >
            {itemName}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {getCategoryLabel(category)}
          </span>
        </div>

        {(line.amount || hasPrice) && (
          <p
            className={cn(
              'mt-0.5 text-xs text-muted-foreground',
              line.checked && 'opacity-60',
            )}
          >
            {line.amount ? `${line.amount}` : ''}
            {line.amount && hasPrice ? ' · ' : ''}
            {hasPrice
              ? formatMoney(catalogItem?.price as number)
              : !line.amount
                ? 'unpriced'
                : ''}
          </p>
        )}

        {catalogItem?.notes && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] italic text-muted-foreground">
            <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
            {catalogItem.notes.length > 60
              ? `${catalogItem.notes.slice(0, 60)}…`
              : catalogItem.notes}
          </p>
        )}

        {catalogItem?.links && catalogItem.links.length > 0 && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
            {catalogItem.links.length} link
            {catalogItem.links.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        <button
          type="button"
          onClick={handleEditLine}
          disabled={isLoading}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          aria-label={`Edit List Line for ${itemName}`}
          title="Edit List Line"
        >
          <Edit2 className="h-4 w-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isLoading}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            aria-label={`More actions for ${itemName}`}
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {catalogItem && (
              <DropdownMenuItem onClick={handleEditCatalog}>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit Catalog Item
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              aria-label={removeLineLabel}
              onSelect={handleRemoveSelect}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {removeLineLabel}
            </DropdownMenuItem>
            {catalogItem && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onClick={handleDeleteFromCatalogClick}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Delete from Catalog
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
