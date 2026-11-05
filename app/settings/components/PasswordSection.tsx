'use client';

import { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { toast } from 'react-toastify';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/auth/authErrors';
import { validatePasswordChange } from '@/lib/auth/passwordPolicy';

export function PasswordSection({ email }: { email: string | null }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = validatePasswordChange({ current, next, confirm });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (!email) {
      setError('Your account email could not be loaded. Reload the page and try again.');
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (reauthError) {
      setError(
        /invalid login/i.test(reauthError.message)
          ? 'Your current password is incorrect.'
          : friendlyAuthError(reauthError)
      );
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    if (updateError) {
      setError(friendlyAuthError(updateError));
      setSaving(false);
      return;
    }

    setCurrent('');
    setNext('');
    setConfirm('');
    setSaving(false);
    toast.success('Password updated');
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={saving} className="space-y-4">
      <PasswordField
        id="current-password"
        label="Current password"
        value={current}
        onChange={setCurrent}
        show={show}
        autoComplete="current-password"
      />
      <PasswordField
        id="new-password"
        label="New password"
        value={next}
        onChange={setNext}
        show={show}
        autoComplete="new-password"
      />
      <PasswordField
        id="confirm-password"
        label="Confirm new password"
        value={confirm}
        onChange={setConfirm}
        show={show}
        autoComplete="new-password"
      />

      <button
        type="button"
        onClick={() => setShow((visible) => !visible)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
        aria-pressed={show}
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {show ? 'Hide passwords' : 'Show passwords'}
      </button>

      {error && (
        <div role="alert" className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">
          {error}
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {saving ? 'Updating password' : ''}
      </p>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-secondary">
        {label}
      </label>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder="At least 8 characters"
          className="w-full rounded-lg border border-default bg-page py-2.5 pl-10 pr-3 text-sm text-secondary outline-none transition-colors placeholder:text-muted-foreground focus:border-strong/40 focus:bg-panel focus:ring-2 focus:ring-focus/10"
        />
      </div>
    </div>
  );
}
