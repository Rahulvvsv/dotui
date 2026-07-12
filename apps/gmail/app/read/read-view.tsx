'use client';

import { Promptable } from '@dotui/prompt';
import { useRouter, useSearchParams } from 'next/navigation';
import { EMAILS } from '../emails';
import { Read } from '../read.panel';

/**
 * Resolves the `?id=<id>` param to an email and renders the read view. Back is a navigation
 * (not local state), so the URL is the single source of truth for what's open. `key={id}`
 * remounts the reader when the message changes, resetting its star/reply state.
 */
export function ReadView() {
  const router = useRouter();
  const id = useSearchParams().get('id');
  const email = EMAILS.find((e) => e.id === id);

  if (!email) {
    return (
      <Promptable panelId="read/panel#0" className="flex min-w-0 flex-1">
        <div className="p-8 text-slate-600">
          Message not found.{' '}
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-blue-600 underline"
          >
            Back to the inbox
          </button>
        </div>
      </Promptable>
    );
  }

  return (
    <Promptable panelId="read/panel#0" className="flex min-w-0 flex-1">
      <Read key={email.id} email={email} onBack={() => router.push('/')} />
    </Promptable>
  );
}
