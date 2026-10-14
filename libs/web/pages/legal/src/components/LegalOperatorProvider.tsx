'use client';

import { type ReactNode, useMemo } from 'react';
import { LegalOperatorContext } from '../lib/legal-operator-context';

export interface LegalOperatorProviderProps {
  name?: string;
  email?: string;
  children: ReactNode;
}

/**
 * Hands the operator name and contact email to legal documents rendered below
 * it. These two values are already published on /terms and /privacy, so
 * passing them to the client is not a new disclosure.
 */
export function LegalOperatorProvider({
  name,
  email,
  children,
}: LegalOperatorProviderProps) {
  const value = useMemo(() => ({ name, email }), [name, email]);

  return (
    <LegalOperatorContext.Provider value={value}>
      {children}
    </LegalOperatorContext.Provider>
  );
}
