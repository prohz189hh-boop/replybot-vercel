# Design notes

**Subject**: an operational tool a support manager or small-business
owner checks many times a day — closer to an instrument panel (Linear,
Superhuman) than a marketing site. Trust and low-friction scanning
matter more than personality.

- **Color**: `ink` #14171F (near-black, blue-tinted, not flat #111),
  `paper` #FAFAF8, `surface` #FFFFFF, `line` #E4E4E1, `muted` #6B6F76,
  `signal` #3E5CE8 (the one accent — used only for primary actions and
  the AI/active state), `escalate` #C4741D (needs-human), `resolved`
  #1B8A5A, `danger` #C4331D. Rejected the cream+serif and
  near-black+acid-accent defaults explicitly.
- **Type**: Manrope for everything (headings and UI) — geometric but
  warm, not the Inter default. JetBrains Mono only for real data
  (agent IDs, timestamps in detail views), never for decoration.
- **Layout**: flat bordered panels (`border-line`), not
  identical-rounded-shadow cards. Sidebar nav on desktop, bottom tab
  bar on mobile. Status is communicated by color + a short word, never
  color alone.
- **Motion**: none beyond native focus/hover states and one panel-open
  transition in the inbox. No scroll-triggered reveals.
