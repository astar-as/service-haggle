import React from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Burst, Camera } from "../fx";
import { fontFamily, usd } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const INK = "#E8EEFF";
const DIM = "rgba(200,215,255,0.55)";
const BLUE = "#5B8CFF";
const GREEN = "#3DDC84";

type Kind = "call" | "email" | "search" | "read" | "compare" | "browser";
const TASKS: { kind: Kind; text: string }[] = [
  { kind: "call", text: "Call · Northstar" },
  { kind: "call", text: "Call · Bayline" },
  { kind: "call", text: "Call · Harbor" },
  { kind: "email", text: "Mail · Golden Gate" },
  { kind: "email", text: "Mail · Redwood" },
  { kind: "search", text: "Exa · rate filings" },
  { kind: "search", text: "Exa · competitors" },
  { kind: "read", text: "Reading coverage" },
  { kind: "compare", text: "Matching limits" },
  { kind: "browser", text: "Kernel · retention" },
  { kind: "search", text: "Exa · mileage rules" },
  { kind: "compare", text: "Deductibles" },
  { kind: "email", text: "Mail · Pacific Crest" },
  { kind: "call", text: "Call · Sunwise" },
  { kind: "read", text: "Bank data" },
  { kind: "compare", text: "Ranking offers" },
  { kind: "search", text: "Exa · AM Best" },
  { kind: "browser", text: "Kernel · quote form" },
  { kind: "call", text: "Call · Cascade" },
  { kind: "email", text: "Mail · Harbor & Pine" },
  { kind: "read", text: "Renewal PDF" },
  { kind: "compare", text: "Same coverage" },
  { kind: "search", text: "Exa · SF premiums" },
  { kind: "compare", text: "Memory sync" },
  { kind: "email", text: "Mail · Sunwise" },
  { kind: "search", text: "Exa · discounts" },
];

const COLS = 7;
const ROWS = 4;
const TW = 232;
const TH = 100;
const GX = 18;
const GY = 24;
const GRID_W = COLS * TW + (COLS - 1) * GX;
const LEFT = (1920 - GRID_W) / 2;
const TOP = 300;
const center = { x: LEFT + 3 * (TW + GX) + TW / 2, y: TOP + (ROWS * TH + (ROWS - 1) * GY) / 2 };
const SLOTS = Array.from({ length: COLS * ROWS }, (_, k) => k).filter((k) => !(k % COLS === 3 && (Math.floor(k / COLS) === 1 || Math.floor(k / COLS) === 2)));
const tilePos = (i: number) => {
  const k = SLOTS[i];
  return { x: LEFT + (k % COLS) * (TW + GX) + TW / 2, y: TOP + Math.floor(k / COLS) * (TH + GY) + TH / 2 };
};

const OFFERS = [
  { at: 30, tile: 2, price: 242 },
  { at: 44, tile: 1, price: 205 },
  { at: 56, tile: 4, price: 213 },
  { at: 72, tile: 0, price: 185, final: true },
];

const Activity: React.FC<{ kind: Kind; seed: number }> = ({ kind, seed }) => {
  const frame = useCurrentFrame();
  if (kind === "call")
    return (
      <span style={{ display: "flex", gap: 3, alignItems: "center", height: 22 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} style={{ width: 4, borderRadius: 2, background: BLUE, height: 6 + Math.abs(Math.sin((frame + seed * 7 + i * 9) / 3)) * 16 }} />
        ))}
      </span>
    );
  if (kind === "email")
    return (
      <span style={{ display: "flex", gap: 5 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 7, height: 7, borderRadius: 9, background: BLUE, opacity: 0.3 + 0.7 * Math.abs(Math.sin((frame + i * 5 + seed) / 4)) }} />
        ))}
      </span>
    );
  return (
    <span
      style={{
        width: 20,
        height: 20,
        borderRadius: 99,
        border: `3px solid rgba(91,140,255,0.25)`,
        borderTopColor: BLUE,
        transform: `rotate(${(frame + seed * 13) * 18}deg)`,
        display: "inline-block",
      }}
    />
  );
};

