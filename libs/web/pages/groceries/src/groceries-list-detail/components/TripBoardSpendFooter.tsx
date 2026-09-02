import { formatMoney, type ListSpendSummary } from '../../shared/utils';

interface TripBoardSpendFooterProps {
  summary: ListSpendSummary;
}

export function TripBoardSpendFooter({ summary }: TripBoardSpendFooterProps) {
  return (
    <footer
      role="status"
      className="sticky bottom-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-md md:bottom-4"
    >
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Known spend · unpriced · checked
        </p>
        <p className="text-lg font-bold tabular-nums text-foreground">
          {formatMoney(summary.known)} · {summary.unpricedCount} ·{' '}
          {formatMoney(summary.checkedKnown)}
        </p>
      </div>
    </footer>
  );
}
