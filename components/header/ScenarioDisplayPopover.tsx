'use client';

import { MapDisplayPopover } from './MapDisplayPopover';
import { scenarioDisplayStore, useScenarioDisplay } from '@/lib/map/scenarioDisplayStore';

export function ScenarioDisplayPopover({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const { basemap, mode, enableBuildings, enableRoads, renderMode, focusRoads, showParBoundary } = useScenarioDisplay();
  return <MapDisplayPopover basemap={basemap} mode={mode} showBuildings={enableBuildings} showRoads={enableRoads} className={className}
    showParBoundary={showParBoundary} onParBoundaryChange={scenarioDisplayStore.setShowParBoundary}
    onBasemapChange={scenarioDisplayStore.setBasemap} onModeChange={scenarioDisplayStore.setMode}
    smoothPolygons={renderMode === 'linear'} onSmoothingChange={smooth => scenarioDisplayStore.setRenderMode(smooth ? 'linear' : 'nearest')}
    onBuildingsChange={scenarioDisplayStore.setEnableBuildings} onRoadsChange={scenarioDisplayStore.setEnableRoads}
    mobileLabel compact={compact} focusRoads={focusRoads} onFocusRoadsChange={scenarioDisplayStore.setFocusRoads} />;
}
