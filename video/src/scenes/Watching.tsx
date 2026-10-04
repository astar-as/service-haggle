import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, card, Powered, Scene } from "../theme";

const EVENTS = [
  { date: "Sep 17", text: "USAA seeks 6.9% California auto increase", source: "Exa", at: 6, life: false },
  { date: "Sep 19", text: "Covered California premiums jump for 2027", source: "Exa", at: 22, life: false },
  { date: "Sep 06", text: "Gas spend down 60% since August. Driving less.", source: "Bank data", at: 78, life: true },
  { date: "Sep 18", text: "Paycheck up 18%. Higher deductible is fine now.", source: "Bank data", at: 98, life: true },
];

export const Watching: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const radar = (frame % 45) / 45;
  const notice = spring({ frame: frame - 118, fps, config: { damping: 12, stiffness: 180 } });

  return (
    <Scene push={0.04}>
      <div style={{ position: "absolute", left: 150, top: 0, bottom: 0, width: 520, display: "flex", flexDirection: "column", justifyContent: "center", gap: 28 }}>
        <div style={{ position: "relative", width: 130, height: 130 }}>
          {[0, 0.5].map((o) => {
            const r = (radar + o) % 1;
            return (
              <div
                key={o}
                style={{ position: "absolute", inset: 0, borderRadius: 999, border: `3px solid ${C.accent}`, transform: `scale(${0.4 + r * 1.2})`, opacity: 1 - r }}
              />
            );
          })}
          <div style={{ position: "absolute", left: 45, top: 45, width: 40, height: 40, borderRadius: 999, background: C.accent }} />
        </div>
        <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.05 }}>
          Watching
          <br />
          <span style={{ color: C.accent }}>{frame < 66 ? "the market." : "your life."}</span>
        </div>
        <div style={{ fontSize: 34, color: C.muted, opacity: notice, transform: `translateY(${(1 - notice) * 20}px)` }}>It notices.</div>
      </div>
      <div style={{ position: "absolute", right: 150, top: 0, bottom: 0, width: 960, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
        {EVENTS.map((e) => {
          const p = spring({ frame: frame - e.at, fps, config: { damping: 17, stiffness: 150 } });
          const glow = e.life ? interpolate(frame - e.at, [8, 20, 40], [0, 1, 0.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
          return (
            <div
              key={e.text}
              style={{
                ...card,
                display: "grid",
                gridTemplateColumns: "120px 1fr auto",
                alignItems: "center",
                gap: 28,
                padding: "34px 40px",
                opacity: p,
                transform: `translateX(${(1 - p) * 140}px) scale(${0.96 + 0.04 * p})`,
                boxShadow: `0 0 0 ${1.5 + glow * 1.5}px ${e.life ? `rgba(34,88,229,${0.25 + glow * 0.75})` : C.line}, 0 30px 60px -30px rgba(19,22,27,0.18)`,
              }}
            >
              <span style={{ fontSize: 26, color: C.subtle, fontVariantNumeric: "tabular-nums" }}>{e.date}</span>
              <span style={{ fontSize: 32, fontWeight: 500, lineHeight: 1.25 }}>{e.text}</span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: e.life ? C.accent : C.muted,
                  background: e.life ? C.accentSoft : C.hair,
                  padding: "8px 16px",
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                }}
              >
                {e.source}
              </span>
            </div>
          );
        })}
      </div>
      <Powered items={["Market research · Exa", "Memory · Neon Postgres"]} delay={14} />
    </Scene>
  );
};
