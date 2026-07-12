/**
 * The inbox data. Kept here (not inline in the JSX) so the message rows and the read page
 * stay in sync from one source — clicking a row hands the same `Email` object to the reader.
 * The rows are still authored as static JSX (one per source position) so their dotUI ids
 * stay stable; only the text content is driven from here.
 */
export type Email = {
  id: string;
  sender: string;
  email: string;
  subject: string;
  snippet: string;
  body: string[];
  time: string;
  unread: boolean;
  starred: boolean;
  attachment?: string;
  label?: { text: string; className: string };
};

export const EMAILS: Email[] = [
  {
    id: 'm1',
    sender: 'Maya Chen',
    email: 'maya@dotui.dev',
    subject: 'Design review notes for the v2 launch',
    snippet: 'Left a few comments on the prototype — mostly spacing nits. Can we sync at 3?',
    body: [
      'Hi there,',
      'I went through the v2 prototype this morning and left a few comments on the spacing and the colour rails. Nothing blocking — mostly polish.',
      'The one thing I do want to talk through is the empty state for the inbox. Do you have 15 minutes around 3pm?',
      'Thanks,\nMaya',
    ],
    time: '9:41 AM',
    unread: true,
    starred: true,
    attachment: 'prototype-v2.fig',
    label: { text: 'Work', className: 'bg-blue-100 text-blue-700' },
  },
  {
    id: 'm2',
    sender: 'GitHub',
    email: 'notifications@github.com',
    subject: '[dotui/dotui-v2] Pull request #214 was merged',
    snippet: 'feat(prompt): persist the live look across reloads — merged into main by rahul.',
    body: [
      'Your pull request has been merged.',
      'feat(prompt): persist the live look across reloads',
      'The overlay is now saved per request and restored on reload. 12 files changed.',
    ],
    time: '8:12 AM',
    unread: true,
    starred: false,
    label: { text: 'Updates', className: 'bg-emerald-100 text-emerald-700' },
  },
  {
    id: 'm3',
    sender: 'Priya Nair',
    email: 'priya@northwind.co',
    subject: 'Re: Contract renewal — a couple of questions',
    snippet: 'Thanks for sending the draft over. Two small things before we sign…',
    body: [
      'Hi,',
      'Thanks for sending the renewal draft. Two small things before we countersign:',
      '1. Can we move the start date to the 1st?\n2. The seat count should read 25, not 20.',
      'Otherwise this looks great. Happy to hop on a call if easier.',
      'Best,\nPriya',
    ],
    time: 'Yesterday',
    unread: false,
    starred: true,
    attachment: 'renewal-2026.pdf',
    label: { text: 'Work', className: 'bg-blue-100 text-blue-700' },
  },
  {
    id: 'm4',
    sender: 'Figma',
    email: 'updates@figma.com',
    subject: 'Your weekly activity summary',
    snippet: '3 files were edited by your team this week. See what changed in your projects.',
    body: [
      'Here is what happened in your team this week.',
      '3 files edited · 8 comments · 2 new prototypes shared.',
      'Open Figma to catch up on the activity.',
    ],
    time: 'Yesterday',
    unread: false,
    starred: false,
    label: { text: 'Promotions', className: 'bg-amber-100 text-amber-700' },
  },
  {
    id: 'm5',
    sender: 'Mom',
    email: 'rosa@family.net',
    subject: 'Dinner on Sunday?',
    snippet: "We're doing a roast on Sunday — are you free around 6? Bring nothing but yourself.",
    body: [
      'Hi sweetheart,',
      "We're doing a roast on Sunday. Are you free around 6? Your sister is coming too.",
      'Bring nothing but yourself. Love you.',
      'Mom',
    ],
    time: 'Tue',
    unread: false,
    starred: false,
    label: { text: 'Personal', className: 'bg-rose-100 text-rose-700' },
  },
  {
    id: 'm6',
    sender: 'Atlas Travel',
    email: 'trips@atlas.travel',
    subject: 'Your itinerary: LIS → SFO confirmed',
    snippet: 'Booking #AT-99281 confirmed. Check-in opens 24 hours before departure.',
    body: [
      'Your trip is confirmed.',
      'Lisbon (LIS) → San Francisco (SFO), departing 14 July at 10:25.',
      'Booking reference AT-99281. Check-in opens 24 hours before departure.',
    ],
    time: 'Mon',
    unread: false,
    starred: false,
    attachment: 'itinerary.pdf',
    label: { text: 'Travel', className: 'bg-violet-100 text-violet-700' },
  },
];
