import type { Overlay } from '@dotui/elements';

/**
 * The whole point of this demo: one authored JSX tree, four audiences. Each persona is a
 * plain dotUI overlay keyed by the *real* ids from `.dotui/schema.json`. Switching persona
 * swaps the entire overlay, so there is no stale state to clear — a value of `{}` is the
 * UI exactly as authored. className patches only need the utilities that change;
 * tailwind-merge lets the overlay win over the authored class (e.g. `text-lg` beats `text-sm`).
 *
 * Overlays can restyle and hide/show authored dots — they cannot add new structure. So the
 * panels author a *superset* (every link/card a power user might want) and personas hide the
 * clutter for simpler profiles.
 */

export type Persona = 'all' | 'young' | 'middle' | 'elderly';

export const PERSONA_LABELS: Record<Persona, string> = {
  all: 'All info',
  young: 'Young',
  middle: 'Middle-aged',
  elderly: 'Elderly',
};

export const PERSONA_HINTS: Record<Persona, string> = {
  all: 'Everything, exactly as authored.',
  young: 'Dense and compact — every shortcut visible, small text.',
  middle: 'Balanced sizing, all sections visible.',
  elderly: 'Large text, big targets, clutter hidden.',
};

/** Young: power user. Everything visible, compact and dense. */
const young: Overlay = {
  'topbar/panel#0/text#0': { className: 'text-base' },
  'sidebar/panel#0/button#0': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#1': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#2': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#3': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#4': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#5': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#6': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#7': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#8': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#9': { className: 'px-3 py-1.5 text-xs' },
  'feed/panel#0': { className: 'gap-3 p-3' },
  // One template id styles the title on EVERY card (was six per-card entries).
  'feed/panel#0/panel~0/text#0': { className: 'text-xs' },
};

/** Middle-aged: balanced. All sections visible, comfortable sizing. */
const middle: Overlay = {
  'sidebar/panel#0/button#0': { className: 'text-sm' },
  'feed/panel#0': { className: 'gap-5 p-5' },
  'feed/panel#0/panel~0/text#0': { className: 'text-base' },
};

/**
 * Elderly: large, readable, low-clutter. Big text and targets; hide Shorts, the
 * Explore section, the Create action, and the per-card metadata badges.
 *
 * NOTE: the feed cards are now a repeated template, so per-card overrides (the old
 * "show only four cards") are no longer expressible — template styling applies to
 * every instance. Per-instance targeting (dotKey) is a future cycle.
 */
const elderly: Overlay = {
  // Bigger brand + search.
  'topbar/panel#0/text#0': { className: 'text-2xl' },
  'topbar/panel#0/panel#0/input#0': { className: 'text-base py-2.5' },
  'topbar/panel#0/button#0': { hidden: true }, // Create — hidden
  // Sidebar: bigger touch targets; hide the noisy bits.
  'sidebar/panel#0/button#0': { className: 'text-lg py-3' },
  'sidebar/panel#0/button#1': { hidden: true }, // Shorts
  'sidebar/panel#0/button#2': { className: 'text-lg py-3' },
  'sidebar/panel#0/button#3': { className: 'text-lg py-3' },
  'sidebar/panel#0/button#4': { className: 'text-lg py-3' },
  'sidebar/panel#0/button#5': { className: 'text-lg py-3' },
  'sidebar/panel#0/button#6': { className: 'text-lg py-3' },
  'sidebar/panel#0/text#1': { hidden: true }, // "Explore" label
  'sidebar/panel#0/button#7': { hidden: true }, // Trending
  'sidebar/panel#0/button#8': { hidden: true }, // Gaming
  'sidebar/panel#0/button#9': { hidden: true }, // Music
  // Feed: large titles on every card, metadata badges hidden on every card.
  'feed/panel#0/panel~0/text#0': { className: 'text-xl font-bold' },
  'feed/panel#0/panel~0/badge#0': { hidden: true },
};

export const PERSONAS: Record<Persona, Overlay> = { all: {}, young, middle, elderly };
