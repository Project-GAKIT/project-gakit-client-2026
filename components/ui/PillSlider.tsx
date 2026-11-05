'use client';

import type { CSSProperties } from 'react';

/** Native range input keeps pointer, touch, and keyboard movement in sync. */
export function PillSlider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  ariaLabel,
  accent = 'rgb(var(--accent-text))',
  className = '',
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  accent?: string;
  className?: string;
}) {
  const progress = max > min ? Math.min(100, Math.max(0, (value - min) / (max - min) * 100)) : 0;
  return (
    <input type="range" min={min} max={max} step={step} value={value} aria-label={ariaLabel}
      onChange={event => onChange(Number(event.target.value))}
      className={`ui-slider block h-8 w-full min-w-0 ${className}`}
      style={{ '--slider-accent': accent, '--slider-progress': `${progress}%` } as CSSProperties} />
  );
}
