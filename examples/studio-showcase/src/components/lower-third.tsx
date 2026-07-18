import { Easing, interpolate, useCurrentFrame } from "remotion";

/**
 * LowerThird — an editorial lower-third title card: a small accent kicker on
 * top and a large headline beneath, sliding in from the left with a soft blur.
 * Used for scene intros / positioning beats over the capture.
 *
 * Restraint: one accent (the kicker), sentence case, no glow.
 */
export interface LowerThirdProps {
  kicker?: string;
  headline: string;
  /** Anchor on the left edge of the frame. */
  x?: number;
  y?: number;
  headlineSize?: number;
  kickerSize?: number;
  color?: string;
  accentColor?: string;
  speed?: number;
}

export function LowerThird({
  kicker,
  headline,
  x = 96,
  y = 0,
  headlineSize = 64,
  kickerSize = 20,
  color = "#f4f5f8",
  accentColor = "#5e6ad2",
  speed = 1,
}: LowerThirdProps) {
  const frame = useCurrentFrame() * speed;

  // Whole block slides in.
  const slideX = interpolate(frame, [0, 20], [-40, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const blur = interpolate(frame, [0, 20], [10, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const headlineOpacity = interpolate(frame, [4, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const kickerOpacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Accent rule draws out under the kicker.
  const ruleWidth = interpolate(frame, [6, 26], [0, 44], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: "50%",
        translate: `0 ${y}px`,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        opacity: headlineOpacity,
        transform: `translateX(${slideX}px)`,
        filter: `blur(${blur}px)`,
        maxWidth: 1100,
      }}
    >
      {kicker && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            opacity: kickerOpacity,
          }}
        >
          <span
            style={{
              display: "inline-block",
              height: 2,
              width: ruleWidth,
              backgroundColor: accentColor,
            }}
          />
          <span
            style={{
              fontSize: kickerSize,
              fontWeight: 600,
              letterSpacing: "0.02em",
              color: accentColor,
              textTransform: "uppercase",
            }}
          >
            {kicker}
          </span>
        </div>
      )}
      <span
        style={{
          fontSize: headlineSize,
          fontWeight: 600,
          letterSpacing: "-0.025em",
          lineHeight: 1.08,
          color,
        }}
      >
        {headline}
      </span>
    </div>
  );
}
