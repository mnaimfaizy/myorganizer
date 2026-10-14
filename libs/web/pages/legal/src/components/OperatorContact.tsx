import { OperatorContactView } from './OperatorContactView';

export interface OperatorContactProps {
  /** Heading level: h2 on the standalone pages, h3 inside a dialog. */
  headingLevel?: 'h2' | 'h3';
}

/**
 * Server-side Operator & Contact section for the standalone legal pages. Reads
 * the operator env vars; the dialog gets the same values via LegalOperatorProvider.
 */
export function OperatorContact({ headingLevel }: OperatorContactProps) {
  return (
    <OperatorContactView
      name={process.env.OPERATOR_NAME}
      email={process.env.OPERATOR_CONTACT_EMAIL}
      headingLevel={headingLevel}
    />
  );
}
