import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fontFamily, Scene } from "../theme";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame: frame - 2, fps, config: { damping: 12, stiffness: 180 } });
  const word = spring({ frame: frame - 12, fps, config: { damping: 18, stiffness: 140 } });
  const sub = spring({ frame: frame - 26, fps, config: { damping: 200 } });
  const ring = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const letters = "lowball".split("");

  return (
    <Scene push={0.03}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 36 }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 40 }}>
          <div
            style={{
              position: "absolute",
              left: 20,
              top: "50%",
              width: 80,
              height: 80,
              marginTop: -40,
              marginLeft: -20,
              borderRadius: 26,
              border: `3px solid ${C.accent}`,
              opacity: 1 - ring,
              transform: `scale(${1 + ring * 2.4})`,
            }}
          />
          <div style={{ width: 80, height: 80, borderRadius: 22, background: C.accent, transform: `scale(${mark}) rotate(${(1 - mark) * -90}deg)` }} />
          <div style={{ display: "flex", fontFamily, fontSize: 190, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1 }}>
            {letters.map((l, i) => {
              const p = spring({ frame: frame - 10 - i * 2, fps, config: { damping: 16, stiffness: 170 } });
              return (
                <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 70}px)` }}>
                  {l}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ fontSize: 48, color: C.muted, letterSpacing: "-0.015em", opacity: sub * word, transform: `translateY(${(1 - sub) * 24}px)` }}>
          Your personal <span style={{ color: C.ink, fontWeight: 600 }}>insurance agent.</span>
        </div>
      </div>
    </Scene>
  );
};
