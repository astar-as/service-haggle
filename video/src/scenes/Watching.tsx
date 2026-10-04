import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Camera, Slam, Words } from "../fx";
import { C, card, fontFamily, Powered } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const QUERY = "california auto insurance rate changes 2026";

const RESULTS = [
  { d: "insurancejournal.com", t: "USAA seeks 6.9% California auto rate increase", hit: true },
  { d: "latimes.com", t: "Why Californians are paying more for car insurance" },
  { d: "covered.ca.gov", t: "Covered California announces 2027 premium rates", hit: true },
  { d: "nerdwallet.com", t: "Average cost of car insurance in California, 2026" },
  { d: "insurance.ca.gov", t: "Prop 103: mileage must factor into your rate" },
  { d: "reuters.com", t: "Insurers expand usage-based discounts for remote workers" },
  { d: "bankrate.com", t: "Cheapest full coverage in San Francisco" },
  { d: "valuepenguin.com", t: "Low-mileage discounts compared" },
  { d: "carriermanagement.com", t: "Personal auto filings: Q3 roundup" },
];

const GAS = [48, 53, 50, 56, 51, 49, 20, 23, 17, 21, 18, 19];

const Chart: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const W = 860;
  const H = 300;
  const max = 60;
  const pts = GAS.map((v, i) => [(i / (GAS.length - 1)) * W, H - (v / max) * H] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const draw = interpolate(frame, [start, start + 30], [0, 1], clamp);
  const len = 1400;
  const dropX = pts[6][0];
  const ann = interpolate(frame, [start + 22, start + 30], [0, 1], clamp);
  return (
    <svg width={W} height={H + 40} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="gasfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(34,88,229,0.28)" />
          <stop offset="100%" stopColor="rgba(34,88,229,0)" />
        </linearGradient>
        <clipPath id="reveal">
          <rect x={0} y={-20} width={W * draw} height={H + 60} />
        </clipPath>
      </defs>
      <g clipPath="url(#reveal)">
        <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill="url(#gasfill)" />
      </g>
      <path d={d} fill="none" stroke={C.accent} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />
      <line x1={dropX - 40} x2={dropX - 40} y1={0} y2={H} stroke={C.ink} strokeOpacity={0.25 * ann} strokeWidth={2} strokeDasharray="6 8" />
      <text x={dropX - 28} y={28} fontSize={22} fill={C.muted} opacity={ann} fontFamily={fontFamily}>
        Aug 10 · started working from home
      </text>
    </svg>
  );
};

