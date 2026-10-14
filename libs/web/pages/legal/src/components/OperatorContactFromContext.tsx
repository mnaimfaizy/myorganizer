'use client';

import { useLegalOperator } from '../lib/legal-operator-context';
import { OperatorContactView } from './OperatorContactView';

export interface OperatorContactFromContextProps {
  /** Heading level: h3 inside the Sign up legal dialog. */
  headingLevel?: 'h2' | 'h3';
}

/** Client-side Operator & Contact section, fed by LegalOperatorProvider. */
export function OperatorContactFromContext({
  headingLevel,
}: OperatorContactFromContextProps) {
  const operator = useLegalOperator();

  if (!operator) return null;

  return (
    <OperatorContactView
      name={operator.name}
      email={operator.email}
      headingLevel={headingLevel}
    />
  );
}
