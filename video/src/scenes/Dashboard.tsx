import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Camera, Slam, Words } from "../fx";
import { C, card, Counter, fontFamily, Powered } from "../theme";

const ROWS = [
  { name: "Northstar Mutual", kind: "Auto", price: "$248", gap: "−$70" },
  { name: "Meridian Health", kind: "Health", price: "$642", gap: "−$47" },
];

export const Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ fontFamily, color: C.ink }}>
      <Backdrop speed={2.2} />
      <Camera push={0.12} tilt={2} shakeAt={[6]}>
        <div style={{ position: "absolute", left: 150, top: 150, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 44, fontWeight: 500, color: C.muted }}>
            <Words text="Maya pays" delay={0} stagger={2} /> <Counter from={600} to={954} start={0} duration={14} style={{ color: C.ink, fontWeight: 600 }} />
            <span style={{ color: C.muted }}> a month</span>
          </div>
          <Slam at={6} style={{ transformOrigin: "left center" }}>
            <div style={{ fontSize: 230, fontWeight: 700, letterSpacing: "-0.06em", lineHeight: 0.95, color: C.accent }}>
              <Counter from={0} to={117} start={6} duration={16} />
            </div>
          </Slam>
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: "-0.035em" }}>
            <Words text="too much, every month." delay={12} stagger={2} />
          </div>
        </div>
        <div style={{ position: "absolute", right: 150, top: 230, width: 760, display: "flex", flexDirection: "column", gap: 18 }}>
          {ROWS.map((r, i) => {
            const p = spring({ frame: frame - 8 - i * 4, fps, config: { damping: 14, stiffness: 200 } });
            const flash = Math.max(0, 1 - Math.abs(frame - 26 - i * 4) / 8);
            return (
              <div
                key={r.name}
                style={{
                  ...card,
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  padding: "34px 40px",
                  transform: `translateX(${(1 - p) * 300}px) rotate(${(1 - p) * 4}deg)`,
                  opacity: p,
                  boxShadow: `0 0 0 ${1.5 + flash * 3}px ${flash > 0.05 ? C.accent : C.line}, 0 30px 60px -30px rgba(19,22,27,0.18)`,
                }}
              >
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 36, fontWeight: 600 }}>{r.name}</span>
                  <span style={{ fontSize: 24, color: C.accent, fontWeight: 500 }}>{r.kind} · overpaying</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ fontSize: 40, fontWeight: 600 }}>{r.price}</span>
                  <span style={{ fontSize: 28, fontWeight: 600, color: C.accent }}>{r.gap}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Camera>
      <Powered items={["Ask anything · assistant-ui"]} delay={14} />
    </AbsoluteFill>
  );
};
