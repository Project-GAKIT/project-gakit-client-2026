import type { UserStatus } from '@/types/admin';

export const USER_STATUS_META: Record<
  UserStatus,
  { label: string; className: string }
> = {
  active: {
    label: 'Active',
    className: 'bg-success-bg text-success-text border-success-border',
  },
  pending: {
    label: 'Pending',
    className: 'bg-muted text-secondary border-default',
  },
  suspended: {
    label: 'Deactivated',
    className: 'bg-muted text-secondary border-default',
  },
};

export function formatRoleLabel(role: string | null): string {
  if (!role) return 'No role';
  const normalized = role.replace(/[_-]+/g, ' ').trim();
  if (!normalized) return 'No role';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export const AUDIT_ACTION_META: Record<string, { label: string; className: string }> = {
  'user.invited': { label: 'Invitation sent', className: 'bg-info-bg text-info-text border-info-border' },
  'user.invite_resent': { label: 'Invitation resent', className: 'bg-info-bg text-info-text border-info-border' },
  'user.role_changed': { label: 'Role changed', className: 'bg-notice-bg text-notice-text border-notice-border' },
  'user.suspended': { label: 'User deactivated', className: 'bg-error-bg text-error-text border-error-border' },
  'user.activated': { label: 'User reactivated', className: 'bg-success-bg text-success-text border-success-border' },
  'role.created': { label: 'Role created', className: 'bg-info-bg text-info-text border-info-border' },
  'role.updated': { label: 'Role updated', className: 'bg-warning-bg text-warning-text border-warning-border' },
};

export function auditActionMeta(action: string): { label: string; className: string } {
  return AUDIT_ACTION_META[action] ?? {
    label: action,
    className: 'bg-muted text-secondary border-default',
  };
}

export const AUDIT_ACTION_OPTIONS = Object.keys(AUDIT_ACTION_META);

export function shortenId(id: string | null): string {
  if (!id) return '—';
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export function formatJsonDetails(details: Record<string, unknown> | null): string {
  if (!details) return '—';
  const entries = Object.entries(details)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
  return entries.length > 0 ? entries.join(', ') : '—';
}