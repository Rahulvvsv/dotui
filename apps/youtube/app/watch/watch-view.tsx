'use client';

import { Promptable } from '@dotui/prompt';
import { useRouter, useSearchParams } from 'next/navigation';
import { VIDEOS, type Video } from '../videos';
import { Watch } from '../watch.panel';

/**
 * Resolves the `?v=<id>` param to a video and renders the watch page. Up-next picks and the
 * Back button are now navigations (not local state), so the URL is the single source of
 * truth for what's playing. `key={video.id}` remounts the player when the video changes,
 * resetting its playhead/like state just as the old state-driven shell did.
 */
export function WatchView() {
  const router = useRouter();
  const id = useSearchParams().get('v');
  const video = VIDEOS.find((v) => v.id === id);

  if (!video) {
    return (
      <Promptable panelId="watch/panel#0" className="flex-1">
        <div className="p-6 text-slate-600">
          Video not found.{' '}
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-blue-600 underline"
          >
            Back to the feed
          </button>
        </div>
      </Promptable>
    );
  }

  return (
    <Promptable panelId="watch/panel#0" className="flex-1">
      <Watch
        key={video.id}
        video={video}
        onSelect={(v: Video) => router.push(`/watch?v=${v.id}`)}
        onBack={() => router.push('/')}
      />
    </Promptable>
  );
}
