'use client';

import React, { useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import { RouteLoaderProvider } from '@/components/RouteLoader';
import { themeStore, useTheme } from '@/lib/theme/store';
import { scenarioDisplayStore } from '@/lib/map/scenarioDisplayStore';

export function ClientProviders({ children }: { children?: React.ReactNode }) {
  const { resolved } = useTheme();
  useEffect(() => themeStore.start(), []);

  // Restore persisted map-display preferences once, on the client, where
  // `localStorage` exists. Done here so the map honours them whichever route
  // the user lands on, not only after visiting Settings.
  useEffect(() => {
    scenarioDisplayStore.hydrate();
  }, []);

  return (
    <RouteLoaderProvider>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={resolved}
      />
    </RouteLoaderProvider>
  );
}
