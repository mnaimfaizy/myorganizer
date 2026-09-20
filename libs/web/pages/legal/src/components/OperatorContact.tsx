export function OperatorContact() {
  const operatorName = process.env.OPERATOR_NAME;
  const operatorContactEmail = process.env.OPERATOR_CONTACT_EMAIL;

  // Trim and check for truthiness
  const trimmedName = operatorName?.trim();
  const trimmedEmail = operatorContactEmail?.trim();

  // If neither is set, render nothing
  if (!trimmedName && !trimmedEmail) {
    return null;
  }

  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold">Operator & Contact</h2>
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
