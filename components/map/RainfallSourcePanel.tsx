'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import type { ScenarioFrame, ScenarioPresetType } from '@/types/scenario';
import { rainfallSourceDetails, rainfallTime } from '@/lib/map/rainfallSource';
import { RainfallCorrectionInfoModal } from './RainfallCorrectionInfoModal';

export function RainfallSourcePanel({ frame, presetType = 'live', historicalSource, historicalCorrected }: {
  frame?: ScenarioFrame; presetType?: ScenarioPresetType; historicalSource?: string; historicalCorrected?: boolean;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const source = rainfallSourceDetails(frame, presetType, historicalSource, historicalCorrected);
  return <section aria-label="Rainfall source" className="mb-3 rounded-xl border border-default/80 bg-page/70 px-3 py-2">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-[10px] font-bold text-muted-foreground">{source.attribution === 'window' ? 'Rainfall sources · 24h window' : 'Hourly rainfall source'}</h3>
      <button type="button" aria-label="About rainfall correction" aria-haspopup="dialog" title="Rainfall source and correction method"
        onClick={() => setShowInfo(true)} className="-mr-1 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><Info size={13} aria-hidden="true" /></button>
    </div>
    <p data-rainfall-source className="text-[11px] font-semibold leading-4 text-primary">{source.hourly}</p>
    {source.attribution === 'window'
      ? <p className="mt-1 text-[9px] leading-4 text-muted-foreground">Sources cover the 24-hour window; the selected hour is not identified.</p>
      : source.window.length > 0 && <p className="mt-1 text-[9px] leading-4 text-muted-foreground"><span className="font-semibold">24h inputs:</span> {source.window.join(' + ')}</p>}
    {source.times.map(time => <p key={time.label} className="mt-1 text-[9px] leading-4 text-muted-foreground">{time.label}: <time dateTime={time.value}>{rainfallTime(time.value)}</time></p>)}
    {showInfo && <RainfallCorrectionInfoModal isOpen onClose={() => setShowInfo(false)} source={source} />}
  </section>;
}
