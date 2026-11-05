import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  CloudRain,
  Flame,
  ShieldAlert,
  Thermometer,
} from 'lucide-react';
import type { Notification, NotificationType, Severity } from '@/lib/notifications';
import type { AlertType } from '@/types/weather';
import { ALERT_TYPE_LABELS } from '@/lib/weather/alertLabels';

export const TYPE_META: Record<
  NotificationType,
  { label: string; icon: typeof BellRing; className: string }
> = {
  'new-report': {
    label: 'New report',
    icon: BellRing,
    className: 'bg-info-bg text-info-text',
  },
  'needs-review': {
    label: 'Needs review',
    icon: ShieldAlert,
    className: 'bg-warning-bg text-warning-text',
  },
  flagged: {
    label: 'Flagged',
    icon: AlertTriangle,
    className: 'bg-caution-bg text-caution-text',
  },
  rejected: {
    label: 'Rejected',
    icon: CheckCircle2,
    className: 'bg-muted text-secondary',
  },
  weather: {
    label: 'Weather alert',
    icon: CloudRain,
    className: 'bg-info-bg text-info-text',
  },
};

export const SEVERITY_CLASS: Record<Severity, string> = {
  critical: 'bg-error-bg text-error-text border-error-border',
  warning: 'bg-caution-bg text-caution-text border-caution-border',
  info: 'bg-info-bg text-info-text border-info-border',
  high: 'bg-caution-bg text-caution-text border-caution-border',
  medium: 'bg-warning-bg text-warning-text border-warning-border',
  low: 'bg-muted text-secondary border-default',
};

export function NotificationTypeBadge({ type }: { type: NotificationType }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold capitalize ${SEVERITY_CLASS[severity]}`}
    >
      {severity}
    </span>
  );
}


export const WEATHER_TYPE_META: Record<
  AlertType,
  { icon: typeof CloudRain; className: string }
> = {
  thunderstorm: { icon: AlertTriangle, className: 'bg-info-bg text-info-text' },
  heavy_rain: { icon: CloudRain, className: 'bg-info-bg text-info-text' },
  extreme_heat: { icon: Flame, className: 'bg-caution-bg text-caution-text' },
  daily_digest: { icon: Thermometer, className: 'bg-muted text-secondary' },
};

export function AlertTypeBadge({ notification }: { notification: Notification }) {
  const alertType = notification.weatherAlert?.alertType;

  if (notification.type === 'weather' && alertType) {
    const meta = WEATHER_TYPE_META[alertType];
    const Icon = meta.icon;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.className}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {ALERT_TYPE_LABELS[alertType]}
      </span>
    );
  }

  return <NotificationTypeBadge type={notification.type} />;
}
