'use client';

import Image from 'next/image';
import { typhoonIconURL } from '@/lib/map/typhoonIcons';

import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, X, Wind } from 'lucide-react';
import {
  PRIMARY_TYPHOON_CATEGORIES,
  TYPHOON_CATEGORY_CONFIG,
} from '@/lib/map/typhoon';

interface TyphoonScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const emptySubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function TyphoonScaleModal({ isOpen, onClose }: TyphoonScaleModalProps) {
  const mounted = useMounted();

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="typhoon-scale-title"
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-scrim/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-default bg-panel shadow-2xl animate-in fade-in duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-default p-4 md:px-5 md:py-4 bg-page/60">
          <div className="flex items-center gap-3">
            <span className="rounded-xl p-2 bg-muted text-secondary shrink-0 shadow-xs">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="typhoon-scale-title"
                className="text-base font-bold text-primary leading-snug"
              >
                Typhoon Track Legend
              </h2>
              <p className="text-[11px] text-muted-foreground">
                DOST-PAGASA official classification scale
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close legend modal"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-page hover:text-secondary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3 divide-y divide-default">
          {PRIMARY_TYPHOON_CATEGORIES.map((code) => {
            const cfg = TYPHOON_CATEGORY_CONFIG[code];
            if (!cfg) return null;

            return (
              <div
                key={code}
                className="pt-3 first:pt-0 flex items-start gap-3.5 group"
              >
                <Image
                  src={typhoonIconURL(code)}
                  alt={code}
                  width={36}
                  height={36}
                  unoptimized
                  className="h-9 w-9 shrink-0 mt-0.5 object-contain"
                />

                {/* Info Block */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-1.5 mb-1">
                    <span className="text-sm font-bold text-primary leading-tight">
                      {cfg.name}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary bg-muted border border-default/80 px-2 py-0.5 rounded-full">
                      <Wind className="w-3 h-3 text-muted-foreground" />
                      <span>{cfg.windRange}</span>
                    </span>
                  </div>

                  {cfg.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {cfg.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-default p-4 md:px-5 md:py-3.5">
          <a
            href="https://bagong.pagasa.dost.gov.ph/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[10px] text-muted-foreground hover:text-primary hover:underline"
            title="Tropical cyclone tracking data by DOST-PAGASA"
          >
            © DOST-PAGASA
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover transition-colors shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
