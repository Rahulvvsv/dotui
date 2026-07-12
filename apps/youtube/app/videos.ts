/**
 * The feed's data. Kept here (not inline in the JSX) so the feed cards and the watch page
 * stay in sync from one source — clicking a card hands the same `Video` object to the
 * player. The feed renders these via `.map()` over ONE card template; the compiler gives
 * the template a stable `~` id, so styling applies to every card.
 */
export type Video = {
  id: string;
  title: string;
  channel: string;
  views: string;
  age: string;
  thumb: string;
  description: string;
};

export const VIDEOS: Video[] = [
  {
    id: 'v1',
    title: 'Building a generative UI from scratch',
    channel: 'dotUI Labs',
    views: '412K views',
    age: '2 days ago',
    thumb: 'https://picsum.photos/seed/v1/640/360',
    description: 'A deep dive into JSX-first generative UI: author once, restyle by prompt.',
  },
  {
    id: 'v2',
    title: 'Tailwind tips you wish you knew sooner',
    channel: 'Frontend Daily',
    views: '88K views',
    age: '5 hours ago',
    thumb: 'https://picsum.photos/seed/v2/640/360',
    description: 'Utility-first patterns, arbitrary values, and the safelist gotcha.',
  },
  {
    id: 'v3',
    title: 'A calm walk through autumn forests 🍂',
    channel: 'Slow Nature',
    views: '1.2M views',
    age: '1 week ago',
    thumb: 'https://picsum.photos/seed/v3/640/360',
    description: 'Forty minutes of crunching leaves and birdsong. No talking.',
  },
  {
    id: 'v4',
    title: '30-minute weeknight pasta, three ways',
    channel: 'Hungry at Home',
    views: '540K views',
    age: '3 days ago',
    thumb: 'https://picsum.photos/seed/v4/640/360',
    description: 'Cacio e pepe, a quick arrabbiata, and a creamy lemon — all under 30 minutes.',
  },
  {
    id: 'v5',
    title: 'The history of the synthesizer, explained',
    channel: 'Sound Theory',
    views: '76K views',
    age: '6 days ago',
    thumb: 'https://picsum.photos/seed/v5/640/360',
    description: 'From Moog to FM to soft synths — how we got the sounds of modern music.',
  },
  {
    id: 'v6',
    title: 'Speedrunning a classic platformer (world record)',
    channel: 'PixelRunner',
    views: '2.9M views',
    age: '1 month ago',
    thumb: 'https://picsum.photos/seed/v6/640/360',
    description: 'A frame-perfect run with live commentary on every skip and trick.',
  },
];
