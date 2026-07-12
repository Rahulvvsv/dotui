'use client';

import { dot } from '@dotui/elements';
import { EMAILS, type Email } from './emails';

/**
 * The inbox: a toolbar, the category tabs, then the message list. Each row is written out
 * inline (NOT `.map`/a shared component): the id scheme is structural-per-source-position,
 * so a reused row would collapse every row onto one id and lift them out of this panel's
 * slice. Only sender + subject are `required`, so a declutter prompt keeps the list
 * scannable and hides the controls/preview/labels. Clicking a row hands the email up to
 * `onSelect`, which the page uses to open the read view. Content is driven from `EMAILS`.
 */
export function Inbox({ onSelect }: { onSelect: (email: Email) => void }) {
  return (
    <dot.panel
      description="The inbox: toolbar, category tabs, and the message list."
      className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-white"
    >
      <dot.panel
        description="Inbox toolbar — select, refresh, and pagination."
        className="flex items-center gap-1 border-b border-slate-200 px-4 py-1.5 text-slate-500"
      >
        <dot.button
          description="Select all."
          className="rounded-full px-2 py-1.5 hover:bg-slate-100"
        >
          ☐
        </dot.button>
        <dot.button description="Refresh." className="rounded-full px-2 py-1.5 hover:bg-slate-100">
          ↻
        </dot.button>
        <dot.button
          description="More actions."
          className="rounded-full px-2 py-1.5 hover:bg-slate-100"
        >
          ⋮
        </dot.button>
        <dot.text description="Visible message range." className="ml-auto text-xs">
          1–6 of 1,432
        </dot.text>
        <dot.button description="Newer." className="rounded-full px-2 py-1.5 hover:bg-slate-100">
          ‹
        </dot.button>
        <dot.button description="Older." className="rounded-full px-2 py-1.5 hover:bg-slate-100">
          ›
        </dot.button>
      </dot.panel>

      <dot.panel
        description="Category tabs."
        className="flex items-center gap-1 border-b border-slate-200 px-2"
      >
        <dot.button
          required
          description="Primary category tab (current)."
          className="border-b-2 border-blue-600 px-5 py-3 text-sm font-semibold text-blue-700"
        >
          📥 Primary
        </dot.button>
        <dot.button
          description="Social category tab."
          className="px-5 py-3 text-sm text-slate-500 hover:bg-slate-50"
        >
          👥 Social
        </dot.button>
        <dot.button
          description="Promotions category tab."
          className="px-5 py-3 text-sm text-slate-500 hover:bg-slate-50"
        >
          🏷️ Promotions
        </dot.button>
      </dot.panel>

      <dot.panel
        description="The message list."
        className="flex flex-col divide-y divide-slate-100"
      >
        {/* Row 1 — unread */}
        <dot.panel
          description="Message row."
          onClick={() => onSelect(EMAILS[0])}
          className="flex cursor-pointer items-center gap-3 bg-white px-4 py-2.5 hover:bg-slate-50 hover:shadow-sm"
        >
          <dot.button
            description="Select this message."
            className="text-slate-300 hover:text-slate-500"
          >
            ☐
          </dot.button>
          <dot.button description="Star this message." className="text-base text-amber-400">
            ⭐
          </dot.button>
          <dot.text
            required
            description="Sender name."
            className="w-44 shrink-0 truncate text-sm font-semibold text-slate-900"
          >
            {EMAILS[0].sender}
          </dot.text>
          <dot.panel
            description="Subject and preview."
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <dot.text
              required
              description="Subject."
              className="shrink-0 truncate text-sm font-semibold text-slate-900"
            >
              {EMAILS[0].subject}
            </dot.text>
            <dot.text
              description="Message preview."
              className="min-w-0 truncate text-sm text-slate-400"
            >
              — {EMAILS[0].snippet}
            </dot.text>
          </dot.panel>
          <dot.badge
            description="Label chip."
            className="shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
          >
            Work
          </dot.badge>
          <dot.badge description="Has an attachment." className="shrink-0 text-xs text-slate-400">
            📎
          </dot.badge>
          <dot.text
            description="Time received."
            className="shrink-0 text-xs font-semibold text-slate-700"
          >
            {EMAILS[0].time}
          </dot.text>
        </dot.panel>

        {/* Row 2 — unread */}
        <dot.panel
          description="Message row."
          onClick={() => onSelect(EMAILS[1])}
          className="flex cursor-pointer items-center gap-3 bg-white px-4 py-2.5 hover:bg-slate-50 hover:shadow-sm"
        >
          <dot.button
            description="Select this message."
            className="text-slate-300 hover:text-slate-500"
          >
            ☐
          </dot.button>
          <dot.button
            description="Star this message."
            className="text-base text-slate-300 hover:text-amber-400"
          >
            ☆
          </dot.button>
          <dot.text
            required
            description="Sender name."
            className="w-44 shrink-0 truncate text-sm font-semibold text-slate-900"
          >
            {EMAILS[1].sender}
          </dot.text>
          <dot.panel
            description="Subject and preview."
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <dot.text
              required
              description="Subject."
              className="shrink-0 truncate text-sm font-semibold text-slate-900"
            >
              {EMAILS[1].subject}
            </dot.text>
            <dot.text
              description="Message preview."
              className="min-w-0 truncate text-sm text-slate-400"
            >
              — {EMAILS[1].snippet}
            </dot.text>
          </dot.panel>
          <dot.badge
            description="Label chip."
            className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
          >
            Updates
          </dot.badge>
          <dot.badge description="Has an attachment." className="shrink-0 text-xs text-slate-400" />
          <dot.text
            description="Time received."
            className="shrink-0 text-xs font-semibold text-slate-700"
          >
            {EMAILS[1].time}
          </dot.text>
        </dot.panel>

        {/* Row 3 — read */}
        <dot.panel
          description="Message row."
          onClick={() => onSelect(EMAILS[2])}
          className="flex cursor-pointer items-center gap-3 bg-slate-50/40 px-4 py-2.5 hover:bg-slate-50 hover:shadow-sm"
        >
          <dot.button
            description="Select this message."
            className="text-slate-300 hover:text-slate-500"
          >
            ☐
          </dot.button>
          <dot.button description="Star this message." className="text-base text-amber-400">
            ⭐
          </dot.button>
          <dot.text
            required
            description="Sender name."
            className="w-44 shrink-0 truncate text-sm font-normal text-slate-600"
          >
            {EMAILS[2].sender}
          </dot.text>
          <dot.panel
            description="Subject and preview."
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <dot.text
              required
              description="Subject."
              className="shrink-0 truncate text-sm font-normal text-slate-600"
            >
              {EMAILS[2].subject}
            </dot.text>
            <dot.text
              description="Message preview."
              className="min-w-0 truncate text-sm text-slate-400"
            >
              — {EMAILS[2].snippet}
            </dot.text>
          </dot.panel>
          <dot.badge
            description="Label chip."
            className="shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
          >
            Work
          </dot.badge>
          <dot.badge description="Has an attachment." className="shrink-0 text-xs text-slate-400">
            📎
          </dot.badge>
          <dot.text description="Time received." className="shrink-0 text-xs text-slate-400">
            {EMAILS[2].time}
          </dot.text>
        </dot.panel>

        {/* Row 4 — read */}
        <dot.panel
          description="Message row."
          onClick={() => onSelect(EMAILS[3])}
          className="flex cursor-pointer items-center gap-3 bg-slate-50/40 px-4 py-2.5 hover:bg-slate-50 hover:shadow-sm"
        >
          <dot.button
            description="Select this message."
            className="text-slate-300 hover:text-slate-500"
          >
            ☐
          </dot.button>
          <dot.button
            description="Star this message."
            className="text-base text-slate-300 hover:text-amber-400"
          >
            ☆
          </dot.button>
          <dot.text
            required
            description="Sender name."
            className="w-44 shrink-0 truncate text-sm font-normal text-slate-600"
          >
            {EMAILS[3].sender}
          </dot.text>
          <dot.panel
            description="Subject and preview."
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <dot.text
              required
              description="Subject."
              className="shrink-0 truncate text-sm font-normal text-slate-600"
            >
              {EMAILS[3].subject}
            </dot.text>
            <dot.text
              description="Message preview."
              className="min-w-0 truncate text-sm text-slate-400"
            >
              — {EMAILS[3].snippet}
            </dot.text>
          </dot.panel>
          <dot.badge
            description="Label chip."
            className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
          >
            Promotions
          </dot.badge>
          <dot.badge description="Has an attachment." className="shrink-0 text-xs text-slate-400" />
          <dot.text description="Time received." className="shrink-0 text-xs text-slate-400">
            {EMAILS[3].time}
          </dot.text>
        </dot.panel>

        {/* Row 5 — read */}
        <dot.panel
          description="Message row."
          onClick={() => onSelect(EMAILS[4])}
          className="flex cursor-pointer items-center gap-3 bg-slate-50/40 px-4 py-2.5 hover:bg-slate-50 hover:shadow-sm"
        >
          <dot.button
            description="Select this message."
            className="text-slate-300 hover:text-slate-500"
          >
            ☐
          </dot.button>
          <dot.button
            description="Star this message."
            className="text-base text-slate-300 hover:text-amber-400"
          >
            ☆
          </dot.button>
          <dot.text
            required
            description="Sender name."
            className="w-44 shrink-0 truncate text-sm font-normal text-slate-600"
          >
            {EMAILS[4].sender}
          </dot.text>
          <dot.panel
            description="Subject and preview."
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <dot.text
              required
              description="Subject."
              className="shrink-0 truncate text-sm font-normal text-slate-600"
            >
              {EMAILS[4].subject}
            </dot.text>
            <dot.text
              description="Message preview."
              className="min-w-0 truncate text-sm text-slate-400"
            >
              — {EMAILS[4].snippet}
            </dot.text>
          </dot.panel>
          <dot.badge
            description="Label chip."
            className="shrink-0 rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700"
          >
            Personal
          </dot.badge>
          <dot.badge description="Has an attachment." className="shrink-0 text-xs text-slate-400" />
          <dot.text description="Time received." className="shrink-0 text-xs text-slate-400">
            {EMAILS[4].time}
          </dot.text>
        </dot.panel>

        {/* Row 6 — read */}
        <dot.panel
          description="Message row."
          onClick={() => onSelect(EMAILS[5])}
          className="flex cursor-pointer items-center gap-3 bg-slate-50/40 px-4 py-2.5 hover:bg-slate-50 hover:shadow-sm"
        >
          <dot.button
            description="Select this message."
            className="text-slate-300 hover:text-slate-500"
          >
            ☐
          </dot.button>
          <dot.button
            description="Star this message."
            className="text-base text-slate-300 hover:text-amber-400"
          >
            ☆
          </dot.button>
          <dot.text
            required
            description="Sender name."
            className="w-44 shrink-0 truncate text-sm font-normal text-slate-600"
          >
            {EMAILS[5].sender}
          </dot.text>
          <dot.panel
            description="Subject and preview."
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <dot.text
              required
              description="Subject."
              className="shrink-0 truncate text-sm font-normal text-slate-600"
            >
              {EMAILS[5].subject}
            </dot.text>
            <dot.text
              description="Message preview."
              className="min-w-0 truncate text-sm text-slate-400"
            >
              — {EMAILS[5].snippet}
            </dot.text>
          </dot.panel>
          <dot.badge
            description="Label chip."
            className="shrink-0 rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700"
          >
            Travel
          </dot.badge>
          <dot.badge description="Has an attachment." className="shrink-0 text-xs text-slate-400">
            📎
          </dot.badge>
          <dot.text description="Time received." className="shrink-0 text-xs text-slate-400">
            {EMAILS[5].time}
          </dot.text>
        </dot.panel>
      </dot.panel>
    </dot.panel>
  );
}
