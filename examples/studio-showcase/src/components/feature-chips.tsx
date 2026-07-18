import { Easing, interpolate, useCurrentFrame } from "remotion";

/**
 * FeatureChips — a row of capability chips that rise + fade in one after
 * another (staggered), used to label a feature moment over the capture.
 *
 * Built in the remocn idiom (restraint, one accent, sentence case). The chips
 * are a transparent overlay layered on top of the Studio screenshot.
 */
export interface FeatureChipsProps {
  /** Each chip is `{ label, accent? }`. Accent chips render in indigo. */
  chips: Array<{ label: string; accent?: boolean }>;
  /** Where to anchor the row: "top" (below header) or "bottom" (above transport). */
  position?: "top" | "bottom";
  fontSize?: number;
  color?: string;
  accentColor?: string;
  speed?: number;
}

export function FeatureChips({
  chips,
  position = "bottom",
  fontSize = 30,
  color = "#f4f5f8",
  accentColor = "#5e6ad2",
  speed = 1,
}: FeatureChipsProps) {
  const frame = useCurrentFrame() * speed;

  const containerY =
    position === "top"
      ? interpolate(frame, [0, 14], [-24, 96], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        })
      : interpolate(frame, [0, 14], [24, -96], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: position === "top" ? "flex-start" : "flex-end",
        justifyContent: "center",
        translate: `0 ${containerY}px`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 14,
          padding: "12px 18px",
          borderRadius: 999,
          backgroundColor: "rgba(8,9,10,0.72)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
        }}
      >
        {chips.map((chip, i) => {
          const local = frame - i * 5;
          const opacity = interpolate(local, [0, 16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          const y = interpolate(local, [0, 16], [14, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          const isAccent = chip.accent === true;
          return (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                fontSize,
                fontWeight: 550,
                color: isAccent ? accentColor : color,
                opacity,
                transform: `translateY(${y}px)`,
                whiteSpace: "nowrap",
              }}
            >
              {isAccent && (
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: accentColor,
                  }}
                />
              )}
              {chip.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
