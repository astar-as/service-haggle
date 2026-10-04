import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Burst, Camera, Slam, Words } from "../fx";
import { C, Check, Counter, fontFamily, Powered } from "../theme";

export const Result: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const strike = interpolate(frame, [4, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const chip = spring({ frame: frame - 22, fps, config: { damping: 11, stiffness: 220 } });
  const year = spring({ frame: frame - 30, fps, config: { damping: 14, stiffness: 180 } });

  return (
    <AbsoluteFill style={{ fontFamily, color: C.ink }}>
      <Backdrop speed={1.6} />
      <Camera push={0.08} tilt={1.4} shakeAt={[12]}>
        <Burst at={12} color={C.money} size={1300} rays={26} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 70 }}>
            <span style={{ position: "relative", fontSize: 150, fontWeight: 600, color: C.faint, letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums" }}>
              $248
              <span style={{ position: "absolute", left: -8, right: -8, top: "52%", height: 10, borderRadius: 10, background: "#E5484D", transform: `scaleX(${strike})`, transformOrigin: "left" }} />
            </span>
            <Slam at={10}>
              <span style={{ fontSize: 300, fontWeight: 700, color: C.money, letterSpacing: "-0.065em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>$185</span>
            </Slam>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "18px 34px",
              borderRadius: 999,
              background: C.moneySoft,
              color: C.money,
              fontSize: 40,
              fontWeight: 700,
              transform: `scale(${chip})`,
              opacity: chip,
            }}
          >
            <Check size={38} /> Same coverage
          </div>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-0.035em", opacity: year, transform: `translateY(${(1 - year) * 40}px)` }}>
            <span style={{ color: C.money }}>
              +<Counter from={0} to={756} start={30} duration={30} />
            </span>{" "}
            <Words text="a year, back in your pocket" delay={34} stagger={2} style={{ color: C.muted, fontWeight: 600 }} />
          </div>
        </AbsoluteFill>
      </Camera>
      <Powered items={["Confirmed by email · AgentMail", "You sign. The agent never does."]} delay={44} />
    </AbsoluteFill>
  );
};
