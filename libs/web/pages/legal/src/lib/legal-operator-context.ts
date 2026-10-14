import { createContext, useContext } from 'react';

export interface LegalOperatorValues {
  name?: string;
  email?: string;
}

/** Null when no provider is mounted, so the dialog renders no operator section. */
export const LegalOperatorContext = createContext<LegalOperatorValues | null>(
  null,
);

export function useLegalOperator(): LegalOperatorValues | null {
  return useContext(LegalOperatorContext);
}
