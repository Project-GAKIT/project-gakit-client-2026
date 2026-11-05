'use client';

import { useId } from 'react';
import { themeStore, useTheme } from '@/lib/theme/store';
import type { Appearance } from '@/lib/theme/appearance';

export function AppearanceSelector({ compact = false, label = 'Theme' }: { compact?: boolean; label?: string }) {
  const id = useId();
  const { preference } = useTheme();
  return (
    <fieldset className={compact ? 'space-y-2 p-1' : 'space-y-3'}>
      <legend className="text-sm font-semibold text-primary">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {(['light', 'dark', 'system'] as Appearance[]).map(option => (
          <label key={option} className={`theme-choice flex cursor-pointer items-center gap-2 rounded-lg border py-2 text-xs ${compact ? 'px-2' : 'px-3'}`}>
            <input type="radio" name={`appearance-${id}`} value={option} checked={preference === option}
              onChange={() => themeStore.setPreference(option)} />
            {option[0].toUpperCase() + option.slice(1)}
          </label>
        ))}
      </div>
      {compact && <p className="text-[10px] text-secondary">Saved to this browser. Theme also changes the basemap.</p>}
      {!compact && <>
        <p className="text-xs text-secondary">Saved to this browser. System follows your device. Changing theme automatically changes the basemap.</p>
        <button type="button" className="ui-button text-xs" onClick={() => themeStore.setPreference('system')}>Reset theme to System</button>
      </>}
    </fieldset>
  );
}
