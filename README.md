# dotUI


This is my attempt at the problem Y Combinator put in their Requests for Startups —
[**Dynamic software interfaces**](https://www.ycombinator.com/rfs#dynamic-software-interfaces).
The premise there is that software interfaces have been static forever: one design, shipped
to everyone, regardless of who they are or what they're trying to do. Now that models can
write code, the interface itself could adapt per user. This repo is a working take on *how*
that could actually be built without the whole thing falling apart.

---

## The mental model

Take any website and strip out every visual decision — colours, spacing, radii, font sizes,
shadows, the whole lot. What's left? Not a blank page. What's left is **structure and
behaviour**: this thing is text, that thing is a button, this button opens the editor, these
things belong together in a group. None of those facts have a shape. They're just… points.
Dots.

So: a website is a graph of dots, connected by the interactions a developer wrote. Whether a
dot is rendered as a fat rounded green button or a plain underlined link is a completely
separate question — and it's exactly the kind of question LLMs are now good at answering.
Models write genuinely decent CSS today, and they're getting better every release. That's the
bet: **let the developer own the dots, let the model own the paint.**

Hence the name. dotUI. A UI made of dots.

The nice property of splitting it this way is that the dynamic part becomes *safe*. The model
never touches your logic, your data, or your DOM structure. It can't invent a checkout button
you never wrote. It returns a **style overlay** — a patch keyed by element id — and that's it.
The worst a bad generation can do is look ugly, and you can undo it.

---

## How it actually works

Three moving parts: you write JSX, a compiler extracts a schema, an LLM returns an overlay.

### 1. You write ordinary React + Tailwind

The only difference is you use `dot.*` components instead of raw tags. They render exactly what
you write — no magic, no runtime layout engine. `onClick`, `ref`, `aria-*`, hover classes, all
of it behaves like the native element.

```tsx
import { dot } from '@dotui/elements';

export function Profile({ name, role, avatarUrl, online }: ProfileProps) {
  return (
    <dot.panel
      description="The user's profile header — identity and primary action."
      className="flex items-center gap-4 rounded-lg border border-slate-200 p-4"
    >
      <dot.image required src={avatarUrl} alt={name} className="h-16 w-16 rounded-full" />

      <dot.panel className="flex flex-col gap-1">
        <dot.text required type="h2" description="The user's name."
                  className="text-lg font-semibold text-slate-900">
          {name}
        </dot.text>
        <dot.badge description="Online presence status." className="rounded bg-slate-100 px-2 text-xs">
          {online ? 'Online' : 'Offline'}
        </dot.badge>
      </dot.panel>

      <dot.button description="Opens profile editing."
                  className="ml-auto rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
        Edit profile
      </dot.button>
    </dot.panel>
  );
}
```

**The classes you write here are the default look — the design you actually want your users to
get.** This isn't a placeholder or a skeleton you're expected to leave ugly. Ship it exactly as
polished as you'd ship any other app; if nobody ever prompts anything, this is what everybody
sees, pixel for pixel. Generation is opt-in on top: a user who wants bigger text, a calmer
palette, or less clutter can ask for it, and only their view changes. Your default stays the
default for everyone else.

That's also why the palette is seeded from your classes rather than the model's taste — you're
handing the model your design language as a starting point, not a blank canvas.

`description` and `required` are notes *for the model*, not for the browser — they're captured
into the schema and stripped before anything reaches the DOM.

### `required` — which dots are load-bearing

`required` is how you tell the model what the screen actually *needs*. A profile header without
the person's name is broken; a profile header without the "Online" badge is just quieter.

- **`required` dots can be restyled, never hidden.** Colour, size, spacing, weight — all fair
  game. But they stay on screen no matter what anyone prompts. This is your floor: whatever
  happens, the interface still does its job.
- **Everything else is, by default, removable.** If you didn't mark a dot required, you've said
  it's nice-to-have — and the model is free to drop it when the user asks for something calmer,
  simpler, or bigger. A user who types *"just show me what I need"* gets exactly the required
  dots and nothing else, without you writing a single "compact mode". (Try *"show me only what
  I need"* in the demo — it works even on the offline mock generator.)

That inversion is the useful bit. In a normal app, every element you render is equally permanent,
so decluttering means building a second design. Here, *not* marking something required is you
saying "this can go if it's in the way", and the personalisation follows from that one flag. The
elderly persona in the demo apps is mostly this: big text plus dropping the non-essentials.

(Today `required` is carried in the schema and enforced in the generator's instructions rather
than by the guardrail — a hard "reject `hidden:true` on a required id" check is the obvious next
step, and a small one.)

### 2. `dotui build` extracts the schema

The compiler walks the JSX and gives every element a deterministic structural id, then writes
`.dotui/schema.json`. From the file above:

```json
{
  "panels": {
    "profile/panel#0/panel#0": {
      "kind": "panel",
      "element": "div",
      "className": "flex flex-col gap-1",
      "children": [
        "profile/panel#0/panel#0/text#0",
        "profile/panel#0/panel#0/badge#0"
      ]
    }
  },
  "dots": {
    "profile/panel#0/panel#0/text#0": {
      "kind": "text",
      "element": "h2",
      "className": "text-lg font-semibold text-slate-900",
      "required": true,
      "description": "The user's name.",
      "content": [{ "kind": "dynamic", "expr": "name" }]
    }
  },
  "palette": { "seededFromAuthor": ["bg-slate-900", "gap-4", "rounded-lg", "text-slate-500", "…"] }
}
```

Three things worth noticing:

- `{name}` became `{ "kind": "dynamic", "expr": "name" }` — an **opaque slot**. The schema
  records *that* there's a dynamic value there, never what it is. Real user data never goes to
  the model.
- The palette is seeded from **your own classes**, so generations start from your design
  language instead of some generic model default.
- The same id walk runs as a Babel plugin at app build time, stamping `__dotId` onto the live
  elements. Build-time schema and runtime DOM physically cannot disagree — one walk, two outputs.

### 3. The LLM returns an overlay, not code

Someone types *"make this calmer and hide the status badge"*. Server-side, the panel's slice of
the schema goes to the model, which is forced through a single `emit_overlay` tool call. What
comes back is only this:

```json
{
  "profile/panel#0":                  { "className": "gap-6 p-8 bg-slate-50" },
  "profile/panel#0/panel#0/text#0":   { "className": "text-slate-700 font-normal" },
  "profile/panel#0/panel#0/badge#0":  { "hidden": true }
}
```

Every patch then goes through a **guardrail**: each class must belong to an allowed Tailwind
family or it gets dropped and reported. Ids that don't exist are discarded. Patches outside the
targeted panel are discarded. The only fields a model can ever set are `className`, `style`, and
`hidden`.

At render time each `dot.*` does `twMerge(yourClasses, overlayClasses)` — override wins on
conflict — and a hidden dot returns `null`. Successive prompts stack. Undo pops the stack.

That's the whole loop: **author → extract → generate → guardrail → merge**.

---

## Why the constraints are the point

The obvious version of "AI generates your UI" is to have a model emit components at runtime.
That gives you an app that can break in production in ways you can't reproduce. The overlay
approach gives up structural generation on purpose, and gets three things back:

- **Your app still works.** Interactions, state, routing, accessibility — all authored by you,
  untouched by generation.
- **Failures are cosmetic and reversible.** No generated code path ever executes.
- **The dynamic part is cacheable and persistable.** An overlay is a small JSON blob you can
  version, snapshot, roll back, or hand to another user.

The pattern for "but I want the model to *add* something" is **author a superset and hide by
default** — write every element that might ever be shown, ship it hidden, and let an overlay
reveal it with `hidden: false`.

That's also the headline demo. `apps/youtube` and `apps/gmail` are one authored UI each, with a
persona switcher (All info / Young / Middle-aged / Elderly) that swaps the whole overlay
client-side. The elderly persona gets large text and a stripped-down interface; the young one
gets everything, compact. **Same JSX tree, same components, same code — different interface per
user.** That's the YC RFS prompt, working.

---

## Try it

```powershell
corepack pnpm install
corepack pnpm build                                   # build the @dotui/* packages
corepack pnpm test                                    # 83 tests

corepack pnpm --filter "@dotui/youtube" run dev       # http://localhost:3001 — persona demo
corepack pnpm --filter "@dotui/gmail"   run dev       # http://localhost:3002 — persona demo + saved visuals
corepack pnpm --filter "@dotui/demo"    run dev       # http://localhost:3000 — minimal example + devtools
```

Without an `OPENAI_API_KEY` everything still runs — a deterministic mock generator stands in, so
you can see the whole pipeline work offline. Drop a key into `apps/<app>/.env.local` to get real
generations. Both engines sit behind the same `Generator` interface; the slice → generate →
guardrail → apply path is identical either way.

The floating  control on each app is the end-user surface: prompt one panel or all of them,
undo, reset, and save named "visuals" you can switch between.

## Packages

| Package | What it owns |
| --- | --- |
| `@dotui/core` | Schema types + Zod, the closed kind→element vocabulary, guardrail families, overlay merge |
| `@dotui/compiler` | `dotui build` — Babel extraction, the single id walk, and the plugin that stamps ids |
| `@dotui/elements` | The `dot.*` components and the overlay context |
| `@dotui/guardrail` | Class→family classifier and overlay validator |
| `@dotui/llm` | Panel slicing, the `Generator` seam, OpenAI + mock generators |
| `@dotui/prompt` | The in-product  edit UI: prompting, undo/reset, saved visuals, toasts |
| `@dotui/store` | Overlay persistence, version history, schema snapshots (Drizzle + libSQL) |
| `@dotui/devtools` | Drop-in inspector: the schema and the stored overlays, side by side |

`ARCHITECTURE.md` walks a single panel end to end through all of them. `PROGRESS.md` has the
build log and what's still open.

---

## About this repo, honestly

I built this with Claude and Codex. If you look at it and think "AI slop", that's fair and I'm
completely okay with it — I wasn't trying to win a craftsmanship award, I was trying to find out
whether the idea holds up when you actually build it. It does, further than I expected, which is
why it's worth sharing.

What I actually want to share is the thought process: **strip the styling, see the dots, give the
dots to the developer and the paint to the model.** The code is just the argument's evidence.

If any of this is useful to you — take it. Fork it, lift the idea, build something better, ship
it commercially, I genuinely don't mind. I'd rather the idea get built well by someone else than
sit here being mine.