export const Watching: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const typed = QUERY.slice(0, Math.floor(interpolate(frame, [2, 18], [0, QUERY.length], clamp)));
  const partB = interpolate(frame, [48, 58], [0, 1], clamp);
  const count = Math.round(interpolate(frame, [18, 40], [0, 48], clamp));
  const bar = spring({ frame, fps, config: { damping: 16, stiffness: 180 } });
  const life = spring({ frame: frame - 52, fps, config: { damping: 16, stiffness: 150 } });
  const raise = spring({ frame: frame - 100, fps, config: { damping: 11, stiffness: 200 } });
  const gasChip = spring({ frame: frame - 82, fps, config: { damping: 11, stiffness: 200 } });

  return (
    <AbsoluteFill style={{ fontFamily, color: C.ink }}>
      <Backdrop speed={1.8} />
      <Camera push={0.09} tilt={1.8} shakeAt={[126]}>
        <AbsoluteFill style={{ opacity: 1 - partB, transform: `scale(${1 + partB * 0.2})`, filter: `blur(${partB * 16}px)` }}>
          <div
            style={{
              position: "absolute",
              left: 260,
              right: 260,
              top: 110,
              height: 110,
              ...card,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              gap: 24,
              padding: "0 40px",
              transform: `scale(${0.85 + 0.15 * bar})`,
              opacity: bar,
            }}
          >
            <span style={{ background: C.ink, color: C.white, fontWeight: 700, fontSize: 26, padding: "8px 18px", borderRadius: 999 }}>Exa</span>
            <span style={{ fontSize: 40, fontWeight: 500, flex: 1 }}>
              {typed}
              <span style={{ display: "inline-block", width: 3, height: 40, background: C.accent, marginLeft: 4, verticalAlign: -6, opacity: frame % 10 < 6 ? 1 : 0 }} />
            </span>
            <span style={{ fontSize: 26, color: C.subtle, fontVariantNumeric: "tabular-nums" }}>{count > 0 ? `${count} sources · 0.9s` : "searching…"}</span>
          </div>
          <div style={{ position: "absolute", left: 160, right: 160, top: 270, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
            {RESULTS.map((r, i) => {
              const p = spring({ frame: frame - 16 - i * 2, fps, config: { damping: 15, stiffness: 200 } });
              const pick = r.hit ? spring({ frame: frame - 36, fps, config: { damping: 10, stiffness: 220 } }) : 0;
              return (
                <div
                  key={r.d}
                  style={{
                    ...card,
                    borderRadius: 22,
                    padding: "26px 28px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    opacity: p * (r.hit ? 1 : interpolate(frame, [36, 44], [1, 0.35], clamp)),
                    transform: `translateY(${(1 - p) * 120}px) scale(${(0.9 + 0.1 * p) * (1 + pick * 0.05)})`,
                    boxShadow: r.hit && pick > 0.01 ? `0 0 0 ${3 * pick}px ${C.accent}, 0 30px 60px -20px rgba(34,88,229,0.45)` : card.boxShadow,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 20, color: C.subtle }}>
                    <span style={{ width: 22, height: 22, borderRadius: 999, background: C.accentSoft, color: C.accent, fontSize: 13, fontWeight: 700, display: "grid", placeItems: "center" }}>
                      {r.d[0].toUpperCase()}
                    </span>
                    {r.d}
                    {r.hit && pick > 0.01 && <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 700, color: C.accent }}>RELEVANT</span>}
                  </span>
                  <span style={{ fontSize: 25, fontWeight: 600, lineHeight: 1.25 }}>{r.t}</span>
                  <span style={{ height: 8, width: "88%", borderRadius: 4, background: C.hair }} />
                  <span style={{ height: 8, width: "64%", borderRadius: 4, background: C.hair }} />
                </div>
              );
            })}
          </div>
        </AbsoluteFill>

        <AbsoluteFill style={{ opacity: partB }}>
          <div style={{ position: "absolute", left: 150, top: 120, fontSize: 92, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1 }}>
            {frame >= 50 && <Words text="And your life." delay={50} stagger={3} color={(w) => (w === "life." ? C.accent : undefined)} />}
          </div>
          <div
            style={{
              position: "absolute",
              left: 150,
              top: 300,
              width: 960,
              ...card,
              padding: "36px 44px 24px",
              opacity: life,
              transform: `translateY(${(1 - life) * 80}px)`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
              <span style={{ fontSize: 28, fontWeight: 600 }}>Gas spending · weekly</span>
              <span style={{ fontSize: 22, color: C.subtle }}>Bank data · private</span>
            </div>
            <Chart start={56} />
          </div>
          <div style={{ position: "absolute", left: 1170, top: 300, display: "flex", flexDirection: "column", gap: 26 }}>
            <div style={{ ...card, padding: "34px 40px", width: 600, transform: `scale(${gasChip})`, opacity: gasChip }}>
              <div style={{ fontSize: 24, color: C.subtle }}>Driving less</div>
              <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: "-0.05em", color: C.accent, lineHeight: 1.05 }}>−60%</div>
              <div style={{ fontSize: 24, color: C.muted }}>Low-mileage discount unlocked</div>
            </div>
            <div style={{ ...card, padding: "34px 40px", width: 600, transform: `scale(${raise})`, opacity: raise }}>
              <div style={{ fontSize: 24, color: C.subtle }}>Paycheck</div>
              <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: "-0.05em", color: C.money, lineHeight: 1.05 }}>+18%</div>
              <div style={{ fontSize: 24, color: C.muted }}>A higher deductible is fine now</div>
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 150, overflow: "hidden", height: 64, opacity: life }}>
            <div style={{ display: "flex", gap: 22, transform: `translateX(${-frame * 14}px)`, whiteSpace: "nowrap" }}>
              {Array.from({ length: 4 })
                .flatMap(() => ["Shell −$28.40", "Trader Joe's −$71.20", "Halcyon Labs payroll +$4,540", "Chevron −$31.12", "Blue Bottle −$6.50", "Northstar Mutual −$248", "Tartine −$22.75", "Meridian Health −$642"])
                .map((t, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 24,
                      fontWeight: 500,
                      padding: "14px 22px",
                      borderRadius: 999,
                      background: C.white,
                      boxShadow: `0 0 0 1.5px ${C.line}`,
                      color: t.includes("+") ? C.money : C.ink2,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {t}
                  </span>
                ))}
            </div>
          </div>
          <div style={{ position: "absolute", right: 150, top: 120 }}>
            <Slam at={126}>
              <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: "-0.045em", color: C.ink }}>It notices.</div>
            </Slam>
          </div>
        </AbsoluteFill>
      </Camera>
      <Powered items={frame < 50 ? ["Market research · Exa"] : ["Memory · Neon Postgres", "Bank data stays private"]} delay={frame < 50 ? 6 : 56} />
    </AbsoluteFill>
  );
};
