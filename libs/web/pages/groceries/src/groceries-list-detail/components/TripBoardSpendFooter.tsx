import { formatMoney, type ListSpendSummary } from '../../shared/utils';

interface TripBoardSpendFooterProps {
  summary: ListSpendSummary;
}

export function TripBoardSpendFooter({ summary }: TripBoardSpendFooterProps) {
  return (
    <footer
      role="status"
      className="sticky bottom-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-md md:bottom-4"
    >
      <div>
        <p className="text-xs uppercase tracking-wide text-on-surface-variant">
          Known spend · unpriced · checked
        </p>
        <p className="text-lg font-bold tabular-nums text-on-surface">
          {formatMoney(summary.known)} · {summary.unpricedCount} ·{' '}
          {formatMoney(summary.checkedKnown)}
        </p>
      </div>
    </footer>
  );
}
