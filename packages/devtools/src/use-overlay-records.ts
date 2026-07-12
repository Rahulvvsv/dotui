import { useEffect, useState } from 'react';
import type { DevtoolsData, OverlayRecordView } from './types';

/**
 * Polls the records endpoint while `active` is true and returns the latest table
 * rows plus the merged current overlay. Transient fetch errors are swallowed so a
 * blip doesn't clear the panel. Stops polling (and ignores in-flight responses)
 * when `active` flips false or the component unmounts.
 */
export function useOverlayRecords(
  endpoint: string | null,
  pollMs: number,
  active: boolean,
): DevtoolsData {
  const [data, setData] = useState<DevtoolsData>({ current: {}, records: [] });

  useEffect(() => {
    if (!active || endpoint === null) return;
    let live = true;
    const load = async () => {
      try {
        const res = await fetch(endpoint);
        const json = (await res.json()) as Partial<DevtoolsData>;
        if (!live) return;
        setData({
          current: json.current ?? {},
          records: (json.records ?? []) as OverlayRecordView[],
        });
      } catch {
        /* ignore transient errors while polling */
      }
    };
    load();
    const timer = setInterval(load, pollMs);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [endpoint, pollMs, active]);

  return data;
}
