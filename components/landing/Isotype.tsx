// Lyric isotype — standalone icon mark.
// Mirrors the version used on lyricvoices.ai so the funnel and the brand site share an identity.
export default function Isotype({
  size = 32,
  color = "currentColor",
  style = {},
}: {
  size?: number
  color?: string
  style?: React.CSSProperties
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 1000"
      width={size}
      height={size}
      fill={color}
      style={{ display: "block", ...style }}
      aria-label="Lyric"
      role="img"
    >
      <path d="m100,500c0,220.89,179.11,400,400,400h400v-200h-400c-110.44,0-200-89.56-200-200v-200H100v200Z" />
      <polygon points="900 500 900 100 300 100 300 300 700 300 700 500 900 500" />
    </svg>
  )
}
