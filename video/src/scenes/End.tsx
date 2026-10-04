import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, Logo, Scene } from "../theme";

const PARTNERS = ["Neon", "Fly.io", "Exa", "AgentMail", "Mastra", "assistant-ui", "Kernel", "OpenAI GPT-Live"];

export const End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 14, stiffness: 150 } });
  const tag = spring({ frame: frame - 26, fps, config: { damping: 200 } });

  return (
    <Scene push={0.025}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 40 }}>
        <div style={{ transform: `scale(${0.8 + 0.2 * logo})`, opacity: logo }}>
          <Logo size={170} />
        </div>
        <div style={{ fontSize: 60, fontWeight: 600, letterSpacing: "-0.03em", color: C.ink2, opacity: tag, transform: `translateY(${(1 - tag) * 24}px)` }}>
          Never overpay again.
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 90, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <span style={{ fontSize: 22, color: C.subtle, opacity: tag }}>Built with</span>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: 1500 }}>
          {PARTNERS.map((p, i) => {
            const s = spring({ frame: frame - 34 - i * 3, fps, config: { damping: 16, stiffness: 180 } });
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
                  boxShadow: `0 0 0 1.5px ${C.line}`,
                  opacity: s,
                  transform: `translateY(${(1 - s) * 20}px)`,
                }}
              >
                {p}
              </span>
            );
          })}
        </div>
      </div>
    </Scene>
  );
};
