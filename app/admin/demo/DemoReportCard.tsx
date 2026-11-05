import { getReportCheckPresentation } from '@/lib/reports/assessmentPresentation';
import { STATUS_META } from '@/lib/reports/reportFormatting';
import { demoEffectLabel, type DemoAnalysisResult } from '@/lib/demo/analysis';
import { demoClock, demoTime, type DemoReportResult } from '@/lib/demo/reports';

interface DemoReportCardProps {
  report: DemoReportResult;
  effect?: DemoAnalysisResult['reportEffects'][number];
  minutes: number;
  analysisMinutes: number;
  onReplay: () => void;
  onRemove?: () => void;
}

export function DemoReportCard({ report, effect, minutes, analysisMinutes, onReplay, onRemove }: DemoReportCardProps) {
  const check = getReportCheckPresentation({ ...report, decisionSource: 'automated' });
  const observedMinutes = (Date.parse(report.observedAt) - Date.parse(demoTime(0))) / 60_000;
  const submittedMinutes = (Date.parse(report.submittedAt ?? report.observedAt) - Date.parse(demoTime(0))) / 60_000;
  const distance = report.validationSummary.nearbyModeledWaterM;
  const checks = check.checks.map(row => row.label === 'Flood estimate' && distance != null
    ? { ...row, value: distance === 0 ? 'Flooding shown here' : `Flooding shown ${Math.round(distance)} m away` }
    : row);
  if (distance != null && !checks.some(row => row.label === 'Flood estimate')) {
    checks.unshift({ label: 'Flood estimate', value: distance === 0 ? 'Flooding shown here' : `Flooding shown ${Math.round(distance)} m away` });
  }

  return <article className="rounded-lg border border-default p-3 text-xs">
    <div className="flex items-center justify-between gap-2">
      <strong>Demo reporter {report.reporter}</strong>
      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_META[report.status].badgeClass}`}>{STATUS_META[report.status].label}</span>
    </div>
    <p className="mt-2 text-secondary">{check.message}</p>
    <p className="mt-2 font-semibold text-primary">{report.depthCm == null ? 'No depth estimate' : `${report.depthCm} cm · ${report.depthMethod === 'measured' ? 'Measured' : report.depthMethod === 'category' ? 'Category estimate' : 'Estimated'}`}</p>
    {checks.length > 0 && <ul className="mt-1 space-y-0.5 text-secondary">{checks.map(row =>
      <li key={row.label}><span className="text-muted-foreground">{row.label}: </span>{row.value}</li>)}</ul>}
    <div className="mt-2 text-[11px] text-muted-foreground">
      <p>{observedMinutes === submittedMinutes ? 'Observed & submitted' : 'Observed'} {demoClock(observedMinutes)}</p>
      {observedMinutes !== submittedMinutes && <p>Submitted {demoClock(submittedMinutes)}</p>}
    </div>
    {effect && <div className="mt-2 border-t border-default pt-2 text-secondary">
      <p>{demoEffectLabel(effect.reason)}</p>
      {effect.acceptedDepthRangeM && <p className="mt-0.5 text-[11px] text-muted-foreground">
        {effect.depthUncertaintyAssumed ? 'Estimated range' : 'Measurement range'}: {Math.round(effect.acceptedDepthRangeM[0] * 100)}–{Math.round(effect.acceptedDepthRangeM[1] * 100)} cm
      </p>}
      {effect.baselineDepthM !== null && effect.correctedDepthM !== null && <p className="mt-0.5 font-semibold text-primary">
        At update: {Math.round(effect.baselineDepthM * 100)} → {Math.round(effect.correctedDepthM * 100)} cm
      </p>}
      {effect.appliedAt && <p className="mt-0.5 text-[11px] text-muted-foreground">Applied {demoClock((Date.parse(effect.appliedAt) - Date.parse(demoTime(0))) / 60_000)}</p>}
      {effect.currentDepthM != null && <p className="mt-0.5">Now at this pin: {Math.round(effect.currentDepthM * 100)} cm</p>}
    </div>}
    {report.validationSummary.depthDisagreement && <p className="mt-1 text-warning-text">Reported depths differ · review needed</p>}
    {analysisMinutes - observedMinutes >= 60 && <p className="mt-1 text-muted-foreground">Earlier observation · shown for reference</p>}
    <details className="mt-2 text-muted-foreground">
      <summary className="cursor-pointer font-medium text-secondary">Report checks</summary>
      <p className="mt-1">Checks use conditions at the observation time.</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">{check.details.map(detail => <li key={detail}>{detail}</li>)}</ul>
      {check.depthNote && <p className="mt-1">{check.depthNote}</p>}
    </details>
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-semibold text-secondary">
      {observedMinutes < minutes && <button type="button" onClick={onReplay}>Replay this time</button>}
      {onRemove && <button type="button" onClick={onRemove}>Remove report</button>}
    </div>
  </article>;
}
