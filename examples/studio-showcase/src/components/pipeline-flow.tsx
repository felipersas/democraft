import { Easing, interpolate, useCurrentFrame } from "remotion";

/**
 * PipelineFlow — a horizontal "Define → Capture → Direct → Render" pipeline
 * (the exact verbs from the landing page's HowItWorks). Each node lights up in
 * sequence and the connector fills between them.
 *
 * Used as a full-frame visual layered over the capture at a beat where we want
 * to surface the pipeline model behind the Studio.
 */
export interface PipelineFlowProps {
  steps?: Array<{ label: string }>;
  activeColor?: string;
  inactiveColor?: string;
  textColor?: string;
  /** Frames each node takes to light before the next begins. */
  stepFrames?: number;
  speed?: number;
}

const DEFAULT_STEPS = [
  { label: "Define" },
  { label: "Capture" },
  { label: "Direct" },
  { label: "Render" },
];

export function PipelineFlow({
  steps = DEFAULT_STEPS,
  activeColor = "#5e6ad2",
  inactiveColor = "rgba(255,255,255,0.14)",
  textColor = "#f4f5f8",
  stepFrames = 16,
  speed = 1,
}: PipelineFlowProps) {
  const frame = useCurrentFrame() * speed;

  const entrance = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Widths: each node ~ same; connectors flexible.
  const n = steps.length;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: entrance,
        transform: `translateY(${interpolate(frame, [0, 18], [16, 0], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        })}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: "26px 34px",
          borderRadius: 18,
          backgroundColor: "rgba(8,9,10,0.78)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
        }}
      >
        {steps.map((step, i) => {
          const localStart = i * stepFrames;
          const lit = interpolate(
            frame,
            [localStart, localStart + 10],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            },
          );
          const isLast = i === n - 1;
          // Connector fills after this node lights.
          const connectorFill = isLast
            ? 0
            : interpolate(
                frame,
                [localStart + 8, localStart + stepFrames + 6],
                [0, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.out(Easing.cubic),
                },
              );
          return (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 22,
                    fontWeight: 650,
                    color: lit > 0.5 ? "#08090a" : textColor,
                    backgroundColor: interpolateColor(
                      lit,
                      activeColor,
                      inactiveColor,
                    ),
                    border: `1px solid rgba(255,255,255,${0.06 + lit * 0.1})`,
                    transform: `scale(${0.92 + lit * 0.08})`,
                  }}
                >
                  {i + 1}
                </div>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 550,
                    letterSpacing: "-0.01em",
                    color: textColor,
                    opacity: 0.4 + lit * 0.6,
                  }}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  style={{
                    position: "relative",
                    width: 110,
                    height: 2,
                    margin: "0 18px",
                    // align with the node circles (offset up by label height).
                    top: -18,
                    backgroundColor: inactiveColor,
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: `${connectorFill * 100}%`,
                      backgroundColor: activeColor,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Linear blend between two hex/rgba colors by t in [0,1]. */
function interpolateColor(t: number, a: string, b: string): string {
  const pa = parseColor(a);
  const pb = parseColor(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  const al = pa[3] + (pb[3] - pa[3]) * t;
  return `rgba(${r},${g},${bl},${al})`;
}

function parseColor(c: string): [number, number, number, number] {
  if (c.startsWith("#")) {
    const hex = c.slice(1);
    const v =
      hex.length === 3
        ? hex
            .split("")
            .map((x) => x + x)
            .join("")
        : hex;
    const num = parseInt(v, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 1];
  }
  const m = c.match(/[\d.]+/g);
  if (!m) return [255, 255, 255, 1];
  return [
    Number(m[0]),
    Number(m[1]),
    Number(m[2]),
    m[3] !== undefined ? Number(m[3]) : 1,
  ];
}