export const Negotiation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const agents = Math.round(interpolate(frame, [2, 28], [0, TASKS.length], clamp));
  const prices = [248, ...OFFERS.filter((o) => frame >= o.at).map((o) => o.price)];
  const best = Math.min(...prices);
  const done = frame >= 72;
  const hub = spring({ frame: frame - 2, fps, config: { damping: 12, stiffness: 180 } });
  const pulse = (frame % 20) / 20;

  return (
    <AbsoluteFill style={{ fontFamily, color: INK }}>
      <Backdrop dark speed={2.4} />
      <Camera push={0.1} tilt={2.6} shakeAt={[72]}>
        <div style={{ position: "absolute", left: LEFT, top: 92, right: LEFT, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 26, color: DIM, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 12, height: 12, borderRadius: 99, background: done ? GREEN : BLUE, boxShadow: `0 0 16px ${done ? GREEN : BLUE}` }} />
              Working for Maya right now
            </div>
            <div style={{ fontSize: 86, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>
              {agents} agents<span style={{ color: DIM, fontWeight: 500, fontSize: 44 }}> · 5 insurers · 1 memory</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, color: DIM }}>{done ? "Agreed" : "Best offer"}</div>
            <div
              style={{
                fontSize: 96,
                fontWeight: 700,
                letterSpacing: "-0.05em",
                lineHeight: 1,
                color: done ? GREEN : INK,
                fontVariantNumeric: "tabular-nums",
                textShadow: done ? `0 0 40px rgba(61,220,132,0.6)` : "none",
              }}
            >
              {usd(best)}
            </div>
          </div>
        </div>

        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {TASKS.map((_, i) => {
            const p = tilePos(i);
            const show = interpolate(frame, [4 + i, 10 + i], [0, 1], clamp);
            return (
              <line
                key={i}
                x1={center.x}
                y1={center.y}
                x2={p.x}
                y2={p.y}
                stroke="rgba(120,160,255,0.22)"
                strokeWidth={2}
                strokeDasharray="6 10"
                strokeDashoffset={-frame * 3}
                opacity={show}
              />
            );
          })}
          {OFFERS.map((o) => {
            const from = tilePos(o.tile);
            const t1 = interpolate(frame, [o.at, o.at + 8], [0, 1], clamp);
            const t2 = interpolate(frame, [o.at + 8, o.at + 18], [0, 1], clamp);
            if (frame < o.at || frame > o.at + 22) return null;
            return (
              <g key={o.at}>
                {t1 < 1 && <circle cx={from.x + (center.x - from.x) * t1} cy={from.y + (center.y - from.y) * t1} r={10} fill={o.final ? GREEN : BLUE} style={{ filter: `drop-shadow(0 0 12px ${BLUE})` }} />}
                {t1 >= 1 &&
                  TASKS.map((_, i) => {
                    if (i === o.tile) return null;
                    const to = tilePos(i);
                    return <circle key={i} cx={center.x + (to.x - center.x) * t2} cy={center.y + (to.y - center.y) * t2} r={5} fill={o.final ? GREEN : BLUE} opacity={1 - t2 * 0.6} />;
                  })}
              </g>
            );
          })}
        </svg>

        {TASKS.map((task, i) => {
          const p = spring({ frame: frame - 3 - i, fps, config: { damping: 13, stiffness: 230 } });
          const pos = tilePos(i);
          const hit = OFFERS.find((o) => o.tile === i && frame >= o.at);
          const flash = OFFERS.some((o) => frame >= o.at + 8 && frame < o.at + 20 && o.tile !== i) ? 0.35 : 0;
          const final = hit?.final;
          const machine = Math.floor(random(`m${i}`) * 0xffffff)
            .toString(16)
            .padStart(6, "0");
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: pos.x - TW / 2,
                top: pos.y - TH / 2,
                width: TW,
                height: TH,
                borderRadius: 18,
                padding: "14px 16px",
                background: final ? "rgba(61,220,132,0.14)" : hit ? "rgba(91,140,255,0.18)" : "rgba(255,255,255,0.05)",
                boxShadow: `0 0 0 1.5px ${final ? GREEN : hit ? BLUE : `rgba(140,170,255,${0.18 + flash})`}, 0 20px 40px -20px rgba(0,0,0,0.6)`,
                backdropFilter: "blur(6px)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                opacity: p,
                transform: `scale(${interpolate(p, [0, 1], [0.4, 1])}) translateY(${(1 - p) * 40}px)`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 15, color: DIM, fontWeight: 500 }}>
                <span>Agent {String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>fly · {machine}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 600, whiteSpace: "nowrap" }}>{task.text}</span>
                {hit ? (
                  <span style={{ fontSize: 24, fontWeight: 700, color: final ? GREEN : BLUE, fontVariantNumeric: "tabular-nums" }}>{usd(hit.price)}</span>
                ) : (
                  <Activity kind={task.kind} seed={i} />
                )}
              </div>
            </div>
          );
        })}

        <div
          style={{
            position: "absolute",
            left: center.x - 100,
            top: center.y - 100,
            width: 200,
            height: 200,
            borderRadius: 999,
            background: "radial-gradient(circle, rgba(91,140,255,0.95) 0%, rgba(34,88,229,0.9) 60%, rgba(34,88,229,0.6) 100%)",
            boxShadow: `0 0 ${60 + 40 * Math.sin(frame / 5)}px rgba(91,140,255,0.8)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${hub})`,
            textAlign: "center",
            zIndex: 2,
          }}
        >
          <div style={{ position: "absolute", inset: -14, borderRadius: 999, border: "2px solid rgba(140,180,255,0.6)", transform: `scale(${1 + pulse * 0.5})`, opacity: 1 - pulse }} />
          <span style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>Shared</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>memory</span>
          <span style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>Neon</span>
        </div>
        <Burst at={72} color={GREEN} x={`${(tilePos(0).x / 1920) * 100}%`} y={`${(tilePos(0).y / 1080) * 100}%`} size={340} rays={14} />
      </Camera>

      <div style={{ position: "absolute", left: LEFT, right: LEFT, bottom: 70, display: "flex", gap: 14, flexWrap: "wrap" }}>
        {["Every agent: its own Fly.io Machine", "Calls · OpenAI GPT-Live", "Email · AgentMail", "Research · Exa", "Browsers · Kernel", "Memory · Neon"].map((t, i) => {
          const p = spring({ frame: frame - 10 - i * 3, fps, config: { damping: 16, stiffness: 190 } });
          return (
            <span
              key={t}
              style={{
                fontSize: 21,
                fontWeight: 500,
                color: INK,
                padding: "10px 18px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.07)",
                boxShadow: "0 0 0 1.5px rgba(140,170,255,0.25)",
                opacity: p,
                transform: `translateY(${(1 - p) * 16}px)`,
              }}
            >
              {t}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
