'use client';

import { getWeatherCondition, isDaytimeInManila } from '@/lib/weather/weatherCodes';

/** Shared condition glyph and motion for current weather and outlook summaries. */
export function AnimatedWeatherIcon({ conditionCode, observedAt, className = '', strokeWidth = 2, twoTone = false }: {
  conditionCode: number;
  observedAt: string;
  className?: string;
  strokeWidth?: number;
  /** Render sun/moon/bolt/rain strokes in a warm tone against a slate cloud mass. */
  twoTone?: boolean;
}) {
  const isDay = isDaytimeInManila(observedAt);
  const Icon = getWeatherCondition(conditionCode, isDay).icon;
  const motion = conditionCode >= 95 ? 'storm'
    : conditionCode >= 51 && conditionCode <= 86 ? 'rain'
    : conditionCode === 0 && isDay ? 'sun' : 'cloud';
  return <Icon key={`${observedAt}:${conditionCode}`} aria-hidden="true" strokeWidth={strokeWidth}
    data-weather-motion={motion} className={`current-weather-icon${twoTone ? ' weather-two-tone' : ''} ${className}`} />;
}
