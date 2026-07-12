import type { ContentPart, DotNode, PanelNode, SchemaFile } from '@dotui/core';

/**
 * Read-only inspector for the committed build artifact (`.dotui/schema.json`):
 * the constant contract `dotui build` emits and the LLM reads. Shows the palette,
 * every panel (structure + classes), and every addressable dot (content + metadata).
 */
export function SchemaView({ schema }: { schema: SchemaFile }) {
  const panels = Object.values(schema.panels);
  const dots = Object.values(schema.dots);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-slate-400">
        Build artifact · schema v{schema.version} · {panels.length} panels · {dots.length} dots
      </p>

      <Section label="Palette">
        <Sub label={`families (${schema.palette.families.length})`}>
          <Chips items={schema.palette.families} tone="violet" />
        </Sub>
        <Sub label={`seeded from author (${schema.palette.seededFromAuthor.length})`}>
          <Chips items={schema.palette.seededFromAuthor} tone="slate" />
        </Sub>
      </Section>

      <Section label={`Panels (${panels.length})`}>
        {panels.map((panel) => (
          <PanelCard key={panel.id} panel={panel} />
        ))}
      </Section>

      <Section label={`Dots (${dots.length})`}>
        {dots.map((dot) => (
          <DotCard key={dot.id} dot={dot} />
        ))}
      </Section>
    </div>
  );
}

function PanelCard({ panel }: { panel: PanelNode }) {
  return (
    <div className="rounded bg-slate-800 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <span className="break-all font-mono text-[11px] text-emerald-300">{panel.id}</span>
        <Tag>{`<${panel.element}>`}</Tag>
        {panel.dynamicClassName && <Tag tone="amber">dynamic class</Tag>}
      </div>
      {panel.description && <p className="mt-1 text-slate-400">{panel.description}</p>}
      <ClassLine className={panel.className} />
      <p className="mt-1 text-[10px] text-slate-500">{panel.children.length} children</p>
    </div>
  );
}

function DotCard({ dot }: { dot: DotNode }) {
  return (
    <div className="rounded bg-slate-800 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="break-all font-mono text-[11px] text-sky-300">{dot.id}</span>
        <Tag>{`${dot.kind} → <${dot.element}>`}</Tag>
        {dot.required && <Tag tone="rose">required</Tag>}
        {dot.dynamicClassName && <Tag tone="amber">dynamic class</Tag>}
      </div>
      {dot.description && <p className="mt-1 text-slate-400">{dot.description}</p>}
      <ClassLine className={dot.className} />
      {dot.content.length > 0 && (
        <p className="mt-1 font-mono text-[10px]">
          {dot.content.map((part) => (
            <ContentChip
              key={part.kind === 'static' ? `s:${part.value}` : `d:${part.expr}`}
              part={part}
            />
          ))}
        </p>
      )}
    </div>
  );
}

function ContentChip({ part }: { part: ContentPart }) {
  if (part.kind === 'static') {
    return <span className="mr-1 rounded bg-slate-700 px-1 text-slate-200">“{part.value}”</span>;
  }
  return (
    <span className="mr-1 rounded bg-amber-900/60 px-1 text-amber-200">{`{${part.expr}}`}</span>
  );
}

function ClassLine({ className }: { className: string }) {
  if (!className)
    return <p className="mt-1 text-[10px] italic text-slate-500">no author classes</p>;
  return <p className="mt-1 break-all font-mono text-[10px] text-slate-300">{className}</p>;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  );
}

function Sub({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] text-slate-500">{label}</p>
      {children}
    </div>
  );
}

const TONE = {
  slate: 'bg-slate-700 text-slate-200',
  violet: 'bg-violet-900/60 text-violet-200',
  amber: 'bg-amber-900/60 text-amber-200',
  rose: 'bg-rose-900/60 text-rose-200',
} as const;

function Chips({ items, tone }: { items: string[]; tone: keyof typeof TONE }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span key={item} className={`rounded px-1 font-mono text-[10px] ${TONE[tone]}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function Tag({
  children,
  tone = 'slate',
}: { children: React.ReactNode; tone?: keyof typeof TONE }) {
  return <span className={`rounded px-1 text-[10px] ${TONE[tone]}`}>{children}</span>;
}
