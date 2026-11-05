import { memo } from 'react';
import { Archive, CheckCircle2, RotateCcw } from 'lucide-react';
import { DEPTH_LABELS, formatDateTime } from '@/lib/reports/reportFormatting';
import type { Notification } from '@/lib/notifications';
import type { AlertsView } from '@/lib/notifications/filters';
import type { WeatherAlert as WeatherAlertType } from '@/types/weather';
import { WeatherBulletinBadge } from '@/components/weather/WeatherBulletinBadge';
import { AlertTypeBadge, SeverityBadge } from './AlertBadges';

interface AlertListItemProps {
  notification: Notification;
  view: AlertsView;
  onOpenReports: (reportId?: string) => void;
  onSelectWeatherAlert?: (alert: WeatherAlertType) => void;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onRestore: (id: string) => void;
  isRead: boolean;
  highlighted: boolean;
}


export const AlertListItem = memo(function AlertListItem({
  notification,
  view,
  onOpenReports,
  onSelectWeatherAlert,
  onMarkRead,
  onDismiss,
  onRestore,
  isRead,
  highlighted,
}: AlertListItemProps) {
  const isArchivedView = view === 'archived';
  const isWeather = notification.type === 'weather';
  const validTo = notification.weatherAlert?.validTo;


  const handleView = () => {
    if (!isRead && !isArchivedView) onMarkRead(notification.id);
    if (isWeather && onSelectWeatherAlert && notification.weatherAlert) {
      onSelectWeatherAlert(notification.weatherAlert);
    } else {
      onOpenReports(notification.reportId);
    }
  };


  const metaLine = isWeather
    ? validTo
      ? `Valid until ${formatDateTime(validTo)}`
      : formatDateTime(notification.sentAt)
    : `${notification.depth ? DEPTH_LABELS[notification.depth] + ' · ' : ''}${formatDateTime(notification.sentAt)}`;

  return (
    <div
      role="button"
      tabIndex={0}
      data-highlighted-notification={highlighted ? notification.id : undefined}
      onClick={handleView}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleView();
        }
      }}
      className={`flex cursor-pointer gap-2 px-3 py-2.5 active:bg-page ${
        highlighted ? 'bg-muted/80' : 'hover:bg-page/60'
      } transition-colors duration-200`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <AlertTypeBadge notification={notification} />
          {notification.weatherAlert ? <WeatherBulletinBadge alert={notification.weatherAlert} /> : <SeverityBadge severity={notification.severity} />}
          {!isRead && !isArchivedView && (
            <span
              aria-label="Unread"
              className="ml-auto h-2 w-2 shrink-0 rounded-full bg-accent"
            />
          )}
        </div>
        <p
          className={`mt-1 text-[13px] font-semibold leading-5 ${isRead ? 'text-muted-foreground' : 'text-primary'}`}
        >
          {notification.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] leading-4">
          <p className="min-w-0 truncate text-secondary" title={notification.location}>{notification.location}</p>
          <p className="text-muted-foreground">{metaLine}</p>
        </div>
      </div>

      <div
        className="flex shrink-0 items-start gap-1"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {isArchivedView ? (
          <button
            type="button"
            aria-label={`Restore ${notification.title} to active`}
            onClick={() => onRestore(notification.id)}
            className="inline-flex rounded-md border border-default p-1.5 text-secondary hover:border-strong hover:text-primary"
            title="Restore to active"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        ) : (
          <>
            {!isRead && (
              <button
                type="button"
                aria-label={`Mark ${notification.title} as read`}
                onClick={() => onMarkRead(notification.id)}
                className="inline-flex rounded-md border border-default p-1.5 text-secondary hover:border-strong hover:text-primary"
                title="Mark as read"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              aria-label={`Archive ${notification.title}`}
              onClick={() => onDismiss(notification.id)}
              className="inline-flex rounded-md border border-default p-1.5 text-secondary hover:border-strong hover:text-primary"
              title="Archive"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
});
