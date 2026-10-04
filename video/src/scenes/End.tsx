import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Camera, Words } from "../fx";
import { C, fontFamily, Logo } from "../theme";

const PARTNERS = ["Neon", "Fly.io", "Exa", "AgentMail", "Mastra", "assistant-ui", "Kernel", "OpenAI GPT-Live", "ElevenLabs"];

export const End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: frame - 2, fps, config: { damping: 12, stiffness: 180 } });

  return (
    <AbsoluteFill style={{ fontFamily, color: C.ink }}>
      <Backdrop speed={0.8} />
      <Camera push={0.05} tilt={1}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 36, paddingBottom: 120 }}>
          <div style={{ transform: `scale(${0.6 + 0.4 * logo})`, opacity: logo, filter: `blur(${(1 - logo) * 12}px)` }}>
            <Logo size={190} />
          </div>
          <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: "-0.035em", color: C.ink2 }}>
            <Words text="Never overpay again." delay={18} stagger={3} color={(w) => (w === "again." ? C.accent : undefined)} />
          </div>
        </AbsoluteFill>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          <span style={{ fontSize: 22, color: C.subtle, letterSpacing: "0.12em", fontWeight: 600 }}>BUILT WITH</span>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", maxWidth: 1700 }}>
            {PARTNERS.map((p, i) => {
              const s = spring({ frame: frame - 26 - i * 2, fps, config: { damping: 12, stiffness: 220 } });
              return (
                <span
                  key={p}
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    color: C.ink2,
                    padding: "12px 24px",
                    borderRadius: 999,
                    background: C.white,
                    boxShadow: `0 0 0 1.5px ${C.line}, 0 14px 30px -18px rgba(19,22,27,0.25)`,
                    opacity: s,
                    transform: `translateY(${(1 - s) * 30}px) scale(${0.8 + 0.2 * s})`,
                  }}
                >
                  {p}
                </span>
              );
            })}
          </div>
        </div>
      </Camera>
    </AbsoluteFill>
  );
};
