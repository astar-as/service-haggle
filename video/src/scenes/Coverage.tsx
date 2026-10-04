import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Camera, Words } from "../fx";
import { C, card, fontFamily, MailIcon, Powered } from "../theme";

const ITEMS = [
  { label: "Bodily injury", value: "$100k / $300k", must: true },
  { label: "Property damage", value: "$100,000", must: true },
  { label: "Uninsured motorist", value: "$100k / $300k", must: true },
  { label: "Collision", value: "$500 deductible", must: true },
  { label: "Comprehensive", value: "$500 deductible", must: true },
  { label: "Rental car", value: "$40 / day", must: false },
];

const DOC = { x: 470, y: 560 };
const ROW = (i: number) => ({ x: 1320, y: 250 + i * 112 });

export const Coverage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const doc = spring({ frame: frame - 6, fps, config: { damping: 14, stiffness: 160 } });
  const mail = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scan = interpolate(frame, [14, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const table = spring({ frame: frame - 14, fps, config: { damping: 16, stiffness: 150 } });

  return (
    <AbsoluteFill style={{ fontFamily, color: C.ink }}>
      <Backdrop speed={1.4} />
      <Camera push={0.08} tilt={2}>
        <div
          style={{
            position: "absolute",
            left: 120 + mail * (DOC.x - 160),
            top: 120 + mail * (DOC.y - 420),
            opacity: interpolate(frame, [0, 4, 12, 16], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            transform: `scale(${1.4 - mail * 0.6}) rotate(${(1 - mail) * -20}deg)`,
            display: "flex",
            alignItems: "center",
            gap: 14,
            ...card,
            padding: "18px 26px",
            fontSize: 26,
            fontWeight: 600,
          }}
        >
          <MailIcon size={32} color={C.accent} /> Renewal notice
        </div>

        <div
          style={{
            position: "absolute",
            left: DOC.x - 250,
            top: DOC.y - 340,
            width: 500,
            height: 680,
            transform: `perspective(1400px) rotateY(${interpolate(doc, [0, 1], [-50, 16])}deg) rotateZ(${(1 - doc) * -8}deg) scale(${0.7 + 0.3 * doc})`,
            opacity: doc,
          }}
        >
          <div style={{ ...card, position: "absolute", inset: 0, padding: 40, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.accent, letterSpacing: "0.08em" }}>DECLARATIONS PAGE</div>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>Northstar Mutual</div>
            <div style={{ fontSize: 20, color: C.subtle, marginBottom: 10 }}>Auto renewal · Policy NM-4471-CA</div>
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} style={{ height: 9, borderRadius: 4, background: i % 4 === 0 ? "#D5DAE0" : C.hair, width: `${50 + ((i * 41) % 48)}%` }} />
            ))}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${scan * 100}%`,
                height: 4,
                background: C.accent,
                boxShadow: "0 0 40px 14px rgba(34,88,229,0.35)",
                opacity: interpolate(scan, [0, 0.04, 0.96, 1], [0, 1, 1, 0]),
              }}
            />
          </div>
        </div>

        <div style={{ position: "absolute", left: 1320 - 430, top: 140, width: 860, opacity: table, transform: `translateX(${(1 - table) * 60}px)` }}>
          <div style={{ fontSize: 30, fontWeight: 600, marginBottom: 18, display: "flex", justifyContent: "space-between" }}>
            <Words text="What you're covered for" delay={14} stagger={2} />
            <span style={{ color: C.subtle, fontWeight: 500 }}>$248/mo</span>
          </div>
        </div>

        {ITEMS.map((it, i) => {
          const start = 22 + i * 7;
          const t = interpolate(frame, [start, start + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const e = 1 - Math.pow(1 - t, 3);
          const from = { x: DOC.x + 60, y: DOC.y - 200 + i * 70 };
          const to = ROW(i);
          const landed = spring({ frame: frame - start - 12, fps, config: { damping: 12, stiffness: 220 } });
          const flying = t > 0 && t < 1;
          return (
            <React.Fragment key={it.label}>
              <div
                style={{
                  position: "absolute",
                  left: to.x - 430,
                  top: to.y - 48,
                  width: 860,
                  height: 96,
                  ...card,
                  borderRadius: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "0 34px",
                  opacity: landed,
                  transform: `scale(${0.94 + 0.06 * landed})`,
                }}
              >
                <span style={{ flex: 1, fontSize: 30, fontWeight: 500, display: "flex", alignItems: "center", gap: 14 }}>
                  {it.label}
                  {it.must && (
                    <span style={{ fontSize: 18, fontWeight: 700, color: C.accent, background: C.accentSoft, padding: "5px 12px", borderRadius: 999, transform: `scale(${landed})`, display: "inline-block" }}>
                      Must keep
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 30, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{it.value}</span>
              </div>
              {flying && (
                <div
                  style={{
                    position: "absolute",
                    left: from.x + (to.x - from.x) * e,
                    top: from.y + (to.y - from.y) * e - Math.sin(e * Math.PI) * 120,
                    transform: `translate(-50%, -50%) scale(${1 + Math.sin(e * Math.PI) * 0.15})`,
                    background: C.accent,
                    color: C.white,
                    fontSize: 22,
                    fontWeight: 600,
                    padding: "10px 18px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    boxShadow: "0 18px 40px -12px rgba(34,88,229,0.7)",
                  }}
                >
                  {it.label} · {it.value}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </Camera>
      <Powered items={["Read from your inbox · AgentMail", "Parsed by Mastra agents"]} delay={20} />
    </AbsoluteFill>
  );
};
