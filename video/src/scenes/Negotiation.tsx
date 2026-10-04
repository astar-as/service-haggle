import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, card, MailIcon, PhoneIcon, Powered, Scene, usd } from "../theme";

type Line = { insurer: string; channel: "phone" | "email"; x: number; y: number; offers: [number, number][]; agreed?: number; current?: boolean };

const W = 500;
const H = 190;

const LINES: Line[] = [
  { insurer: "Northstar Mutual", channel: "phone", x: 0, y: 0, current: true, offers: [[22, 248], [58, 219], [96, 185]], agreed: 96 },
  { insurer: "Bayline Auto", channel: "phone", x: 1, y: 0, offers: [[34, 231], [70, 205]] },
  { insurer: "Harbor & Pine", channel: "phone", x: 2, y: 0, offers: [[44, 242]] },
  { insurer: "Golden Gate Mutual", channel: "email", x: 0.5, y: 1, offers: [[52, 226]] },
  { insurer: "Redwood Direct", channel: "email", x: 1.5, y: 1, offers: [[64, 213]] },
];

const pos = (l: Line) => ({ left: 160 + l.x * (W + 50), top: 300 + l.y * (H + 50) });

function offerAt(l: Line, frame: number) {
  let o: number | undefined;
  for (const [f, v] of l.offers) if (frame >= f) o = v;
  return o;
}

const Beam: React.FC<{ from: Line; to: Line; start: number; label: string }> = ({ from, to, start, label }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [start, start + 13], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fade = interpolate(frame, [start, start + 3, start + 16, start + 21], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const a = pos(from);
  const b = pos(to);
  const ax = a.left + W / 2;
  const ay = a.top + H / 2;
  const bx = b.left + W / 2;
  const by = b.top + H / 2;
  const x = ax + (bx - ax) * t;
  const y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 120;
  return (
    <>
      <svg style={{ position: "absolute", inset: 0, opacity: fade * 0.5 }} width={1920} height={1080}>
        <path d={`M ${ax} ${ay} Q ${(ax + bx) / 2} ${Math.min(ay, by) - 240} ${bx} ${by}`} stroke={C.accent} strokeWidth={3} strokeDasharray="8 10" fill="none" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: "translate(-50%, -50%)",
          opacity: fade,
          background: C.accent,
          color: C.white,
          padding: "12px 22px",
          borderRadius: 999,
          fontSize: 24,
          fontWeight: 600,
          whiteSpace: "nowrap",
          boxShadow: "0 16px 40px -12px rgba(34,88,229,0.6)",
        }}
      >
        {label}
      </div>
    </>
  );
};

export const Negotiation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const live = LINES.map((l) => offerAt(l, frame)).filter((n): n is number => n !== undefined);
  const best = live.length ? Math.min(...live) : 248;
  const progress = interpolate(best, [178, 248], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const head = spring({ frame, fps, config: { damping: 200 } });

  return (
    <Scene push={0.035}>
      <div style={{ position: "absolute", left: 160, top: 90, right: 160, display: "flex", alignItems: "flex-end", justifyContent: "space-between", opacity: head }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 28, color: C.subtle, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: 999, background: C.accent, opacity: 0.5 + 0.5 * Math.sin(frame / 4) }} />5 agents · shared memory
          </span>
          <span style={{ fontSize: 64, fontWeight: 600, letterSpacing: "-0.035em" }}>Negotiating</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, width: 560 }}>
          <span style={{ fontSize: 28, color: C.subtle }}>
            Best so far <span style={{ fontSize: 56, fontWeight: 600, color: frame >= 96 ? C.money : C.accent, fontVariantNumeric: "tabular-nums", marginLeft: 12 }}>{usd(best)}</span>
          </span>
          <div style={{ width: "100%", height: 12, borderRadius: 999, background: C.hair, overflow: "hidden" }}>
            <div style={{ width: `${progress * 100}%`, height: "100%", borderRadius: 999, background: frame >= 96 ? C.money : C.accent }} />
          </div>
        </div>
      </div>

      {LINES.map((l, i) => {
        const p = spring({ frame: frame - 4 - i * 4, fps, config: { damping: 15, stiffness: 160 } });
        const o = offerAt(l, frame);
        const agreed = l.agreed !== undefined && frame >= l.agreed;
        const ring = !o && l.channel === "phone" ? 0.5 + 0.5 * Math.sin(frame / 2.2) : 0;
        const bump = o ? spring({ frame: frame - l.offers.filter(([f]) => frame >= f).slice(-1)[0][0], fps, config: { damping: 9, stiffness: 220 } }) : 1;
        const { left, top } = pos(l);
        return (
          <div
            key={l.insurer}
            style={{
              ...card,
              position: "absolute",
              left,
              top,
              width: W,
              height: H,
              padding: "28px 32px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              opacity: p,
              transform: `translateY(${(1 - p) * 60}px) scale(${0.9 + 0.1 * p})`,
              boxShadow: agreed
                ? `0 0 0 3px ${C.money}, 0 30px 60px -30px rgba(41,134,70,0.5)`
                : `0 0 0 ${1.5 + ring * 2}px ${ring ? C.accent : l.current ? C.accent : C.line}, 0 30px 60px -30px rgba(19,22,27,0.18)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {l.channel === "phone" ? <PhoneIcon size={30} color={ring ? C.accent : C.subtle} /> : <MailIcon size={30} />}
              <span style={{ fontSize: 32, fontWeight: 600, flex: 1 }}>{l.insurer}</span>
              {l.current && <span style={{ fontSize: 20, color: C.subtle }}>current</span>}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontSize: 24, color: agreed ? C.money : C.subtle, fontWeight: agreed ? 600 : 400 }}>
                {agreed ? "Agreed" : o ? (l.channel === "email" ? "Replied" : "On the phone") : l.channel === "email" ? "Emailing…" : "Ringing…"}
              </span>
              {o !== undefined && (
                <span
                  style={{
                    fontSize: 52,
                    fontWeight: 600,
                    letterSpacing: "-0.03em",
                    fontVariantNumeric: "tabular-nums",
                    color: agreed ? C.money : o === best ? C.accent : C.ink,
                    transform: `scale(${0.85 + 0.15 * bump})`,
                    display: "inline-block",
                  }}
                >
                  {usd(o)}
                </span>
              )}
            </div>
          </div>
        );
      })}

      <Beam from={LINES[1]} to={LINES[0]} start={72} label="Bayline offered $205" />
      <Beam from={LINES[4]} to={LINES[2]} start={66} label="Redwood offered $213" />
      <Powered items={["Each agent runs on its own Fly.io Machine", "Calls · OpenAI GPT-Live", "Email · AgentMail", "Shared memory · Neon"]} delay={10} style={{ bottom: 60 }} />
    </Scene>
  );
};
