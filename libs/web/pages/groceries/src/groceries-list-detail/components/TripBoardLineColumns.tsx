import type { CatalogItem, ListLine } from '@myorganizer/core';
import { TripBoardLineRow } from './TripBoardLineRow';

interface TripBoardLineColumnsProps {
  active: ListLine[];
  checked: ListLine[];
  catalog: CatalogItem[];
  onToggleChecked: (lineId: string) => void;
  onDeleteLine: (lineId: string) => void;
  onDeleteFromCatalog: (catalogItemId: string) => void;
  onEditListLine: (lineId: string) => void;
  onEditCatalogItem: (catalogItemId: string) => void;
  isLoading?: boolean;
}

export function TripBoardLineColumns({
  active,
  checked,
  catalog,
  onToggleChecked,
  onDeleteLine,
  onDeleteFromCatalog,
  onEditListLine,
  onEditCatalogItem,
  isLoading = false,
}: TripBoardLineColumnsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            Nothing left in cart
          </p>
        ) : (
          active.map((line) => (
            <TripBoardLineRow
              key={line.id}
              line={line}
              catalogItem={catalog.find(
                (item) => item.id === line.catalogItemId,
              )}
              onToggleChecked={onToggleChecked}
              onDeleteLine={onDeleteLine}
              onDeleteFromCatalog={onDeleteFromCatalog}
              onEditListLine={onEditListLine}
              onEditCatalogItem={onEditCatalogItem}
              isLoading={isLoading}
            />
          ))
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-dashed border-border bg-muted/40">
        <h2 className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Checked ({checked.length}) — visible until removed
        </h2>
        {checked.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            None bought yet
          </p>
        ) : (
          checked.map((line) => (
            <TripBoardLineRow
              key={line.id}
              line={line}
              catalogItem={catalog.find(
                (item) => item.id === line.catalogItemId,
              )}
              onToggleChecked={onToggleChecked}
              onDeleteLine={onDeleteLine}
              onDeleteFromCatalog={onDeleteFromCatalog}
              onEditListLine={onEditListLine}
              onEditCatalogItem={onEditCatalogItem}
              isLoading={isLoading}
            />
          ))
        )}
      </section>
    </div>
  );
}
