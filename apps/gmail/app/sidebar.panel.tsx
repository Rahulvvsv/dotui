import { dot } from '@dotui/elements';

/**
 * Left navigation rail. Authored as a superset: every folder, system view, and label a
 * power user might want is written out here. A declutter prompt (or a persona) hides the
 * non-essential rows — only Compose and Inbox are marked `required`, so "show only what I
 * need" collapses this to the essentials.
 */
export function Sidebar() {
  return (
    <dot.panel
      description="Left navigation rail: compose, mail folders, and labels."
      className="flex w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-slate-200 bg-white p-3 text-sm"
    >
      <dot.button
        required
        description="Compose a new message."
        className="mb-3 flex w-fit items-center gap-3 rounded-2xl bg-blue-100 px-5 py-3.5 font-medium text-blue-900 shadow-sm hover:bg-blue-200 hover:shadow"
      >
        ✏️ Compose
      </dot.button>

      <dot.button
        required
        description="Inbox — your primary mail (12 unread)."
        className="flex items-center gap-4 rounded-r-full bg-blue-50 px-4 py-2 font-semibold text-blue-900"
      >
        📥 Inbox
      </dot.button>
      <dot.button
        description="Starred messages."
        className="flex items-center gap-4 rounded-r-full px-4 py-2 text-slate-700 hover:bg-slate-100"
      >
        ⭐ Starred
      </dot.button>
      <dot.button
        description="Snoozed messages."
        className="flex items-center gap-4 rounded-r-full px-4 py-2 text-slate-700 hover:bg-slate-100"
      >
        ⏰ Snoozed
      </dot.button>
      <dot.button
        description="Sent mail."
        className="flex items-center gap-4 rounded-r-full px-4 py-2 text-slate-700 hover:bg-slate-100"
      >
        📤 Sent
      </dot.button>
      <dot.button
        description="Drafts (3)."
        className="flex items-center gap-4 rounded-r-full px-4 py-2 text-slate-700 hover:bg-slate-100"
      >
        📝 Drafts
      </dot.button>
      <dot.button
        description="Important mail."
        className="flex items-center gap-4 rounded-r-full px-4 py-2 text-slate-700 hover:bg-slate-100"
      >
        🏷️ Important
      </dot.button>
      <dot.button
        description="Scheduled mail."
        className="flex items-center gap-4 rounded-r-full px-4 py-2 text-slate-700 hover:bg-slate-100"
      >
        🕓 Scheduled
      </dot.button>
      <dot.button
        description="All mail across folders."
        className="flex items-center gap-4 rounded-r-full px-4 py-2 text-slate-700 hover:bg-slate-100"
      >
        📨 All Mail
      </dot.button>
      <dot.button
        description="Spam folder."
        className="flex items-center gap-4 rounded-r-full px-4 py-2 text-slate-700 hover:bg-slate-100"
      >
        🚫 Spam
      </dot.button>
      <dot.button
        description="Trash folder."
        className="flex items-center gap-4 rounded-r-full px-4 py-2 text-slate-700 hover:bg-slate-100"
      >
        🗑️ Trash
      </dot.button>

      <dot.text
        type="label"
        description="Section label for user labels."
        className="mt-3 px-4 text-xs font-semibold uppercase tracking-wide text-slate-400"
      >
        Labels
      </dot.text>
      <dot.button
        description="Work label."
        className="flex items-center gap-3 rounded-r-full px-4 py-2 text-slate-700 hover:bg-slate-100"
      >
        🔵 Work
      </dot.button>
      <dot.button
        description="Personal label."
        className="flex items-center gap-3 rounded-r-full px-4 py-2 text-slate-700 hover:bg-slate-100"
      >
        🔴 Personal
      </dot.button>
      <dot.button
        description="Travel label."
        className="flex items-center gap-3 rounded-r-full px-4 py-2 text-slate-700 hover:bg-slate-100"
      >
        🟣 Travel
      </dot.button>
      <dot.button
        description="Receipts label."
        className="flex items-center gap-3 rounded-r-full px-4 py-2 text-slate-700 hover:bg-slate-100"
      >
        🟢 Receipts
      </dot.button>
    </dot.panel>
  );
}
