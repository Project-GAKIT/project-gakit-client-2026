'use client';

import { useId, useRef } from 'react';
import { ArrowLeft, ArrowUpRight, Info, ShieldCheck, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { HAZARD_SAFETY_GUIDES, type HazardGuideName } from '@/lib/hazards/safetyGuides';
import { HazardSafetyFigure } from './HazardSafetyFigure';

export function HazardSafetyGuide({ hazard, onClose }: { hazard: HazardGuideName; onClose: () => void }) {
  const id = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const guide = HAZARD_SAFETY_GUIDES[hazard];

  return <Dialog isOpen onClose={onClose} ariaLabelledBy={`${id}-title`}
    maxWidthClass="max-w-6xl" panelClassName="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
    <header className="shrink-0 border-b border-default px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-accent-text"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="font-heading text-lg font-bold tracking-tight text-primary sm:text-xl">{hazard} safety guide</h2>
          <p className="mt-0.5 text-xs text-secondary">What to do before, during, and after.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close safety guide"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="Jump to safety instructions" className="mt-3 flex gap-2 lg:hidden">
        {guide.phases.map((phase, index) => <button key={phase.name} type="button" onClick={() => {
          const section = bodyRef.current?.querySelector<HTMLElement>(`[data-safety-phase="${phase.name}"]`);
          section?.scrollIntoView({ block: 'start', behavior: 'instant' });
          section?.focus({ preventScroll: true });
        }} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-muted px-2 text-xs font-semibold text-secondary transition-colors hover:bg-active hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:flex-none sm:px-4">
          <span className="text-muted-foreground" aria-hidden="true">0{index + 1}</span>{phase.name}
        </button>)}
      </nav>
    </header>

    <div ref={bodyRef} data-hazard-safety-body className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:space-y-3 lg:py-3">
      <p className="text-sm leading-6 text-secondary">{guide.priority}</p>

      <div className="space-y-6 lg:grid lg:grid-cols-3 lg:grid-rows-[auto_repeat(2,minmax(0,1fr))] lg:gap-x-4 lg:gap-y-3 lg:space-y-0">
      {guide.phases.map((phase, index) => <section key={phase.name} data-safety-phase={phase.name} tabIndex={-1}
        aria-labelledby={`${id}-${phase.name}`} className="scroll-mt-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:gap-3">
        <div className="mb-3 flex items-center gap-3 lg:mb-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold tabular-nums text-secondary" aria-hidden="true">0{index + 1}</span>
          <div>
            <h3 id={`${id}-${phase.name}`} className="text-base font-bold text-primary">{phase.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{phase.description}</p>
          </div>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:row-span-2 lg:grid-cols-1 lg:grid-rows-subgrid">
          {phase.steps.map((step, stepIndex) => <li key={step.title} className="overflow-hidden rounded-xl bg-page lg:grid lg:grid-cols-[64px_minmax(0,1fr)] lg:items-start lg:gap-2 lg:p-3 xl:grid-cols-[84px_minmax(0,1fr)]">
            <div className="mx-auto w-full max-w-[240px] px-4 pt-2 lg:mt-1 lg:max-w-none lg:p-0"><HazardSafetyFigure kind={step.figure} /></div>
            <div className="px-4 pb-4 pt-2 lg:p-0">
              <h4 className="flex items-start gap-2 text-sm font-bold leading-5 text-primary lg:min-h-10">
                <span className="text-muted-foreground" aria-hidden="true">{index * 2 + stepIndex + 1}.</span>{step.title}
              </h4>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-secondary lg:leading-[18px]">
                {step.instructions.map(instruction => <li key={instruction} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current" aria-hidden="true" /><span>{instruction}</span></li>)}
              </ul>
            </div>
          </li>)}
        </ol>
      </section>)}
      </div>

      <aside className="border-t border-default pt-4 lg:pt-3">
        <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>Use these precautions regardless of your mapped result. Hazard maps show susceptibility, not live conditions. Follow current official advisories and local instructions.</span></p>
      </aside>
    </div>

    <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-default px-4 py-2 sm:gap-6 sm:px-6 sm:py-3">
      <nav aria-label="Safety sources" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 sm:flex-col sm:items-start">
        {guide.sources.map(source => <a key={source.href} href={source.href} target="_blank" rel="noopener noreferrer" aria-label={source.label} title={source.label}
          className="inline-flex min-h-6 items-center gap-1 rounded text-[10px] leading-4 text-muted-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <span className="sm:hidden">{source.shortLabel}</span><span className="hidden sm:inline">{source.label}</span><ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden="true" />
        </a>)}
      </nav>
      <button type="button" onClick={onClose} aria-label="Back to assessment"
        className="inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 sm:min-h-10 sm:gap-2 sm:px-5 sm:py-2 sm:text-sm">
        <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" /><span className="sm:hidden">Back</span><span className="hidden sm:inline">Back to assessment</span>
      </button>
    </footer>
  </Dialog>;
}
