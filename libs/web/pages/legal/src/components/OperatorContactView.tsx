export interface OperatorContactViewProps {
  /** Operator name. Blank or missing values are omitted. */
  name?: string | null;
  /** Operator contact email. Blank or missing values are omitted. */
  email?: string | null;
  /** Heading level: h2 on the standalone pages, h3 inside a dialog. */
  headingLevel?: 'h2' | 'h3';
}

/** Pure presentation of the Operator & Contact section. Reads no environment. */
export function OperatorContactView({
  name,
  email,
  headingLevel: Heading = 'h2',
}: OperatorContactViewProps) {
  const trimmedName = name?.trim();
  const trimmedEmail = email?.trim();

  // If neither is set, render nothing
  if (!trimmedName && !trimmedEmail) {
    return null;
  }

  return (
    <section className="mt-6">
      <Heading className="text-base font-semibold">Operator & Contact</Heading>
      {trimmedName && (
        <p className="mt-3 text-sm text-muted-foreground">
          <strong>Operator:</strong> {trimmedName}
        </p>
      )}
      {trimmedEmail && (
        <p
          className={
            trimmedName
              ? 'mt-2 text-sm text-muted-foreground'
              : 'mt-3 text-sm text-muted-foreground'
          }
        >
          <strong>Contact:</strong>{' '}
          <a
            href={`mailto:${trimmedEmail}`}
            className="font-medium underline hover:text-foreground"
          >
            {trimmedEmail}
          </a>
        </p>
      )}
    </section>
  );
}
