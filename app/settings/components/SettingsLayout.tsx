'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouteLoader } from '@/components/RouteLoader';
import { homePathForRole, type StaffRole } from '@/lib/auth/roles';
import type { SectionId } from './SettingsNav';
import { SettingsNav } from './SettingsNav';

export function SettingsLayout({
  role,
  active,
  children,
}: {
  role: StaffRole | null;
  active: SectionId;
  children: React.ReactNode;
}) {
  const { navigate } = useRouteLoader();
  const home = homePathForRole(role);

  return (
    <div className="min-h-screen bg-page/80">
      <header className="flex h-24 shrink-0 items-center justify-between gap-4 border-b border-default bg-panel px-5 py-4 md:px-9">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(home ?? '/')}
            aria-label="Back to portal"
            className="rounded-full bg-page p-2.5 text-secondary ring-1 ring-default transition-colors hover:bg-muted hover:text-primary hover:ring-focus"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-[-0.02em] text-primary md:text-[1.75rem]">
              Settings
            </h1>
            <p className="mt-1 hidden truncate text-sm text-muted-foreground md:block">
              Your account settings and portal preferences
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-20 pt-6 md:px-7 md:pb-24 md:pt-8 lg:px-8">
        <div className="md:flex md:gap-8 lg:gap-10">
          <aside className="md:w-56 md:shrink-0 lg:w-64 md:sticky md:top-6 md:h-[calc(100vh-6rem)] md:overflow-y-auto">
            <SettingsNav active={active} isAdmin={role === 'admin'} />
          </aside>
          <main className="mt-6 flex-1 space-y-6 md:mt-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
