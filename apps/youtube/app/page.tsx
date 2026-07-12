'use client';

import { Promptable } from '@dotui/prompt';
import { useRouter } from 'next/navigation';
import { Feed } from './feed.panel';
import type { Video } from './videos';

/**
 * The home route: the video feed. Clicking a card navigates to the watch URL for that
 * video (`/watch?v=<id>`) — a real, refreshable, deep-linkable URL. The shared chrome and
 * the prompt provider live in the layout, so this page only renders the body it owns.
 */
export default function Page() {
  const router = useRouter();
  return (
    <Promptable panelId="feed/panel#0" className="flex-1">
      <Feed onSelect={(video: Video) => router.push(`/watch?v=${video.id}`)} />
    </Promptable>
  );
}
