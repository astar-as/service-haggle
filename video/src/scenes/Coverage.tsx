import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, card, Powered, Rise, Scene } from "../theme";

const ITEMS = [
  { label: "Bodily injury liability", value: "$100,000 / $300,000", must: true },
  { label: "Property damage", value: "$100,000", must: true },
  { label: "Uninsured motorist", value: "$100,000 / $300,000", must: true },
  { label: "Collision", value: "$500 deductible", must: true },
  { label: "Comprehensive", value: "$500 deductible", must: true },
  { label: "Rental reimbursement", value: "$40 / day", must: false },
];

export const Coverage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scan = interpolate(frame, [10, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <Scene push={0.05}>
      <div style={{ position: "absolute", left: 150, top: 150, width: 560, display: "flex", flexDirection: "column", gap: 18 }}>
        <Rise delay={0}>
          <span style={{ fontSize: 30, color: C.subtle }}>Auto · Full coverage · 2019 Honda Civic</span>
        </Rise>
        <Rise delay={4}>
          <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.05 }}>Northstar Mutual</div>
        </Rise>
        <Rise delay={8}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 10 }}>
            <span style={{ fontSize: 150, fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>$248</span>
            <span style={{ fontSize: 36, color: C.subtle }}>/mo</span>
          </div>
        </Rise>
        <Rise delay={14}>
          <div style={{ fontSize: 36, color: C.muted, marginTop: 12, lineHeight: 1.35 }}>
            Fair is about <span style={{ color: C.accent, fontWeight: 600 }}>$178</span>.
          </div>
        </Rise>
      </div>
      <div style={{ position: "absolute", right: 150, top: 130, width: 900 }}>
        <div style={{ ...card, overflow: "hidden", position: "relative" }}>
          {ITEMS.map((it, i) => {
            const p = spring({ frame: frame - 6 - i * 5, fps, config: { damping: 18, stiffness: 150 } });
            const chip = spring({ frame: frame - 22 - i * 5, fps, config: { damping: 10, stiffness: 200 } });
            return (
              <div
                key={it.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  height: 128,
                  padding: "0 40px",
                  borderTop: i ? `1.5px solid ${C.hair}` : "none",
                  opacity: p,
                  transform: `translateX(${(1 - p) * 80}px)`,
                }}
              >
                <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, fontSize: 32, fontWeight: 500 }}>
                  {it.label}
                  {it.must && (
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: C.accent,
                        background: C.accentSoft,
                        padding: "5px 14px",
                        borderRadius: 999,
                        transform: `scale(${chip})`,
                        display: "inline-block",
                      }}
                    >
                      Must keep
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 32, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{it.value}</span>
              </div>
            );
          })}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${scan * 100}%`,
              height: 3,
              background: C.accent,
              boxShadow: `0 0 30px 8px rgba(34,88,229,0.35)`,
              opacity: interpolate(scan, [0, 0.05, 0.95, 1], [0, 1, 1, 0]),
            }}
          />
        </div>
      </div>
      <Powered items={["Read from your inbox · AgentMail", "Parsed by Mastra agents"]} delay={30} />
    </Scene>
  );
};
