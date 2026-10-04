import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, card, Scene } from "../theme";

const INSURERS = [
  { name: "Northstar Mutual", kind: "Auto", price: 248, x: -560, y: -230, r: -8 },
  { name: "Meridian Health", kind: "Health", price: 642, x: 520, y: -260, r: 7 },
  { name: "Pawsure", kind: "Pet", price: 22, x: -640, y: 210, r: 6 },
  { name: "Evergreen Term", kind: "Life", price: 24, x: 600, y: 230, r: -6 },
  { name: "Hearthly", kind: "Renters", price: 18, x: 30, y: 330, r: 3 },
];

const FinePrint: React.FC<{ x: number; delay: number }> = ({ x, delay }) => {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, 200], [160, -260]);
  const o = interpolate(frame - delay, [0, 12], [0, 0.55], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: `calc(50% + ${x}px)`, top: "50%", transform: `translate(-50%, ${y - 300}px)`, opacity: o }}>
      <div style={{ ...card, width: 300, padding: 28, display: "flex", flexDirection: "column", gap: 12, boxShadow: `0 0 0 1.5px ${C.line}` }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} style={{ height: 8, borderRadius: 4, background: C.hair, width: `${60 + ((i * 37) % 40)}%` }} />
        ))}
      </div>
    </div>
  );
};

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const q1 = spring({ frame: frame - 97, fps, config: { damping: 14, stiffness: 160 } });
  const q2 = spring({ frame: frame - 141, fps, config: { damping: 14, stiffness: 160 } });
  const blur = interpolate(frame, [90, 106], [0, 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dim = interpolate(frame, [90, 106], [1, 0.45], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <Scene push={0.06}>
      <FinePrint x={-300} delay={52} />
      <FinePrint x={320} delay={58} />
      <FinePrint x={20} delay={64} />
      <div style={{ position: "absolute", inset: 0, filter: `blur(${blur}px)`, opacity: dim }}>
        {INSURERS.map((ins, i) => {
          const p = spring({ frame: frame - 6 - i * 5, fps, config: { damping: 16, stiffness: 120 } });
          const jitter = Math.sin((frame + i * 13) / 5) * 4 * interpolate(frame, [40, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={ins.name}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${ins.x * p + jitter}px), calc(-50% + ${ins.y * p + (1 - p) * 600}px)) rotate(${ins.r * p}deg) scale(${0.7 + 0.3 * p})`,
                opacity: p,
              }}
            >
              <div style={{ ...card, width: 400, padding: "28px 32px", display: "flex", alignItems: "center", gap: 24 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <span style={{ fontSize: 22, color: C.subtle }}>{ins.kind}</span>
                  <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em" }}>{ins.name}</span>
                </div>
                <span style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>${ins.price}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0 }}>
        <div style={{ fontSize: 150, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1.05, opacity: q1, transform: `translateY(${(1 - q1) * 60}px) scale(${0.9 + 0.1 * q1})` }}>
          Covered<span style={{ color: C.accent }}>?</span>
        </div>
        <div style={{ fontSize: 150, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1.05, opacity: q2, transform: `translateY(${(1 - q2) * 60}px) scale(${0.9 + 0.1 * q2})` }}>
          Overpaying<span style={{ color: C.accent }}>?</span>
        </div>
      </div>
    </Scene>
  );
};
