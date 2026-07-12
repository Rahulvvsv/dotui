import { Suspense } from 'react';
import { ReadView } from './read-view';

/**
 * The read route (`/read?id=<id>`). A server shell that wraps the client view in Suspense
 * (required because the view reads the `?id=` search param). Deep-linkable and refreshable —
 * the layout restores the persisted overlay, this route restores which message is open.
 */
export default function ReadPage() {
  return (
    <Suspense>
      <ReadView />
    </Suspense>
  );
}
