import { colorMutedVar, colorSuccessVar } from '@myorganiser/design-tokens';
import { Check, Laptop, Smartphone } from 'lucide-react';

import { type ClipBodyProps, GROCERY_ITEMS } from '../content/featureClips';
import { ClipRow } from './ClipRow';

/** A shopping list built on the laptop, then ticked off on the phone in the shop. */
export function GroceriesClip({ step }: ClipBodyProps) {
  // Steps 0-3 add items on the laptop; steps 4-6 tick them off on the phone.
  const added = Math.min(step + 1, GROCERY_ITEMS.length);
  const ticked = Math.max(0, step - 3);
  const onPhone = step >= 4;
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center gap-2 text-xs font-semibold"
        style={{ color: colorMutedVar }}
      >
        {onPhone ? (
          <Smartphone className="h-4 w-4" />
        ) : (
          <Laptop className="h-4 w-4" />
        )}
        {onPhone ? 'In the shop, on your phone' : 'At home, on your laptop'}
      </div>
      {GROCERY_ITEMS.slice(0, added).map((item, index) => {
        const isTicked = index < ticked;
        return (
          <ClipRow key={item} highlight={!onPhone && index === added - 1}>
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ease-out"
              style={{
                borderColor: isTicked ? colorSuccessVar : colorMutedVar,
                background: isTicked ? colorSuccessVar : 'transparent',
              }}
            >
              {isTicked ? <Check className="h-3 w-3 text-white" /> : null}
            </span>
            <span
              className={`transition-all duration-500 ease-out ${isTicked ? 'line-through opacity-50' : ''}`}
            >
              {item}
            </span>
          </ClipRow>
        );
      })}
    </div>
  );
}
