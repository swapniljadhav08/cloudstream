import type { Config } from 'tailwindcss';

// Tokens from docs/24_UI_UX.md, as fixed in the design canvas.
// Slate-500 (#64748B) is deliberately absent: it measures 4.0:1 on the ground
// and fails body text, so hierarchy below `ink-muted` uses size and weight.
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#0F172A',
        surface: {
          DEFAULT: '#1E293B',
          inset: '#273449',
          border: '#334155',
        },
        ink: {
          DEFAULT: '#F8FAFC',
          muted: '#94A3B8',
          soft: '#CBD5E1',
        },
        accent: {
          DEFAULT: '#0EA5E9',
          hover: '#38BDF8',
          soft: '#7DD3FC',
        },
        status: {
          queued: '#94A3B8',
          processing: '#FBBF24',
          ready: '#34D399',
          failed: '#F87171',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        control: '8px',
        card: '12px',
      },
    },
  },
} satisfies Config;
