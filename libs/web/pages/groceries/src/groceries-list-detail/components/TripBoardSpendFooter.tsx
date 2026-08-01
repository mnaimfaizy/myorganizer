import { formatMoney, type ListSpendSummary } from '../../shared/utils';

interface TripBoardSpendFooterProps {
  summary: ListSpendSummary;
}

export function TripBoardSpendFooter({ summary }: TripBoardSpendFooterProps) {
  return (
    <div
      role="status"
      className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-outline-variant bg-surface px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
    >
      <span className="text-sm font-semibold text-on-surface">
        Known spend {formatMoney(summary.known)}
      </span>
      <span className="text-xs text-on-surface-variant">
        {summary.unpricedCount} item{summary.unpricedCount !== 1 ? 's' : ''}{' '}
        unpriced
      </span>
    </div>
  );
}
