'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

type RevealProps = {
  children: ReactNode;
  as?: 'div' | 'section' | 'header' | 'footer';
  className?: string;
  delayMs?: number;
  id?: string;
  style?: React.CSSProperties;
};

export default function Reveal({
  children,
  as: Tag = 'div',
  className,
  delayMs = 0,
  id,
  style,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (typeof IntersectionObserver === 'undefined') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (
      typeof window === 'undefined' ||
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      id={id}
      className={`mo-reveal${active ? ' mo-reveal-active' : ''}${className ? ` ${className}` : ''}`}
      style={{
        ...style,
        ...(delayMs ? { transitionDelay: `${delayMs}ms` } : null),
      }}
    >
      {children}
    </Tag>
  );
}
