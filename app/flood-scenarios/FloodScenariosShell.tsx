'use client';

import './FloodScenarios.css';

import { useState } from 'react';
import { PublicHeader } from '@/components/PublicHeader';
import { ScenarioDisplayPopover } from '@/components/header/ScenarioDisplayPopover';
import type { AuthSnapshot } from '@/lib/auth/roles';
import { ScenariosTab } from './ScenariosTab';
import { SCENARIO_PRESETS, type ScenarioPreset } from '@/types/scenario';

/**
 * Flood scenarios is a standalone map surface, not a monitoring tab: it borrows
 * the public hazard map's full-bleed layout, with a scenario picker and playback
 * controls. The header provides location context and navigation to the public map.
 */
export function FloodScenariosShell({ initialAuth }: { initialAuth?: AuthSnapshot }) {
  const [activePreset, setActivePreset] = useState<ScenarioPreset>(() => SCENARIO_PRESETS.find(p => p.id === 'sendong') || SCENARIO_PRESETS[0]);
  return (
    <div data-map-shell data-scenario-map-shell className="relative h-[100dvh] w-full overflow-hidden bg-muted">
      <PublicHeader
        initialAuth={initialAuth}
        showBentoMenu
        hideMobileAlertsAndMenu
        showAlerts={false}
        guideVariant="scenarios"
        showSectionNav={false}
        showBottomNav={false}
        extraAction={<ScenarioDisplayPopover />}
      />
      <ScenariosTab active activePreset={activePreset} onSelectPreset={setActivePreset} />
    </div>
  );
}
