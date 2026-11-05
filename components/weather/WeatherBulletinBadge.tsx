import type { WeatherAlert } from '@/types/weather';
import { rainfallWarningLevel, thunderstormBulletinType } from '@/lib/weather/pagasa';

export function WeatherBulletinBadge({ alert }: { alert: WeatherAlert }) {
  const rainfall = rainfallWarningLevel(alert);
  const thunderstorm = thunderstormBulletinType(alert);
  const label = rainfall === 'yellow' ? 'Yellow' : rainfall === 'orange' ? 'Orange'
    : rainfall === 'red' ? 'Red' : thunderstorm === 'watch' ? 'Watch'
      : thunderstorm === 'advisory' || alert.alertType === 'heavy_rain'
        ? 'Advisory' : alert.severity;
  const colors = rainfall === 'yellow' ? 'border-warning-border bg-warning-bg text-warning-text'
    : rainfall === 'orange' ? 'border-caution-border bg-caution-bg text-caution-text'
      : rainfall === 'red' ? 'border-error-border bg-error-bg text-error-text'
        : thunderstorm === 'watch' ? 'border-info-border bg-info-bg text-info-text'
          : thunderstorm === 'advisory' ? 'border-warning-border bg-warning-bg text-warning-text'
            : alert.severity === 'critical' ? 'border-error-border bg-error-bg text-error-text'
              : alert.severity === 'warning' ? 'border-caution-border bg-caution-bg text-caution-text'
                : 'border-info-border bg-info-bg text-info-text';
  return <span className={`inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${colors}`}>{label}</span>;
}
