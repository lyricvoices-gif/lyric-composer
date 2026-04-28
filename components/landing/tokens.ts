/**
 * Shared design tokens for landing page sections.
 * Mirrors the lyric-marketing palette so the funnel and the brand site feel like one product.
 */
export const DARK = "#2b2a25"
export const LIGHT = "#f5f3ef"
export const CREAM = "#F1EADD"
export const GOLD = "#c9a96e"
export const TEXT1 = "#1a1a18"
export const TEXT2 = "#4a4a45"
export const TEXT3 = "#9c958f"
export const BORDER = "#e5dfd5"

export const display = { fontFamily: "var(--font-display)" } as const
export const italic = { fontFamily: "var(--font-instrument)", fontStyle: "italic" } as const

export const label = {
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: TEXT3,
}

export const SIGNUP_HREF = "/sign-up"
export const SIGNIN_HREF = "/sign-in"
