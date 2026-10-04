import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ease, K, Mark, sans } from "../cx";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const b = interpolate(frame, [12, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <AbsoluteFill style={{ background: K.canvas, fontFamily: sans, alignItems: "center", justifyContent: "center", gap: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28, opacity: a, transform: `translateY(${(1 - a) * 16}px) scale(${0.97 + 0.03 * a})`, filter: `blur(${(1 - a) * 6}px)` }}>
        <Mark size={64} color={K.text} />
        <span style={{ fontSize: 140, fontWeight: 600, letterSpacing: "-0.055em", color: K.text, lineHeight: 1 }}>lowball</span>
      </div>
      <div style={{ fontSize: 40, color: K.soft, letterSpacing: "-0.015em", opacity: b, transform: `translateY(${(1 - b) * 10}px)` }}>Your personal insurance agent.</div>
    </AbsoluteFill>
  );
};
