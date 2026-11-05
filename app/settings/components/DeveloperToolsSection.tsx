'use client';

import Link from 'next/link';
import { Switch } from '@/components/ui/Switch';
import { setDemoEnabled } from '@/lib/demo/settings';
import { useReportValidationMode } from '@/hooks/useReportValidationMode';

export function DeveloperToolsSection() {
  const globalMode = useReportValidationMode();
  return <div className="space-y-4">
    <Switch label="Auto-validate all reports" checked={globalMode.mode?.autoValidateReports ?? false}
      disabled={!globalMode.mode || globalMode.saving || Boolean(globalMode.error)}
      onChange={next => void globalMode.save(next)}
      description="Global demo setting: bypass the validation engine and mark every new public and staff report Verified. Applies to everyone, across all browsers, until an admin turns it off." />
    {globalMode.saving && <p role="status" className="text-xs text-muted-foreground">Saving global validation mode…</p>}
    {globalMode.error && <p role="alert" className="text-xs text-error-text">{globalMode.error} <button type="button" className="font-semibold underline" onClick={globalMode.retry}>Retry</button></p>}
    {globalMode.mode?.autoValidateReports && <p className="rounded-lg border border-warning-border bg-warning-bg p-3 text-xs text-warning-text">Demo approvals are active for everyone. Evidence checks and background assessments are paused. Turning this off restores normal validation for new reports.</p>}
    <div className="border-t border-default pt-4">
      <p className="mb-3 text-xs leading-5 text-muted-foreground">Play a synthetic storm, submit current or earlier observations, watch the validation engine decide, then inspect eligible depth and wet-area changes. The workspace uses normal validation by default; bypassing it is an explicit option. Public-map submissions do not feed the synthetic storm.</p>
      <Link href="/admin/demo" onClick={() => setDemoEnabled(true)} className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent">Open storm & report demo</Link>
    </div>
  </div>;
}
