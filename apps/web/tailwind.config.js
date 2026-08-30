/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './app/**/*.{vue,js,ts}',
    './components/**/*.{vue,js,ts}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        // Semantic tokens for consistent theming
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
          subtle: 'rgb(var(--surface-subtle) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--content) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',
          subtle: 'rgb(var(--content-subtle) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          muted: 'rgb(var(--accent-muted) / <alpha-value>)',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'splash-out': 'splashOut 0.4s ease-in forwards',
        'splash-pulse': 'splashPulse 1.6s ease-in-out infinite',
        // Idle breathing — gentle squash/stretch like a living character
        'unit-bob': 'unitBob 2s ease-in-out infinite',
        'glow-pulse': 'glowPulse 1.8s ease-in-out infinite',
        'pop-in': 'popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'prop-sway': 'propSway 4s ease-in-out infinite',
        // Energetic jump-bounce cycle with squash & stretch
        'walk-bounce': 'walkBounce 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite',
        // Conference room discussion bubble
        'chat-pop': 'chatPop 1.5s ease-in-out infinite',
        // Character speech bubble (subtle, above head)
        'talk-bubble': 'talkBubble 1.4s ease-in-out infinite',
        // Character mouth while talking
        'talk-mouth': 'talkMouth 0.6s ease-in-out infinite',
        // Busy working — quick bounces with lean
        'busy-bob': 'busyBob 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite',
        // Shadow that shrinks when the character jumps
        'shadow-pulse': 'shadowPulse 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        splashOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0', visibility: 'hidden' },
        },
        splashPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.08)', opacity: '1' },
        },
        // Idle: gentle breathing with squash/stretch — feels alive
        unitBob: {
          '0%, 100%': { transform: 'translateY(0) scaleY(1) scaleX(1)' },
          '50%': { transform: 'translateY(-2px) scaleY(1.03) scaleX(0.98)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(34 197 94 / 0.0)' },
          '50%': { boxShadow: '0 0 0 6px rgb(34 197 94 / 0.25)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        propSway: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        // Jump cycle: squash on landing, stretch on liftoff, hang in the air
        walkBounce: {
          '0%': { transform: 'translateY(0) scaleY(0.85) scaleX(1.15)' },
          '20%': { transform: 'translateY(-12px) scaleY(1.1) scaleX(0.9)' },
          '50%': { transform: 'translateY(-8px) scaleY(1) scaleX(1)' },
          '80%': { transform: 'translateY(-12px) scaleY(1.1) scaleX(0.9)' },
          '100%': { transform: 'translateY(0) scaleY(0.85) scaleX(1.15)' },
        },
        chatPop: {
          '0%, 100%': { transform: 'scale(1) translateY(0)', opacity: '0.8' },
          '50%': { transform: 'scale(1.15) translateY(-3px)', opacity: '1' },
        },
        talkBubble: {
          '0%, 100%': { transform: 'scale(1) translateY(0)', opacity: '0.85' },
          '50%': { transform: 'scale(1.1) translateY(-2px)', opacity: '1' },
        },
        talkMouth: {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
        },
        // Busy: quick energetic bounces with body lean
        busyBob: {
          '0%, 100%': { transform: 'translateY(0) scaleY(0.9) scaleX(1.1) rotate(-2deg)' },
          '50%': { transform: 'translateY(-8px) scaleY(1.08) scaleX(0.93) rotate(2deg)' },
        },
        // Shadow shrinks when the body is in the air
        shadowPulse: {
          '0%, 100%': { transform: 'scaleX(1)', opacity: '0.25' },
          '50%': { transform: 'scaleX(0.6)', opacity: '0.12' },
        },
      },
    },
  },
  plugins: [],
}
