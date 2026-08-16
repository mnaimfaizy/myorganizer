'use client';

interface StepBadgeProps {
  active?: boolean;
  done?: boolean;
  label: string;
}

function StepBadge(props: StepBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          props.active || props.done
            ? 'h-2.5 w-2.5 rounded-full bg-primary'
            : 'h-2.5 w-2.5 rounded-full bg-muted-foreground/30'
        }
      />
      <span
        className={
          props.active || props.done
            ? 'font-medium text-foreground'
            : 'text-muted-foreground'
        }
      >
        {props.label}
      </span>
    </div>
  );
}

export interface AddAddressStepBadgesProps {
  hasStreet: boolean;
  hasDuplicate: boolean;
  isSaved: boolean;
}

export function AddAddressStepBadges(props: AddAddressStepBadgesProps) {
  return (
    <div className="mt-4 grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-3">
      <StepBadge active done={props.hasStreet} label="Details" />
      <StepBadge active={props.hasDuplicate} label="Review" />
      <StepBadge active={props.isSaved} label="Saved" />
    </div>
  );
}
