'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, PanelLeftClose, PanelLeftOpen, UserRound } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { createClient } from '@/lib/supabase/client';
import { getDisplayName, getStaffRole, type AuthSnapshot, type StaffRole } from '@/lib/auth/roles';
import { PortalNavItem } from '@/types/portal';
import { useRouteLoader } from './RouteLoader';
import { BentoMenu } from './BentoMenu';
import { getBentoTilesForRole } from '@/lib/navigation/bentoMenu';
import { TopoBackground } from '@/app/public-view/components/TopoBackground';

interface SideBarProps<T extends string> {
  activeTab: T;
  items: PortalNavItem<T>[];
  portalSubtitle: string;
  onTabChange: (tab: T) => void;
  showTopo?: boolean;
}

export function SignOutConfirmDialog({
  isOpen,
  isSigningOut,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  isSigningOut: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog isOpen={isOpen} onClose={onCancel} ariaLabelledBy={titleId} maxWidthClass="max-w-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-bg">
          <LogOut className="h-5 w-5 text-error-text" />
        </div>
        <div>
          <h2 id={titleId} className="text-base font-semibold text-primary">
            Sign out
          </h2>
          <p className="text-sm text-muted-foreground">End your portal session</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-secondary">
        Are you sure you want to sign out? You will need to sign in again to
        access the portal.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSigningOut}
          className="rounded-lg border border-default px-4 py-2 text-sm font-semibold text-secondary hover:bg-page disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSigningOut}
          className="inline-flex items-center gap-2 rounded-lg bg-error-solid px-4 py-2 text-sm font-semibold text-on-accent hover:bg-error-solid disabled:opacity-50"
        >
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </Dialog>
  );
}

export function MobileSignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const trigger = compact ? (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      disabled={isSigningOut}
      title="Sign out"
      aria-label="Sign out"
      className="rounded-lg border border-default p-2 text-secondary hover:bg-error-bg hover:text-error-text disabled:opacity-50"
    >
      <LogOut className="h-5 w-5" />
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      disabled={isSigningOut}
      className="flex flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-error-bg hover:text-error-text disabled:opacity-50"
    >
      <LogOut className="h-5 w-5" />
      <span className="truncate">{isSigningOut ? '...' : 'Sign out'}</span>
    </button>
  );

  return (
    <>
      {trigger}
      <SignOutConfirmDialog
        isOpen={showConfirm}
        isSigningOut={isSigningOut}
        onConfirm={handleSignOut}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}

