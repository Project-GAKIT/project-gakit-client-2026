'use client';

import { FLOOD_LOADER_COLOR, type FloodLoaderSize } from './FloodLoader';

export type SpinnerSize = FloodLoaderSize;

const SPINNER_SIZES: Record<SpinnerSize, string> = {
  xs: 'h-4 w-4',
  sm: 'h-[18px] w-[18px]',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

/** A steady dot orbit with a fading trail, in the startup animation's blue. */
export function Spinner({ size = 'sm', className = '', label = 'Loading' }: {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}) {
  return <span role="status" aria-label={label} title={label} className={`inline-flex shrink-0 items-center ${className}`}>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill={FLOOD_LOADER_COLOR} className={SPINNER_SIZES[size]}>
      <g className="origin-center motion-safe:animate-spin" style={{ animationDuration: '2.2s', animationTimingFunction: 'linear' }}>
        {[1, .8, .6, .42, .26, .13].map((opacity, index) => (
          <circle key={index} cx="12" cy="3.5" r={2.4 - index * .2}
            opacity={opacity} transform={`rotate(${-index * 36} 12 12)`} />
        ))}
      </g>
    </svg>
  </span>;
}
