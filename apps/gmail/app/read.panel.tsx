'use client';

import { dot } from '@dotui/elements';
import { useState } from 'react';
import type { Email } from './emails';

/**
 * The open-message view. Pure dotUI, and a clear demo of state: the star and the "important"
 * pill toggle their own state, and the reply box expands in place. The page remounts this
 * via `key={email.id}` so opening another message resets that state. Authored as a superset —
 * a declutter prompt can hide the toolbar icons and the quoted metadata.
 */
export function Read({ email, onBack }: { email: Email; onBack: () => void }) {
  const [starred, setStarred] = useState(email.starred);
  const [replying, setReplying] = useState(false);

  return (
    <dot.panel
      description="The open message: header, body, and reply actions."
      className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-white"
    >
      <dot.panel
        description="Message toolbar."
        className="flex items-center gap-1 border-b border-slate-200 px-4 py-1.5 text-slate-500"
      >
        <dot.button
          required
          description="Back to the inbox."
          onClick={onBack}
          className="rounded-full px-3 py-1.5 hover:bg-slate-100"
        >
          ← Back
        </dot.button>
        <dot.button description="Archive." className="rounded-full px-2 py-1.5 hover:bg-slate-100">
          🗄
        </dot.button>
        <dot.button
          description="Report spam."
          className="rounded-full px-2 py-1.5 hover:bg-slate-100"
        >
          🚫
        </dot.button>
        <dot.button description="Delete." className="rounded-full px-2 py-1.5 hover:bg-slate-100">
          🗑️
        </dot.button>
        <dot.button description="Snooze." className="rounded-full px-2 py-1.5 hover:bg-slate-100">
          ⏰
        </dot.button>
        <dot.text description="Position in thread." className="ml-auto text-xs">
          1 of 1,432
        </dot.text>
      </dot.panel>

      <dot.panel description="Message content." className="flex flex-col gap-4 px-8 py-6">
        <dot.panel description="Subject row." className="flex items-center gap-3">
          <dot.text
            required
            type="h1"
            description="Subject."
            className="text-2xl font-normal text-slate-900"
          >
            {email.subject}
          </dot.text>
          {email.label ? (
            <dot.badge
              description="Label chip."
              className={`rounded px-2 py-0.5 text-xs font-medium ${email.label.className}`}
            >
              {email.label.text}
            </dot.badge>
          ) : null}
        </dot.panel>

        <dot.panel description="Sender row." className="flex items-center gap-3">
          <dot.image
            description="Sender avatar."
            src="https://i.pravatar.cc/64?img=32"
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
          <dot.panel description="Sender identity." className="flex min-w-0 flex-col">
            <dot.text
              required
              description="Sender name."
              className="text-sm font-semibold text-slate-900"
            >
              {email.sender}
            </dot.text>
            <dot.text description="Sender address." className="text-xs text-slate-500">
              {email.email}
            </dot.text>
          </dot.panel>
          <dot.text description="Received time." className="ml-auto text-xs text-slate-500">
            {email.time}
          </dot.text>
          <dot.button
            description="Star this message."
            onClick={() => setStarred((s) => !s)}
            className="text-lg text-slate-300 hover:text-amber-400"
          >
            {starred ? '⭐' : '☆'}
          </dot.button>
          <dot.button
            description="Reply."
            className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100"
          >
            ↩
          </dot.button>
        </dot.panel>

        <dot.panel
          description="Message body."
          className="flex flex-col gap-4 whitespace-pre-line text-sm leading-relaxed text-slate-700"
        >
          <dot.text description="Body paragraph.">{email.body[0]}</dot.text>
          <dot.text description="Body paragraph.">{email.body[1]}</dot.text>
          <dot.text description="Body paragraph.">{email.body[2]}</dot.text>
          <dot.text description="Body paragraph.">{email.body[3] ?? ''}</dot.text>
        </dot.panel>

        {email.attachment ? (
          <dot.panel
            description="Attachment chip."
            className="flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            📎 {email.attachment}
          </dot.panel>
        ) : null}

        {replying ? (
          <dot.panel
            description="Reply composer."
            className="flex flex-col gap-2 rounded-xl border border-slate-300 p-3 shadow-sm"
          >
            <dot.input
              description="Reply text."
              type="text"
              placeholder={`Reply to ${email.sender}…`}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
            <dot.panel description="Composer actions." className="flex items-center gap-2">
              <dot.button
                description="Send the reply."
                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Send
              </dot.button>
              <dot.button
                description="Discard the reply."
                onClick={() => setReplying(false)}
                className="rounded-full px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
              >
                Discard
              </dot.button>
            </dot.panel>
          </dot.panel>
        ) : (
          <dot.panel description="Reply actions." className="flex items-center gap-2 pt-2">
            <dot.button
              required
              description="Reply to this message."
              onClick={() => setReplying(true)}
              className="flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ↩ Reply
            </dot.button>
            <dot.button
              description="Reply to all."
              onClick={() => setReplying(true)}
              className="flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ↩ Reply all
            </dot.button>
            <dot.button
              description="Forward this message."
              className="flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ➡ Forward
            </dot.button>
          </dot.panel>
        )}
      </dot.panel>
    </dot.panel>
  );
}
