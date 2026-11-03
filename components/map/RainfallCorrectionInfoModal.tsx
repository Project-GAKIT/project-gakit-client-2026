'use client';

import { CloudRain, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { rainfallTime, type RainfallSourceDetails } from '@/lib/map/rainfallSource';

const states = {
  corrected: 'Available observed JAXA NOW hours are corrected. Forecast hours retain their provider values.',
  mixed: 'This window includes corrected JAXA NOW and uncorrected observations where correction was unavailable.',
  raw: 'The available observations are uncorrected. Raw fallback is used when the correction inputs are unavailable or outside the supported cell.',
  forecast_only: 'This window contains provider forecast rainfall. The NOW correction is not applied to RNC or Open-Meteo forecasts.',
  not_applied: 'This scenario uses a synthetic rainfall pattern. Satellite rainfall correction is not applied.',
  unknown: 'Correction status is not reported for this input. A historical source label alone does not establish calibration.',
};

export function RainfallCorrectionInfoModal({ isOpen, onClose, source }: { isOpen: boolean; onClose: () => void; source: RainfallSourceDetails }) {
  return <Dialog isOpen={isOpen} onClose={onClose} ariaLabel="About rainfall correction" maxWidthClass="max-w-2xl" panelClassName="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0">
    <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-4">
      <span className="rounded-xl bg-sky-50 p-2.5 text-sky-700"><CloudRain size={20} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><h2 className="text-base font-bold text-slate-900">Rainfall correction</h2><p className="mt-0.5 text-[11px] text-slate-500">Rainfall inputs used by the flood estimate</p></div>
      <button type="button" aria-label="Close rainfall correction details" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={17} /></button>
    </header>
    <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 text-xs leading-5 text-slate-600">
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3"><h3 className="mb-1 font-bold text-slate-900">{source.attribution === 'window' ? 'Rainfall window sources' : 'Selected rainfall input'}</h3><p className="font-semibold text-slate-800">{source.hourly}</p>{source.attribution === 'window' && <p className="mt-1">These sources cover the 24-hour window. The selected hour is not identified in this estimate.</p>}<p className="mt-1">{states[source.correction]}</p>{source.attribution === 'hour' && source.window.length > 0 && <p className="mt-2">24-hour inputs: {source.window.join(' + ')}.</p>}{source.times.map(time => <p key={time.label} className="mt-1">{time.label}: <time dateTime={time.value}>{rainfallTime(time.value)}</time>.</p>)}</section>
      <section><h3 className="mb-1 font-bold text-slate-900">Method</h3><p><strong>XGBoost + Spatial Correction</strong> adjusts each hour of satellite rainfall before those hours are accumulated for flood simulation. It combines a fitted regression model with a spatial rainfall estimate to improve local rainfall estimates.</p></section>
      <section><h3 className="mb-1 font-bold text-slate-900">Inputs and coverage</h3><p>The correction uses native JAXA NOW and Gauge_NOW, nearby satellite cells and preceding satellite hours. It was trained using eight PAGASA gauges with available records from 2023–2025. Incoming gauge readings are not needed during operation. Its accepted deployment target is the Iligan grid cell, approximately 10 km across.</p></section>
      <section><h3 className="mb-1 font-bold text-slate-900">Forecasts and fallback</h3><p>JAXA RNC and Open-Meteo forecast rainfall keep their provider values; the NOW correction is not applied to those products. Issue times are shown when supplied. Open-Meteo retrieval time records when our forecast data were fetched, rather than when the provider issued the forecast. Unavailable correction hours can use labelled raw rainfall. Missing rainfall is not treated as measured zero.</p></section>
      <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer font-bold text-slate-700">Evaluation and limitations</summary><p className="mt-2">On 212 complete Iligan days in January–July 2026, daily RMSE decreased from 22.05 to 10.54 mm/day compared with native uncorrected NOW. This is a retrospective result; the evaluation period was repeatedly examined during development. Only three heavy-rainfall days were available, and heavy-rainfall recovery remains limited.</p><p className="mt-2">These rainfall results do not validate flood depths, flood arrival or river flow. The correction supplies a local rainfall sequence to the flood model; it does not correct the full rainfall-map overlay or provide a measured catchment-wide rainfall field.</p></details>
    </div>
    <footer className="flex shrink-0 justify-end border-t border-slate-100 px-5 py-3"><button type="button" onClick={onClose} className="rounded-xl bg-gakit-maroon px-5 py-2.5 text-xs font-bold text-white hover:bg-gakit-maroon-light">Got it</button></footer>
  </Dialog>;
}
