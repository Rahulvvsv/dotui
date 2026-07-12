'use client';

import { Promptable } from '@dotui/prompt';
import { useRouter } from 'next/navigation';
import type { Email } from './emails';
import { Inbox } from './inbox.panel';

/**
 * The home route: the inbox. Clicking a row navigates to the read URL for that message
 * (`/read?id=<id>`) — a real, refreshable, deep-linkable URL. The shared chrome and the
 * prompt provider live in the layout, so this page only renders the body it owns.
 */
export default function Page() {
  const router = useRouter();
  return (
    <Promptable panelId="inbox/panel#0" className="flex min-w-0 flex-1">
      <Inbox onSelect={(email: Email) => router.push(`/read?id=${email.id}`)} />
    </Promptable>
  );
}
