import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, Check, Counter, Scene } from "../theme";

export const Result: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const oldIn = spring({ frame, fps, config: { damping: 200 } });
  const strike = interpolate(frame, [8, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const big = spring({ frame: frame - 14, fps, config: { damping: 11, stiffness: 160 } });
  const chip = spring({ frame: frame - 24, fps, config: { damping: 14, stiffness: 180 } });
  const year = spring({ frame: frame - 34, fps, config: { damping: 16, stiffness: 150 } });

  return (
    <Scene push={0.04}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
          <span style={{ position: "relative", fontSize: 130, fontWeight: 600, color: C.faint, letterSpacing: "-0.05em", opacity: oldIn, fontVariantNumeric: "tabular-nums" }}>
            $248
            <span style={{ position: "absolute", left: -6, right: -6, top: "52%", height: 9, borderRadius: 9, background: C.faint, transform: `scaleX(${strike})`, transformOrigin: "left" }} />
          </span>
          <span style={{ fontSize: 260, fontWeight: 700, color: C.money, letterSpacing: "-0.06em", lineHeight: 1, transform: `scale(${big})`, display: "inline-block", fontVariantNumeric: "tabular-nums" }}>
            $185
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 30px",
            borderRadius: 999,
            background: C.moneySoft,
            color: C.money,
            fontSize: 36,
            fontWeight: 600,
            transform: `scale(${chip})`,
            opacity: chip,
          }}
        >
          <Check size={34} />
          Same coverage
        </div>
        <div style={{ fontSize: 64, fontWeight: 600, letterSpacing: "-0.03em", opacity: year, transform: `translateY(${(1 - year) * 30}px)`, marginTop: 10 }}>
          <span style={{ color: C.money }}>
            +<Counter from={0} to={756} start={34} duration={34} />
          </span>{" "}
          <span style={{ color: C.muted, fontWeight: 500 }}>a year, back in your pocket</span>
        </div>
      </div>
    </Scene>
  );
};
