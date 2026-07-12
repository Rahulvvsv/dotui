'use client';

import { dot } from '@dotui/elements';
import { useEffect, useState } from 'react';
import { VIDEOS, type Video } from './videos';

const DURATION = 213; // 3:33, just for the mock playhead

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * The watch page. Pure dotUI, and a clear demo of state: a play/pause toggle drives a
 * ticking playhead (setInterval → `seconds`), a like toggle flips its own state, and
 * picking an "up next" video swaps `video` (owned by the shell). All three reset/advance
 * the UI live — open the React devtools and watch the state change.
 */
export function Watch({
  video,
  onSelect,
  onBack,
}: {
  video: Video;
  onSelect: (video: Video) => void;
  onBack: () => void;
}) {
  const [playing, setPlaying] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [liked, setLiked] = useState(false);

  // Advance the playhead once a second while playing; loop at the end. (The shell remounts
  // this component via `key={video.id}`, so switching videos resets all of this state.)
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setSeconds((s) => (s >= DURATION ? 0 : s + 1)), 1000);
    return () => clearInterval(t);
  }, [playing]);

  const pct = Math.round((seconds / DURATION) * 100);
  const upNext = VIDEOS.filter((v) => v.id !== video.id).slice(0, 4);

  return (
    <dot.panel
      description="The watch page — player, details, and up-next."
      className="flex flex-1 gap-6 p-5"
    >
      <dot.panel description="Player column." className="flex flex-1 flex-col gap-3">
        <dot.button
          description="Back to the feed."
          onClick={onBack}
          className="w-fit rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200"
        >
          ← Back
        </dot.button>

        <dot.panel
          description="Video player."
          className="relative aspect-video w-full overflow-hidden rounded-xl bg-black"
        >
          <dot.image
            description="Now-playing frame."
            src={video.thumb}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
          <dot.badge
            description="Playback status."
            className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white"
          >
            {playing ? '🔴 Playing' : '⏸ Paused'}
          </dot.badge>
          <dot.button
            description="Toggle play/pause."
            onClick={() => setPlaying((p) => !p)}
            className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-2xl text-white hover:bg-black/70"
          >
            {playing ? '⏸' : '▶'}
          </dot.button>
          <dot.panel
            description="Scrubber."
            className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 text-xs text-white"
          >
            <dot.text>{fmt(seconds)}</dot.text>
            <dot.panel className="relative h-1 flex-1 rounded-full bg-white/30">
              <dot.panel
                className="absolute left-0 top-0 h-1 rounded-full bg-red-500"
                style={{ width: `${pct}%` }}
              />
            </dot.panel>
            <dot.text>{fmt(DURATION)}</dot.text>
          </dot.panel>
        </dot.panel>

        <dot.text
          required
          type="h1"
          description="Video title."
          className="text-xl font-bold text-slate-900"
        >
          {video.title}
        </dot.text>
        <dot.panel description="Channel row and actions." className="flex items-center gap-3">
          <dot.text description="Channel name." className="text-sm font-medium text-slate-700">
            {video.channel}
          </dot.text>
          <dot.text
            description="Views and age."
            className="text-xs text-slate-500"
          >{`${video.views} · ${video.age}`}</dot.text>
          <dot.button
            description="Like this video."
            onClick={() => setLiked((l) => !l)}
            className={`ml-auto rounded-full px-3 py-1 text-sm ${liked ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {liked ? '👍 Liked' : '👍 Like'}
          </dot.button>
          <dot.button
            description="Share this video."
            className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200"
          >
            ↗ Share
          </dot.button>
        </dot.panel>
        <dot.panel
          description="Description."
          className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700"
        >
          {video.description}
        </dot.panel>
      </dot.panel>

      <dot.panel description="Up-next list." className="flex w-72 flex-col gap-3">
        <dot.text
          type="label"
          description="Up-next heading."
          className="text-sm font-semibold text-slate-900"
        >
          Up next
        </dot.text>
        {upNext.map((v) => (
          <dot.panel
            key={v.id}
            description="Up-next video row (template — one per suggestion)."
            // biome-ignore lint/a11y/useSemanticElements: dot.panel is a styled template row (thumbnail + title), so button semantics are layered on via role/tabIndex/onKeyDown rather than swapping to <button>.
            role="button"
            tabIndex={0}
            onClick={() => onSelect(v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(v);
              }
            }}
            className="flex cursor-pointer items-center gap-3 rounded-lg p-1 text-left hover:bg-slate-100"
          >
            <dot.image
              description="Up-next thumbnail."
              src={v.thumb}
              alt=""
              className="h-12 w-20 shrink-0 rounded object-cover"
            />
            <dot.text description="Up-next title." className="text-xs font-medium text-slate-800">
              {v.title}
            </dot.text>
          </dot.panel>
        ))}
      </dot.panel>
    </dot.panel>
  );
}
