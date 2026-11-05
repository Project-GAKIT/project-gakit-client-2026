'use client';

import { AnimatedWeatherIcon } from './AnimatedWeatherIcon';
import type { CurrentWeather } from '@/types/weather';

/** Current observations use the shared weather animation. */
export function CurrentWeatherIcon({ weather, className = '', strokeWidth = 2 }: {
  weather: CurrentWeather;
  className?: string;
  strokeWidth?: number;
}) {
  return <AnimatedWeatherIcon conditionCode={weather.conditionCode} observedAt={weather.observedAt}
    className={className} strokeWidth={strokeWidth} />;
}
