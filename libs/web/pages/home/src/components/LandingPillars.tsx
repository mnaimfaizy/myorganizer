import {
  colorCardVar,
  colorMutedVar,
  colorPrimaryVar,
  shadowCard,
} from '@myorganiser/design-tokens';

import { PILLARS } from '../content/landingCopy';

/** Three promises the product makes about what it does not do. */
export function LandingPillars() {
  return (
    <section className="px-4 py-24">
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
        {PILLARS.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <article
              key={pillar.title}
              className="lp-reveal rounded-[2rem] p-8"
              style={{ background: colorCardVar, boxShadow: shadowCard }}
            >
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                style={{ background: colorPrimaryVar }}
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="mt-6 text-3xl font-bold tracking-tight">
                {pillar.title}
              </h2>
              <p className="mt-2" style={{ color: colorMutedVar }}>
                {pillar.text}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
