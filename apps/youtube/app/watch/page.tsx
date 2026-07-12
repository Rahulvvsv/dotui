import { Suspense } from 'react';
import { WatchView } from './watch-view';

/**
 * The watch route (`/watch?v=<id>`). A server shell that wraps the client view in Suspense
 * (required because the view reads the `?v=` search param). Deep-linkable and refreshable —
 * the layout restores the persisted overlay, this route restores which video is playing.
 */
export default function WatchPage() {
  return (
    <Suspense>
      <WatchView />
    </Suspense>
  );
}