export function SideBar<T extends string>({
  activeTab,
  items,
  portalSubtitle,
  onTabChange,
  initialAuth,
  showTopo = false,
}: SideBarProps<T> & { initialAuth?: AuthSnapshot }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [name, setName] = useState<string | null>(initialAuth?.name ?? null);
  const [email, setEmail] = useState<string | null>(initialAuth?.email ?? null);
  const [role, setRole] = useState<StaffRole | null>(initialAuth?.role ?? null);
  const { loadingOverlay } = useRouteLoader();

  useEffect(() => {
    if (initialAuth !== undefined) return;
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      setEmail(data.user.email ?? null);
      setName(getDisplayName(data.user.user_metadata, data.user.email ?? null));
      getStaffRole(supabase, data.user.id).then((staffRole) => {
        if (!cancelled) setRole(staffRole);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [initialAuth]);

  async function handleLogOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
    <aside
      className={`relative z-10 hidden h-full shrink-0 flex-col overflow-visible border-r border-default bg-page text-primary transition-[width] duration-300 lg:flex ${
        isCollapsed ? 'w-20' : 'w-60'
      }`}
    >
      {showTopo && <TopoBackground className="-z-10" />}
      <button
        type="button"
        onClick={() => setIsCollapsed((collapsed) => !collapsed)}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute right-[-1.25rem] top-7 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-panel text-secondary shadow-lg ring-4 ring-default transition-all duration-200 hover:scale-105 hover:bg-muted"
      >
        {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </button>

      <div className={`flex h-24 shrink-0 flex-col justify-center border-b border-default ${isCollapsed ? 'items-center px-3' : 'items-start px-7'}`}>
        <div className={`flex h-9 items-center ${isCollapsed ? 'w-9' : 'w-28'}`}>
          <Image
            src="/images/gakit_logo_adobe.svg"
            alt="GAKIT logo"
            width={160}
            height={48}
            priority
            className="h-full w-full object-contain"
          />
        </div>
        <div className={`mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground ${isCollapsed ? 'sr-only' : ''}`}>{portalSubtitle}</div>
      </div>

      <nav className={`flex-1 space-y-1 overflow-y-auto py-6 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        <div className={`pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground ${isCollapsed ? 'sr-only' : 'px-4'}`}>
          Apps
        </div>
        <BentoMenu
          items={getBentoTilesForRole(role)}
          variant="sidebar"
          isCollapsed={isCollapsed}
        />

        <div className={isCollapsed ? 'my-3 border-t border-default/80 mx-1' : 'pt-6 pb-2'}>
          <span className={`text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground ${isCollapsed ? 'sr-only' : 'px-4'}`}>
            Console
          </span>
        </div>
        {items.map((feature) => {
          const Icon = feature.icon;
          const isActive = activeTab === feature.id;

          return (
            <button
              key={feature.id}
              onClick={() => onTabChange(feature.id)}
              title={feature.badge ? `${feature.label} (${feature.badge})` : feature.label}
              className={`group flex w-full items-center rounded-2xl text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-muted text-accent-text'
                  : 'text-secondary hover:bg-panel hover:text-primary hover:shadow-sm'
              } ${
                isCollapsed ? 'justify-center px-3 py-2.5' : 'gap-3 px-4 py-3'
              }`}
            >
              <div className="relative shrink-0">
                <Icon
                  className={`h-5 w-5 transition-colors ${isActive ? 'text-accent-text' : 'text-muted-foreground group-hover:text-primary'}`}
                />
                {isCollapsed && !!feature.unreadCount && <sup aria-label={`${feature.unreadCount} unread alerts`} className="absolute -right-2 -top-1 rounded-full bg-muted px-1 py-0.5 text-[10px] font-bold leading-none text-primary">{feature.unreadCount > 99 ? '99+' : feature.unreadCount}</sup>}
                {feature.badge && isCollapsed && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500 ring-2 ring-default" />
                  </span>
                )}
              </div>
              <span className={`truncate whitespace-nowrap ${isCollapsed ? 'sr-only' : ''}`}>
                {feature.label}
              </span>
              {feature.unreadCount !== undefined && !isCollapsed && <sup aria-label={`${feature.unreadCount} unread alerts`} className="relative -top-1 ml-1 shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary">{feature.unreadCount > 99 ? '99+' : feature.unreadCount}</sup>}
              {feature.badge && !isCollapsed && (
                <span
                  title="Beta feature"
                  className="ml-auto flex items-center justify-center shrink-0 pr-1"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500 ring-2 ring-default" />
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className={`border-t border-default ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <div className={`mb-3 flex items-center rounded-2xl border border-default bg-page ${isCollapsed ? 'justify-center p-2.5' : 'gap-3 p-3'}`}>
          <UserRound className="h-5 w-5 shrink-0 text-secondary" />
          <div className={isCollapsed ? 'hidden' : 'min-w-0'}>
            <div className="truncate text-xs font-semibold text-primary">
              {name || email || '—'}
            </div>
            <div className="text-[11px] capitalize text-muted-foreground">
              {role || 'Loading role...'}
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={isSigningOut}
          title="Sign Out"
          className={`flex w-full items-center rounded-2xl py-2.5 text-sm font-semibold text-secondary transition-all duration-200 hover:bg-panel hover:text-error-text hover:shadow-sm disabled:opacity-50 ${
            isCollapsed ? 'justify-center px-3' : 'gap-3 px-3'
          }`}
        >
          <LogOut className="h-4.5 w-4.5" />
          <span className={isCollapsed ? 'sr-only' : ''}>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
        </button>
      </div>
    </aside>
    <SignOutConfirmDialog
      isOpen={showConfirm}
      isSigningOut={isSigningOut}
      onConfirm={handleLogOut}
      onCancel={() => setShowConfirm(false)}
    />
    {loadingOverlay}
    </>
  );
}
