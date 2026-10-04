import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ease, glide, K, Mark, mono, sans } from "../cx";

const SPONSORS = [
  ["Neon", "Shared memory for every agent"],
  ["Fly.io", "One Machine per agent"],
  ["Exa", "Market research"],
  ["AgentMail", "Email negotiation"],
  ["Mastra", "Agent framework"],
  ["assistant-ui", "Ask anything"],
  ["Kernel", "Browser agents"],
] as const;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const End: React.FC<{ wallAt: number }> = ({ wallAt }) => {
  const frame = useCurrentFrame();
  const logo = interpolate(frame, [0, 16], [0, 1], { ...clamp, easing: ease });
  const tag = interpolate(frame, [10, 26], [0, 1], { ...clamp, easing: ease });
  const up = interpolate(frame, [wallAt - 6, wallAt + 14], [0, 1], { ...clamp, easing: glide });
  const tilt = interpolate(frame, [wallAt, wallAt + 50], [26, 8], { ...clamp, easing: glide });

  return (
    <AbsoluteFill style={{ background: K.canvas, fontFamily: sans, perspective: 2000, perspectiveOrigin: "50% 30%" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(91,155,255,0.12), transparent 60%)", opacity: up }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: interpolate(up, [0, 1], [400, 150]),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
          transform: `scale(${interpolate(up, [0, 1], [1, 0.62])})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 26, opacity: logo, transform: `translateY(${(1 - logo) * 16}px)`, filter: `blur(${(1 - logo) * 6}px)` }}>
          <Mark size={60} />
          <span style={{ fontSize: 128, fontWeight: 600, letterSpacing: "-0.055em", color: K.text, lineHeight: 1 }}>Service Haggle</span>
        </div>
        <div style={{ fontSize: 48, color: K.soft, letterSpacing: "-0.02em", opacity: tag, transform: `translateY(${(1 - tag) * 10}px)` }}>Never overpay again.</div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 160,
          right: 160,
          top: 430,
          transformStyle: "preserve-3d",
          transform: `rotateX(${tilt}deg)`,
          opacity: up,
        }}
      >
        <div style={{ textAlign: "center", fontFamily: mono, fontSize: 18, color: K.mute, letterSpacing: "0.14em", marginBottom: 26 }}>BUILT WITH</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, transformStyle: "preserve-3d" }}>
          {SPONSORS.map(([name, role], i) => {
            const p = interpolate(frame, [wallAt + i * 3, wallAt + 18 + i * 3], [0, 1], { ...clamp, easing: ease });
            return (
              <div
                key={name}
                style={{
                  gridColumn: i >= 4 ? undefined : undefined,
                  padding: "30px 30px",
                  borderRadius: 18,
                  background: K.window,
                  boxShadow: `0 0 0 1px ${K.line}, 0 40px 80px -30px rgba(0,0,0,0.9)`,
                  transform: `translateZ(${(1 - p) * -700}px) translateY(${(1 - p) * 60}px)`,
                  opacity: p,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  ...(i === 4 ? { gridColumnStart: 1 } : {}),
                }}
              >
                <span style={{ fontSize: 40, fontWeight: 600, color: K.text, letterSpacing: "-0.03em" }}>{name}</span>
                <span style={{ fontSize: 19, color: K.soft }}>{role}</span>
              </div>
            );
          })}
          <div
            style={{
              padding: "30px 30px",
              borderRadius: 18,
              border: `1px dashed ${K.line}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 8,
              opacity: interpolate(frame, [wallAt + 24, wallAt + 40], [0, 1], clamp),
            }}
          >
            <span style={{ fontSize: 22, color: K.soft }}>Voice by OpenAI GPT-Live</span>
            <span style={{ fontSize: 17, color: K.mute }}>Video voice by ElevenLabs</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
