import type { Config } from "tailwindcss";

/**
 * Design tokens for the dashboard. Deliberately NOT the default SaaS
 * palette (no warm-cream+serif, no near-black+acid-accent, no
 * identical-rounded-card kit — see DESIGN.md for the reasoning).
 *
 * This is an operational tool a support manager lives in for hours, not
 * a marketing surface: flat bordered panels over shadow-heavy cards,
 * one accent used sparingly for the thing that needs attention (an
 * escalated conversation), and a restrained type scale.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14171F", // near-black, blue-tinted rather than flat #111
        paper: "#FAFAF8",
        surface: "#FFFFFF",
        line: "#E4E4E1",
        muted: "#6B6F76",
        signal: {
          DEFAULT: "#3E5CE8", // primary accent — used sparingly
          50: "#EEF1FD",
          100: "#DCE2FC",
          600: "#3E5CE8",
          700: "#2E47C2",
        },
        escalate: {
          DEFAULT: "#C4741D", // needs-human state
          50: "#FBF1E6",
        },
        resolved: {
          DEFAULT: "#1B8A5A",
          50: "#E8F5EF",
        },
        danger: {
          DEFAULT: "#C4331D",
          50: "#FBEAE7",
        },
      },
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
      },
      boxShadow: {
        panel: "none", // flat, bordered panels — not shadow-heavy cards
        popover: "0 8px 24px rgba(20, 23, 31, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
