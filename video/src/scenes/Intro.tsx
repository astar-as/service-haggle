import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Camera, Words } from "../fx";
import { C, fontFamily } from "../theme";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame: frame - 2, fps, config: { damping: 10, stiffness: 220 } });
  const letters = "lowball".split("");
  const orbit = spring({ frame: frame - 30, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ fontFamily, color: C.white }}>
      <Backdrop dark tint="#0B1A4A" speed={2} />
      <Camera push={0.08} tilt={2.4} shakeAt={[3]}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          {Array.from({ length: 14 }).map((_, i) => {
            const a = (i / 14) * Math.PI * 2 + frame / 26;
            const r = 470 + Math.sin(frame / 9 + i) * 20;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 18,
                  height: 18,
                  marginLeft: -9,
                  marginTop: -9,
                  borderRadius: 999,
                  background: i % 3 === 0 ? "#7FB2FF" : C.white,
                  boxShadow: "0 0 24px rgba(127,178,255,0.9)",
                  transform: `translate(${Math.cos(a) * r * orbit}px, ${Math.sin(a) * r * 0.42 * orbit}px) scale(${orbit})`,
                  opacity: orbit,
                }}
              />
            );
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 46 }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 26,
                background: C.white,
                transform: `scale(${mark}) rotate(${(1 - mark) * -180}deg)`,
                boxShadow: "0 0 60px rgba(127,178,255,0.8)",
              }}
            />
            <div style={{ display: "flex", fontSize: 210, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1 }}>
              {letters.map((l, i) => {
                const p = spring({ frame: frame - 6 - i * 2, fps, config: { damping: 13, stiffness: 220 } });
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      opacity: p,
                      transform: `translateY(${(1 - p) * 90}px) scale(${interpolate(p, [0, 1], [1.4, 1])})`,
                      filter: `blur(${(1 - p) * 10}px)`,
                    }}
                  >
                    {l}
                  </span>
                );
              })}
            </div>
          </div>
          <div style={{ position: "absolute", top: "64%", fontSize: 54, fontWeight: 500, letterSpacing: "-0.02em", color: "rgba(255,255,255,0.75)" }}>
            <Words text="Your personal insurance agent." delay={22} stagger={3} color={(w) => (w === "insurance" || w === "agent." ? C.white : undefined)} />
          </div>
        </AbsoluteFill>
      </Camera>
    </AbsoluteFill>
  );
};
