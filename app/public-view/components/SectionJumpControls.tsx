'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';

export function SectionJumpControls({
  showUp,
  showDown,
  onMoveUp,
  onMoveDown,
}: {
  showUp: boolean;
  showDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <>
      {showUp && (
        <button
          type="button"
          onClick={onMoveUp}
          className="fixed left-1/2 top-20 z-[1100] flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-contrast/35 text-muted-foreground shadow-lg shadow-black/25 ring-1 ring-default/20 backdrop-blur-md transition-all duration-150 hover:bg-contrast/55 hover:text-on-accent hover:scale-105 active:scale-90"
          aria-label="Back to hazard map"
        >
          <ChevronUp className="h-5 w-5 stroke-[2.25]" />
        </button>
      )}

      {showDown && (
        <button
          type="button"
          onClick={onMoveDown}
          className="fixed bottom-5 left-1/2 z-[990] hidden md:flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-contrast/35 text-muted-foreground shadow-lg shadow-black/25 ring-1 ring-default/20 backdrop-blur-md transition-all duration-150 hover:bg-contrast/55 hover:text-on-accent hover:scale-105 active:scale-90"
          aria-label="Jump to about section"
        >
          <ChevronDown className="h-5 w-5 stroke-[2.25]" />
        </button>
      )}
    </>
  );
}
