import { dot } from '@dotui/elements';

/**
 * Left navigation rail. Authored as a superset: every link a power user might want is
 * written out here; personas hide the clutter (Shorts / Explore) for simpler profiles.
 */
export function Sidebar() {
  return (
    <dot.panel
      description="Left navigation rail with primary, library, and explore sections."
      className="flex w-52 flex-col gap-1 border-r border-slate-200 bg-white p-3 text-sm"
    >
      <dot.button
        required
        description="Go to the home feed."
        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-100"
      >
        🏠 Home
      </dot.button>
      <dot.button
        description="Short-form video feed."
        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-100"
      >
        ⚡ Shorts
      </dot.button>
      <dot.button
        description="Channels you follow."
        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-100"
      >
        📺 Subscriptions
      </dot.button>

      <dot.text
        type="label"
        description="Section label for the personal library."
        className="mt-3 px-3 text-xs font-semibold uppercase text-slate-400"
      >
        You
      </dot.text>
      <dot.button
        description="Your video library."
        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-100"
      >
        📚 Library
      </dot.button>
      <dot.button
        description="Watch history."
        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-100"
      >
        🕘 History
      </dot.button>
      <dot.button
        description="Saved for later."
        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-100"
      >
        ⏰ Watch later
      </dot.button>
      <dot.button
        description="Videos you liked."
        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-100"
      >
        👍 Liked videos
      </dot.button>

      <dot.text
        type="label"
        description="Section label for discovery links."
        className="mt-3 px-3 text-xs font-semibold uppercase text-slate-400"
      >
        Explore
      </dot.text>
      <dot.button
        description="Trending videos."
        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-100"
      >
        🔥 Trending
      </dot.button>
      <dot.button
        description="Gaming hub."
        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-100"
      >
        🎮 Gaming
      </dot.button>
      <dot.button
        description="Music hub."
        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-100"
      >
        🎵 Music
      </dot.button>
    </dot.panel>
  );
}
