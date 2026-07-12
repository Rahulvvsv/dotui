import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/elements/src/**/*.{ts,tsx}',
    '../../packages/devtools/src/**/*.{ts,tsx}',
    '../../packages/prompt/src/**/*.{ts,tsx}',
  ],
  // Personas (and the prompt layer generally) emit class strings at runtime that Tailwind
  // can't see in source. Safelist the families/values they can produce so the CSS exists.
  safelist: [
    {
      pattern:
        /^(text|bg|border)-(slate|gray|red|orange|amber|yellow|green|emerald|teal|blue|indigo|violet|purple|pink|rose)-(50|100|200|300|400|500|600|700|800|900)$/,
    },
    { pattern: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)$/ },
    { pattern: /^font-(thin|light|normal|medium|semibold|bold|extrabold|black)$/ },
    {
      pattern:
        /^(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y)-(0|0\.5|1|1\.5|2|2\.5|3|4|5|6|8|10|12)$/,
    },
    { pattern: /^rounded(-(sm|md|lg|xl|2xl|3xl|full))?$/ },
    { pattern: /^border(-(0|2|4|8))?$/ },
    'text-white',
    'text-black',
    'bg-white',
    'bg-black',
    'border-black',
  ],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
