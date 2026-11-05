'use client';

import type { LucideIcon } from 'lucide-react';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

export function FilterChips<T extends string>({
  options,
  value,
  onSelect,
  ariaLabel,
}: {
  options: readonly ChipOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map(({ value: optionValue, label, icon: Icon }) => {
        const isActive = optionValue === value;
        return (
          <button
            key={optionValue}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(optionValue)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? 'bg-accent text-on-accent'
                : 'bg-page text-secondary hover:bg-muted'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
