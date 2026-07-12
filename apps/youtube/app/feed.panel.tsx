'use client';

import { dot } from '@dotui/elements';
import { VIDEOS, type Video } from './videos';

/**
 * The video grid — ONE card template rendered per video. The card lives inside the
 * `.map()` callback, so the compiler records it once as a repeated template
 * (`feed/panel#0/panel~0`, `repeated: true` in the schema) and stamps that id on the
 * single source element — every rendered card carries it, so overlays and prompts
 * restyle ALL cards together. Before repeated-template support this file hand-copied
 * six static cards; see docs/superpowers/specs/2026-07-06-repeated-dots-design.md.
 */
export function Feed({ onSelect }: { onSelect: (video: Video) => void }) {
  return (
    <dot.panel
      description="The main video feed grid."
      className="grid flex-1 grid-cols-1 gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {VIDEOS.map((video) => (
        <dot.panel
          key={video.id}
          description="Video card (template — one per video)."
          className="flex cursor-pointer flex-col gap-2"
          onClick={() => onSelect(video)}
        >
          <dot.image
            description="Video thumbnail."
            src={video.thumb}
            alt=""
            className="aspect-video w-full rounded-xl object-cover"
          />
          <dot.text
            required
            type="h3"
            description="Video title."
            className="text-sm font-semibold text-slate-900"
          >
            {video.title}
          </dot.text>
          <dot.text description="Channel name." className="text-xs text-slate-600">
            {video.channel}
          </dot.text>
          <dot.badge description="View count and age." className="text-xs text-slate-400">
            {`${video.views} · ${video.age}`}
          </dot.badge>
        </dot.panel>
      ))}
    </dot.panel>
  );
}
