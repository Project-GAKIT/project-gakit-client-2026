'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings } from 'lucide-react';

/**
 * Account/settings menu behind the header gear icon. Cross-portal navigation
 * lives in the Apps (bento) launcher, so this menu only surfaces Settings.
 */
export function SettingsDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setIsOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [isOpen]);

  const go = (path: string) => {
    setIsOpen(false);
    router.push(path);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Open settings"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`rounded-full p-2.5 transition-all duration-150 active:scale-95 ${
          isOpen
            ? 'bg-muted text-secondary ring-1 ring-focus/80 font-bold'
            : 'bg-page ring-1 ring-default hover:bg-muted hover:text-primary'
        }`}
      >
        <Settings className="h-5 w-5 text-secondary" />
      </button>

      {isOpen && (
        <div className="fixed inset-x-4 top-16 z-[1300] overflow-hidden rounded-2xl border border-default bg-panel shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-3 md:w-56">
          <div className="border-b border-default px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Settings
            </p>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              onClick={() => go('/settings')}
              className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-secondary transition-colors hover:bg-page"
            >
              Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}