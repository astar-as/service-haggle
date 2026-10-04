import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Camera, Slam } from "../fx";
import { C, card, fontFamily } from "../theme";

const INSURERS = [
  { name: "Northstar Mutual", kind: "Auto", price: 248, x: -560, y: -250, r: -9, at: 2 },
  { name: "Meridian Health", kind: "Health", price: 642, x: 540, y: -270, r: 8, at: 7 },
  { name: "Pawsure", kind: "Pet", price: 22, x: -640, y: 220, r: 7, at: 12 },
  { name: "Evergreen Term", kind: "Life", price: 24, x: 620, y: 240, r: -7, at: 17 },
  { name: "Hearthly", kind: "Renters", price: 18, x: 20, y: 360, r: 3, at: 22 },
];

const Page: React.FC<{ x: number; speed: number; delay: number; rot: number }> = ({ x, speed, delay, rot }) => {
  const frame = useCurrentFrame();
  const f = frame - delay;
  const o = interpolate(f, [0, 8], [0, 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = 700 - f * speed;
  const z = interpolate(f, [0, 60], [0.8, 1.15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: `calc(50% + ${x}px)`, top: "50%", transform: `translate(-50%, ${y - 400}px) rotate(${rot}deg) scale(${z})`, opacity: o }}>
      <div style={{ ...card, width: 360, padding: 32, display: "flex", flexDirection: "column", gap: 13 }}>
        <div style={{ height: 14, width: "55%", borderRadius: 4, background: C.ink, opacity: 0.8 }} />
        {Array.from({ length: 22 }).map((_, i) => (
          <div key={i} style={{ height: 7, borderRadius: 4, background: C.line, width: `${55 + ((i * 37) % 45)}%` }} />
        ))}
      </div>
    </div>
  );
};

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const blur = interpolate(frame, [92, 104], [0, 9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dim = interpolate(frame, [92, 104], [1, 0.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const stamp = spring({ frame: frame - 34, fps, config: { damping: 9, stiffness: 260 } });

  return (
    <AbsoluteFill style={{ fontFamily, color: C.ink }}>
      <Backdrop speed={1.6} />
      <Camera push={0.1} shakeAt={[2, 7, 12, 17, 22, 97, 141]}>
        <AbsoluteFill style={{ filter: `blur(${blur}px)`, opacity: dim }}>
          <Page x={-420} speed={9} delay={52} rot={-6} />
          <Page x={0} speed={11} delay={58} rot={2} />
          <Page x={420} speed={10} delay={64} rot={7} />
          {INSURERS.map((ins) => {
            const p = spring({ frame: frame - ins.at, fps, config: { damping: 12, stiffness: 240 } });
            const jitter = Math.sin((frame + ins.at * 13) / 3) * 5 * interpolate(frame, [40, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div
                key={ins.name}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(calc(-50% + ${ins.x + jitter}px), calc(-50% + ${ins.y}px)) rotate(${ins.r}deg) scale(${interpolate(p, [0, 1], [2.4, 1])})`,
                  opacity: interpolate(frame - ins.at, [0, 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                  filter: `blur(${interpolate(p, [0, 0.7], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
                }}
              >
                <div style={{ ...card, position: "relative", width: 430, padding: "30px 34px", display: "flex", alignItems: "center", gap: 24 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                    <span style={{ fontSize: 22, color: C.subtle }}>{ins.kind}</span>
                    <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em" }}>{ins.name}</span>
                  </div>
                  <span style={{ fontSize: 42, fontWeight: 600, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>${ins.price}</span>
                  {ins.kind === "Auto" && (
                    <span
                      style={{
                        position: "absolute",
                        right: -30,
                        top: -26,
                        background: "#E5484D",
                        color: C.white,
                        fontWeight: 700,
                        fontSize: 22,
                        padding: "8px 16px",
                        borderRadius: 12,
                        transform: `rotate(8deg) scale(${stamp})`,
                        boxShadow: "0 12px 30px -10px rgba(229,72,77,0.6)",
                      }}
                    >
                      RENEWAL +18%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </AbsoluteFill>
        <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <Slam at={97}>
            <div style={{ fontSize: 190, fontWeight: 700, letterSpacing: "-0.055em", lineHeight: 1 }}>
              Covered<span style={{ color: C.accent }}>?</span>
            </div>
          </Slam>
          <Slam at={141}>
            <div style={{ fontSize: 190, fontWeight: 700, letterSpacing: "-0.055em", lineHeight: 1.05 }}>
              Overpaying<span style={{ color: C.accent }}>?</span>
            </div>
          </Slam>
        </AbsoluteFill>
      </Camera>
    </AbsoluteFill>
  );
};
