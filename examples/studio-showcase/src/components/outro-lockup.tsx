import { Easing, interpolate, useCurrentFrame } from "remotion";

/**
 * OutroLockup — the closing brand moment: a centered mark square + wordmark,
 * a tagline beneath, and a "demos as code" line. Calm, restrained, on a dark
 * scrim so the captured Studio behind it recedes.
 *
 * The mark mirrors the Studio's own header (a white-on-near-black square with
 * a sparkle), so the outro reads as a natural sign-off from the product.
 */
export interface OutroLockupProps {
  wordmark?: string;
  tagline?: string;
  footnote?: string;
  color?: string;
  mutedColor?: string;
  accentColor?: string;
  speed?: number;
}

export function OutroLockup({
  wordmark = "Democraft",
  tagline = "Demos as code.",
  footnote = "Playwright captures. Remotion renders.",
  color = "#f4f5f8",
  mutedColor = "#8a8d96",
  accentColor = "#5e6ad2",
  speed = 1,
}: OutroLockupProps) {
  const frame = useCurrentFrame() * speed;

  const scrimOpacity = interpolate(frame, [0, 20], [0, 0.92], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const markScale = interpolate(frame, [8, 30], [0.7, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const markOpacity = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wordOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineOpacity = interpolate(frame, [34, 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const footnoteOpacity = interpolate(frame, [48, 68], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 26,
        backgroundColor: `rgba(8,9,10,${scrimOpacity})`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 30,
          opacity: markOpacity,
          transform: `scale(${markScale})`,
        }}
      >
        {/* Sparkle mark — mirrors the Studio header chrome */}
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 18,
            display: "grid",
            placeItems: "center",
            backgroundColor: "#f4f5f8",
            color: "#08090a",
            boxShadow: `0 0 0 1px ${accentColor}40, 0 18px 50px rgba(0,0,0,0.5)`,
          }}
        >
          <SparkleMark />
        </div>
        <span
          style={{
            fontSize: 86,
            fontWeight: 600,
            letterSpacing: "-0.035em",
            color,
            opacity: wordOpacity,
          }}
        >
          {wordmark}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          opacity: taglineOpacity,
          transform: `translateY(${interpolate(frame, [34, 54], [12, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          })}px)`,
        }}
      >
        <span
          style={{
            fontSize: 40,
            fontWeight: 550,
            letterSpacing: "-0.02em",
            color,
          }}
        >
          {tagline}
        </span>
        <span
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: mutedColor,
            opacity: footnoteOpacity,
          }}
        >
          {footnote}
        </span>
      </div>
    </div>
  );
}

/** A simple four-point sparkle drawn in SVG (matches the Lucide Sparkles silhouette). */
function SparkleMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l1.6 5.4a4 4 0 002 2L21 12l-5.4 1.6a4 4 0 00-2 2L12 21l-1.6-5.4a4 4 0 00-2-2L3 12l5.4-1.6a4 4 0 002-2L12 3z"
        fill="currentColor"
      />
    </svg>
  );
}
