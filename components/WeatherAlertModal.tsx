import { useId, useState } from 'react';
import { CloudRain, X, Droplet, MapPin } from 'lucide-react';
import type { WeatherAlert, AlertSeverity } from '@/types/weather';
import { alertDescription, alertTitle, digestPeriod, formatDayForecast, getWeatherCondition } from '@/lib/weather/weatherCodes';
import { ALERT_ICONS, ALERT_TYPE_LABELS } from '@/lib/weather/alertLabels';
import { hazardSummary, isPagasaAlert, otherProvinceCount, parseLocalTowns, rainfallWarningLevel, shortTitle, thunderstormBulletinType } from '@/lib/weather/pagasa';
import { WeatherAttribution } from './weather/WeatherAttribution';
import { RainStrip } from './weather/RainStrip';
import { Dialog } from '@/components/ui/Dialog';
import { WeatherOutlookModal } from './weather/WeatherOutlookModal';

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { text: string; badge: string; icon: string; dot: string }
> = {
  critical: {
    text: 'text-error-text',
    badge: 'bg-error-bg text-error-text',
    icon: 'text-error-text',
    dot: 'bg-red-500',
  },
  warning: {
    text: 'text-caution-text',
    badge: 'bg-caution-bg text-caution-text',
    icon: 'text-caution-text',
    dot: 'bg-orange-500',
  },
  info: {
    text: 'text-info-text',
    badge: 'bg-info-bg text-info-text',
    icon: 'text-info-text',
    dot: 'bg-blue-500',
  },
};

function alertDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today, Sep 27", "Tomorrow, Sep 28", or "Sat, Aug 25" */
function friendlyDay(iso: string): string {
  const target = new Date(iso);
  const dayDiff = Math.round((startOfDay(target) - startOfDay(new Date())) / 86_400_000);
  const date = target.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

  if (dayDiff === 0) return `Today, ${date}`;
  if (dayDiff === 1) return `Tomorrow, ${date}`;
  if (dayDiff === -1) return `Yesterday, ${date}`;

  return target.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function friendlyShortDay(iso: string): string {
  const target = new Date(iso);
  const dayDiff = Math.round((startOfDay(target) - startOfDay(new Date())) / 86_400_000);

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tom';

  return target.toLocaleDateString('en-PH', {
    weekday: 'short',
  });
}

interface WeatherAlertModalProps {
  alert: WeatherAlert;
  allAlerts?: WeatherAlert[];
  /** ISO date of the day to emphasize (e.g. the card the user clicked). */
  highlightDate?: string;
  onClose: () => void;
}

export function WeatherAlertModal({ alert, highlightDate, onClose }: WeatherAlertModalProps) {
  return alert.alertType === 'daily_digest'
    ? <WeatherOutlookModal key={`${alert.id}:${highlightDate ?? ''}`} alert={alert} highlightDate={highlightDate} onClose={onClose} />
    : <AdvisoryWeatherAlertModal alert={alert} highlightDate={highlightDate} onClose={onClose} />;
}

function AdvisoryWeatherAlertModal({ alert, highlightDate, onClose }: WeatherAlertModalProps) {
  const activeAlert = alert;
  const titleId = useId();

  const days = activeAlert.data?.days ?? [];
  const [selectedDate, setSelectedDate] = useState<string>(() => highlightDate || (days[0]?.date ?? ''));
  const [townsExpanded, setTownsExpanded] = useState(false);
  const [expandedFor, setExpandedFor] = useState(activeAlert.id);
  if (expandedFor !== activeAlert.id) {
    setExpandedFor(activeAlert.id);
    setTownsExpanded(false);
  }

  const Icon = ALERT_ICONS[activeAlert.alertType] ?? CloudRain;
  const pagasa = isPagasaAlert(activeAlert);
  const heading = pagasa ? shortTitle(activeAlert) || alertTitle(activeAlert) : alertTitle(activeAlert);
  // The projected bulletin title identifies the warning level for Iligan.
  const rainfallLevel = rainfallWarningLevel(activeAlert);
  const rainfallStyle = rainfallLevel === 'yellow'
    ? { badge: 'bg-warning-bg text-warning-text', border: 'border-l-yellow-500', header: 'bg-warning-bg', label: 'Yellow advisory' }
    : rainfallLevel === 'orange'
      ? { badge: 'bg-caution-bg text-caution-text', border: 'border-l-orange-500', header: 'bg-caution-bg', label: 'Orange warning' }
      : rainfallLevel === 'red'
        ? { badge: 'bg-error-bg text-error-text', border: 'border-l-red-500', header: 'bg-error-bg', label: 'Red warning' }
        : undefined;
  const thunderstormType = thunderstormBulletinType(activeAlert);
  const bulletinStyle = rainfallStyle ?? (thunderstormType === 'watch'
    ? { badge: 'bg-info-bg text-info-text', border: 'border-l-blue-500', header: 'bg-info-bg', label: 'Thunderstorm Watch' }
    : thunderstormType === 'advisory'
      ? { badge: 'bg-warning-bg text-warning-text', border: 'border-l-amber-500', header: 'bg-warning-bg', label: 'Thunderstorm Advisory' }
      : undefined);
  const config = bulletinStyle ?? SEVERITY_CONFIG[activeAlert.severity];
  const localTowns = activeAlert.data?.coverageLabel ? [activeAlert.data.coverageLabel] : pagasa ? parseLocalTowns(activeAlert) : [];
  const towns = [...new Set(localTowns.length ? localTowns : activeAlert.data?.affectedAreas?.filter(Boolean) ?? [])];
  const summary = (pagasa ? hazardSummary(activeAlert) : null) || activeAlert.data?.description?.trim() || alertDescription(activeAlert);
  const otherCount = pagasa ? otherProvinceCount(activeAlert) : 0;
  const fullText = activeAlert.data?.rawText ?? activeAlert.data?.description ?? '';
  const showFull = fullText.trim() !== summary.trim() && fullText.trim().length > 0;
  const visibleTowns = townsExpanded ? towns : towns.slice(0, 7);

  const activeDay = days.find((d) => d.date === selectedDate) ?? days[0];
  const activeCondition = activeDay ? getWeatherCondition(activeDay.conditionCode) : null;
  const ActiveIcon = activeCondition ? activeCondition.icon : CloudRain;
  const activeDetail = activeDay ? formatDayForecast(activeDay) : '';

  return (
    <Dialog
      isOpen
      onClose={onClose}
      ariaLabelledBy={titleId}
      maxWidthClass="max-w-xl"
      panelClassName="relative flex max-h-[90dvh] flex-col overflow-hidden border border-default"
    >
        <div className={`flex shrink-0 items-start justify-between gap-3 border-b border-default px-4 py-3 sm:px-5 ${bulletinStyle?.header ?? ''}`}>
          <div className="flex min-w-0 items-start gap-2.5">
            <span className={`mt-0.5 shrink-0 rounded-xl p-2 ${config.badge}`}><Icon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
                <span className="text-muted-foreground">{ALERT_TYPE_LABELS[activeAlert.alertType]}</span>
                <span className={`rounded px-1.5 py-0.5 ${config.badge}`}>{bulletinStyle?.label ?? activeAlert.severity}</span>
                {activeAlert.data?.bulletinNumber != null && <span className="text-muted-foreground">Bulletin #{activeAlert.data.bulletinNumber}</span>}
              </div>
              <h3 id={titleId} className="text-sm font-bold leading-5 text-primary">{heading}</h3>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-secondary" aria-label="Close weather alert"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <dl className="grid grid-cols-2 divide-x divide-default rounded-xl border border-default bg-page py-2.5">
            <div className="px-3"><dt className="text-[11px] font-semibold uppercase tracking-wide text-secondary">Issued · PHT</dt><dd className="mt-1 text-[11px] font-semibold text-secondary">{alertDateTime(activeAlert.data?.issuedAt || activeAlert.createdAt)}</dd></div>
            <div className="px-3"><dt className="text-[11px] font-semibold uppercase tracking-wide text-secondary">Valid until · PHT</dt><dd className="mt-1 text-[11px] font-semibold text-secondary">{alertDateTime(activeAlert.validTo)}</dd></div>
          </dl>
          {activeAlert.alertType === 'daily_digest' && digestPeriod(activeAlert) && <p className="text-[11px] font-medium text-muted-foreground">{digestPeriod(activeAlert)}</p>}

          {days.length > 0 ? (
            <div className="space-y-3">
              {/* 5-Day Horizontal Tab Selector */}
              <div className="grid grid-cols-5 gap-1.5">
                {days.map((day) => {
                  const isSelected = day.date === (activeDay?.date ?? '');
                  const dayCondition = getWeatherCondition(day.conditionCode);
                  const DayIcon = dayCondition.icon;
                  const shortName = friendlyShortDay(`${day.date}T00:00:00+08:00`);

                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setSelectedDate(day.date)}
                      className={`flex flex-col items-center justify-between rounded-xl p-2 text-center transition-colors duration-150 ${
                        isSelected
                          ? 'bg-panel text-primary shadow-md ring-2 ring-focus font-bold'
                          : 'bg-page text-secondary hover:bg-muted/80 ring-1 ring-default'
                      }`}
                    >
                      <span className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${isSelected ? 'text-secondary' : 'text-secondary'}`}>
                        {shortName}
                      </span>
                      <div className={`my-1.5 flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${isSelected ? 'bg-muted/80 ring-1 ring-focus/60' : 'bg-panel shadow-2xs ring-1 ring-default'}`}>
                        <DayIcon className={`h-4 w-4 ${isSelected ? 'text-secondary' : 'text-secondary'}`} />
                      </div>
                      <div className="flex items-center gap-0.5 text-[11px] tabular-nums font-bold leading-none">
                        <span className="text-primary">{day.tempMax}°</span>
                        <span className="text-muted-foreground font-normal text-[11px]">{day.tempMin}°</span>
                      </div>
                      <span className={`mt-1 flex items-center justify-center gap-0.5 text-[11px] font-semibold tabular-nums leading-none ${(day.rainChance ?? 0) > 0 ? 'text-info-text' : 'text-muted-foreground'}`}>
                        {(day.rainChance ?? 0) > 0 && <Droplet className="h-3 w-3 text-info-text fill-sky-500/30 shrink-0" />}
                        <span>{day.rainChance == null ? 'Unavailable' : `${day.rainChance}%`}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Day Detail Card */}
              {activeDay && (
                <div className="rounded-xl bg-page p-3.5 ring-1 ring-default space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel shadow-xs ring-1 ring-default">
                        <ActiveIcon className="h-5 w-5 text-secondary" />
                      </span>
                      <div>
                        <span className="block text-sm font-bold text-primary">
                          {friendlyDay(`${activeDay.date}T00:00:00+08:00`)}
                        </span>
                        <span className="block text-xs font-medium text-muted-foreground">
                          {activeDetail}
                        </span>
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="text-base font-bold text-primary">
                        {activeDay.tempMax}°
                        <span className="ml-1 text-xs font-normal text-muted-foreground">/ {activeDay.tempMin}°</span>
                      </div>
                    </div>
                  </div>

                  {/* Hourly Rain Timeline */}
                  {((activeDay.hourlyProbabilities && activeDay.hourlyProbabilities.length > 0) ||
                    (activeDay.hours && activeDay.hours.length > 0)) && (
                    <div className="pt-2 border-t border-default/60">
                      <div className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1">
                        Hourly Precipitation Chance
                      </div>
                      <RainStrip
                        hours={activeDay.hours}
                        probabilities={activeDay.hourlyProbabilities}
                      />
                    </div>
                  )}

                  {/* Key Day Metrics */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-default/60 text-center">
                    <div className="rounded-lg bg-panel p-2 shadow-2xs ring-1 ring-default">
                      <span className="block text-[11px] text-muted-foreground font-medium">Rain chance</span>
                      <span className="text-xs font-bold text-primary tabular-nums">{activeDay.rainChance}%</span>
                    </div>
                    <div className="rounded-lg bg-panel p-2 shadow-2xs ring-1 ring-default">
                      <span className="block text-[11px] text-muted-foreground font-medium">Precipitation</span>
                      <span className="text-xs font-bold text-primary tabular-nums">~{activeDay.rainMm.toFixed(1)} mm</span>
                    </div>
                    <div className="rounded-lg bg-panel p-2 shadow-2xs ring-1 ring-default">
                      <span className="block text-[11px] text-muted-foreground font-medium">Peak Wind</span>
                      <span className="text-xs font-bold text-primary tabular-nums">{activeDay.windMax} km/h</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {summary && (
                <div className={`rounded-xl border border-default border-l-[3px] bg-page/70 p-3 ${bulletinStyle?.border ?? (activeAlert.severity === 'critical' ? 'border-l-red-500' : activeAlert.severity === 'warning' ? 'border-l-orange-500' : 'border-l-blue-500')}`}>
                  <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Advisory summary</h4>
                  <p className="whitespace-pre-line text-xs leading-5 text-secondary">{summary}</p>
                </div>
              )}
              {towns.length > 0 && (
                <div className="rounded-xl bg-page p-3 border border-default/70 text-xs">
                  <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><MapPin className="h-3 w-3" />{activeAlert.data?.coverageLabel ? 'Local coverage' : 'Affected areas'}</h4>
                  {activeAlert.data?.coverageLabel && <p className="mb-2 text-[11px] leading-4 text-secondary">This advisory applies to Iligan City. The original regional bulletin may also name other towns or warning levels.</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {visibleTowns.map((town) =>
                      /iligan/i.test(town) ? (
                        <span
                          key={town}
                          title="Your area"
                          className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-bold text-secondary border border-default/80 shadow-2xs"
                        >
                          {town}
                        </span>
                      ) : (
                        <span
                          key={town}
                          className="inline-block rounded-md bg-panel px-2 py-0.5 text-xs font-medium text-secondary border border-default shadow-2xs"
                        >
                          {town}
                        </span>
                      )
                    )}
                    {towns.length > visibleTowns.length && (
                      <button
                        type="button"
                        onClick={() => setTownsExpanded(true)}
                        className="inline-block rounded-md bg-panel px-2 py-0.5 text-xs font-semibold text-secondary border border-default/70 hover:bg-muted transition-colors"
                      >
                        +{towns.length - visibleTowns.length} more
                      </button>
                    )}
                    {townsExpanded && towns.length > 7 && (
                      <button
                        type="button"
                        onClick={() => setTownsExpanded(false)}
                        className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold text-muted-foreground hover:text-secondary transition-colors"
                      >
                        Show less
                      </button>
                    )}
                  </div>
                </div>
              )}
              {otherCount > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  + also covering {otherCount} other province{otherCount === 1 ? '' : 's'}.
                </p>
              )}
              {showFull && (
                <details className="rounded-xl bg-page border border-default/70 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-secondary hover:text-primary">
                    Full bulletin
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-xs text-secondary leading-relaxed">
                    {fullText.trim()}
                  </p>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-default px-4 py-2.5 sm:px-5">
          <WeatherAttribution source={activeAlert.data?.source ?? (activeAlert.alertType === 'daily_digest' ? 'Open-Meteo' : 'DOST-PAGASA MINPRSD')} />
          <button
            onClick={onClose}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-hover transition-colors"
          >
            Close
          </button>
        </div>
    </Dialog>
  );
}
