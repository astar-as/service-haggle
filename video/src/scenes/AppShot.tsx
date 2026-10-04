import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { ease, glide, In, K, Mark, mono, sans, Spinner, Status, Tick, typed, usd } from "../cx";

export interface Beats {
  read: number;
  market: number;
  life: number;
  notices: number;
  overpay: number;
  swarm: number;
  deal: number;
  end: number;
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const W = 1560;
const H = 880;
const SIDE = 300;

type Cam = [number, { rx: number; ry: number; z: number; tx: number; ty: number }];

function camera(frame: number, keys: Cam[]) {
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (frame >= keys[i][0] && frame <= keys[i + 1][0]) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  if (frame < keys[0][0]) return keys[0][1];
  if (frame > keys[keys.length - 1][0]) return keys[keys.length - 1][1];
  const t = glide((frame - a[0]) / Math.max(1, b[0] - a[0]));
  const mix = (k: "rx" | "ry" | "z" | "tx" | "ty") => a[1][k] + (b[1][k] - a[1][k]) * t;
  return { rx: mix("rx"), ry: mix("ry"), z: mix("z"), tx: mix("tx"), ty: mix("ty") };
}

const Lift: React.FC<{ at: number; z?: number; children: React.ReactNode; style?: React.CSSProperties; until?: number }> = ({ at, z = 90, children, style, until }) => {
  const frame = useCurrentFrame();
  const up = interpolate(frame, [at, at + 18], [0, 1], { ...clamp, easing: ease });
  const down = until ? interpolate(frame, [until, until + 14], [0, 1], { ...clamp, easing: ease }) : 0;
  const l = up * (1 - down);
  return (
    <div
      style={{
        transform: `translateZ(${l * z}px)`,
        boxShadow: `0 ${10 + l * 50}px ${30 + l * 70}px -20px rgba(0,0,0,${0.35 + l * 0.4})`,
        transformStyle: "preserve-3d",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Step: React.FC<{ at: number; done: number; title: React.ReactNode; meta?: string; children?: React.ReactNode }> = ({ at, done, title, meta, children }) => (
  <In at={at} y={8} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 19, color: K.text }}>
      <Status doneAt={done} size={17} />
      <span style={{ flex: 1 }}>{title}</span>
      {meta && <span style={{ fontSize: 15, color: K.mute, fontFamily: mono }}>{meta}</span>}
    </div>
    {children && <div style={{ marginLeft: 29 }}>{children}</div>}
  </In>
);

const COVER = [
  ["Bodily injury liability", "$100k / $300k", true],
  ["Property damage", "$100,000", true],
  ["Uninsured motorist", "$100k / $300k", true],
  ["Collision", "$500 deductible", true],
  ["Comprehensive", "$500 deductible", true],
  ["Rental car", "$40 / day", false],
] as const;

const RESULTS = [
  ["insurancejournal.com", "USAA seeks 6.9% California auto rate increase", true],
  ["covered.ca.gov", "Covered California announces 2027 premium rates", false],
  ["insurance.ca.gov", "Prop 103: mileage must factor into your rate", true],
  ["nerdwallet.com", "Average cost of car insurance in California, 2026", false],
  ["reuters.com", "Insurers expand discounts for remote workers", false],
] as const;

const AGENTS = [
  "Call · Northstar Mutual",
  "Call · Bayline Auto",
  "Call · Harbor & Pine",
  "Email · Golden Gate",
  "Email · Redwood Direct",
  "Exa · rate filings",
  "Exa · competitor prices",
  "Kernel · retention offer",
  "Coverage match",
  "Email · Pacific Crest",
  "Call · Sunwise",
  "Exa · AM Best ratings",
  "Kernel · quote form",
  "Deductible check",
];

const LINES = [
  { insurer: "Northstar Mutual", via: "Call · GPT-Live", offers: [[14, 219], [76, 185]] as [number, number][], final: 76 },
  { insurer: "Bayline Auto", via: "Call · GPT-Live", offers: [[28, 205]] as [number, number][] },
  { insurer: "Harbor & Pine", via: "Call · GPT-Live", offers: [[20, 242]] as [number, number][] },
  { insurer: "Golden Gate Mutual", via: "Email · AgentMail", offers: [[36, 226]] as [number, number][] },
  { insurer: "Redwood Direct", via: "Email · AgentMail", offers: [[46, 213]] as [number, number][] },
];

const Callouts: React.FC<{ b: Beats }> = ({ b }) => {
  const frame = useCurrentFrame();
  const items: [string, string, number, number][] = [
    ["AgentMail", "reads your inbox", 8, b.market - 30],
    ["Mastra", "agents parse your policy", 26, b.market - 6],
    ["Exa", "searches the market", b.market, b.life - 4],
    ["Neon", "remembers everything", b.life, b.overpay - 4],
    ["assistant-ui", "ask it why", b.overpay, b.swarm - 2],
    ["Fly.io", "one Machine per agent", b.swarm, b.deal - 4],
    ["OpenAI GPT-Live", "agents call insurers", b.swarm + 10, b.deal - 4],
    ["AgentMail", "agents email brokers", b.swarm + 18, b.deal - 4],
    ["Neon", "shared memory between agents", b.swarm + 30, b.deal - 4],
    ["Kernel", "browser agents", b.swarm + 42, b.deal - 4],
    ["AgentMail", "confirmation sent", b.deal + 6, b.end],
  ];
  const live = items.filter(([, , a, z]) => frame >= a - 2 && frame <= z + 12);
  return (
    <div style={{ position: "absolute", right: -190, top: 96, display: "flex", flexDirection: "column", gap: 14, transformStyle: "preserve-3d", alignItems: "flex-end" }}>
      {live.map(([name, role, a, z]) => {
        const inP = interpolate(frame, [a, a + 12], [0, 1], { ...clamp, easing: ease });
        const outP = interpolate(frame, [z, z + 10], [0, 1], { ...clamp, easing: ease });
        const p = inP * (1 - outP);
        return (
          <div
            key={name + a}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              padding: "16px 22px",
              borderRadius: 14,
              background: "rgba(30,30,30,0.92)",
              border: `1px solid ${K.line}`,
              boxShadow: "0 40px 80px -24px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.03)",
              transform: `translateZ(${120 + p * 160}px) translateX(${(1 - p) * 40}px)`,
              opacity: p,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 24, fontWeight: 600, color: K.text, letterSpacing: "-0.02em" }}>{name}</span>
            <span style={{ fontSize: 18, color: K.soft }}>{role}</span>
          </div>
        );
      })}
    </div>
  );
};

export const AppShot: React.FC<{ b: Beats }> = ({ b }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 26], [0, 1], { ...clamp, easing: ease });

  const cam = camera(frame, [
    [0, { rx: 22, ry: -34, z: -900, tx: 120, ty: 120 }],
    [26, { rx: 10, ry: -14, z: -60, tx: 40, ty: 20 }],
    [b.market - 10, { rx: 6, ry: -9, z: 180, tx: -120, ty: 60 }],
    [b.overpay - 10, { rx: 5, ry: -6, z: 200, tx: -120, ty: -40 }],
    [b.overpay + 8, { rx: 4, ry: 8, z: 260, tx: -140, ty: 0 }],
    [b.swarm + 6, { rx: 12, ry: 18, z: -80, tx: 60, ty: 10 }],
    [b.deal - 6, { rx: 9, ry: 12, z: -40, tx: 40, ty: 0 }],
    [b.deal + 14, { rx: 2, ry: -4, z: 240, tx: -140, ty: 40 }],
    [b.end, { rx: 0, ry: 0, z: 300, tx: -140, ty: 40 }],
  ]);

  const log = interpolate(frame, [b.swarm - 6, b.swarm + 6], [1, 0], clamp);
  const board = interpolate(frame, [b.swarm, b.swarm + 12], [0, 1], { ...clamp, easing: ease });
  const scrollLog = interpolate(frame, [b.market, b.market + 40, b.life + 10, b.overpay - 6, b.overpay + 8], [0, -210, -420, -520, -720], { ...clamp, easing: glide });
  const agentsShown = Math.max(0, Math.floor(interpolate(frame, [b.swarm, b.swarm + 30], [0, 26], clamp)));
  const sf = frame - b.swarm;
  const dealt = frame >= b.deal;

  return (
    <AbsoluteFill style={{ background: K.canvas, fontFamily: sans, perspective: 2400, perspectiveOrigin: "50% 40%" }}>
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(91,155,255,0.10), transparent 60%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: (1920 - W) / 2,
          top: (1080 - H) / 2,
          width: W,
          height: H,
          transformStyle: "preserve-3d",
          transform: `translate3d(${cam.tx}px, ${cam.ty}px, ${cam.z}px) rotateX(${cam.rx}deg) rotateY(${cam.ry}deg)`,
          opacity: enter,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 18,
            background: K.window,
            boxShadow: `0 0 0 1px ${K.line}, 0 80px 160px -40px rgba(0,0,0,0.85), 0 0 120px rgba(91,155,255,0.06)`,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ height: 46, display: "flex", alignItems: "center", gap: 9, padding: "0 18px", borderBottom: `1px solid ${K.line}`, background: K.sidebar }}>
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <span key={c} style={{ width: 12, height: 12, borderRadius: 99, background: c, opacity: 0.85 }} />
            ))}
            <span style={{ flex: 1, textAlign: "center", fontSize: 15, color: K.mute, marginRight: 60 }}>Service Haggle — Maya Okafor</span>
          </div>
          <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
            <div style={{ width: SIDE, background: K.sidebar, borderRight: `1px solid ${K.line}`, padding: "18px 14px", display: "flex", flexDirection: "column", gap: 18, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 8px" }}>
                <Mark size={20} />
                <span style={{ fontSize: 19, fontWeight: 600, color: K.text, letterSpacing: "-0.02em" }}>Service Haggle</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: K.raised, color: K.text, fontSize: 16 }}>
                <span style={{ fontSize: 18, color: K.soft }}>+</span> New negotiation
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, color: K.mute, padding: "0 10px 6px", letterSpacing: "0.04em" }}>POLICIES</span>
                {[
                  ["Northstar Mutual", 248, true],
                  ["Meridian Health", 642, false],
                  ["Pawsure", 22, false],
                  ["Evergreen Term", 24, false],
                  ["Hearthly", 18, false],
                ].map(([n, p, sel]) => (
                  <div key={n as string} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, background: sel ? K.raised : "transparent", fontSize: 16, color: sel ? K.text : K.soft }}>
                    <span style={{ flex: 1 }}>{n as string}</span>
                    {sel && dealt ? (
                      <span style={{ color: K.green, fontVariantNumeric: "tabular-nums" }}>$185</span>
                    ) : (
                      <span style={{ color: K.mute, fontVariantNumeric: "tabular-nums" }}>{usd(p as number)}</span>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, opacity: interpolate(frame, [b.swarm - 4, b.swarm + 8], [0, 1], clamp) }}>
                <span style={{ fontSize: 13, color: K.mute, padding: "0 10px 6px", letterSpacing: "0.04em", display: "flex", justifyContent: "space-between" }}>
                  AGENTS <span style={{ color: dealt ? K.green : K.blue, fontFamily: mono }}>{agentsShown} {dealt ? "done" : "running"}</span>
                </span>
                {AGENTS.map((a, i) => {
                  const show = interpolate(sf, [i * 2, i * 2 + 8], [0, 1], { ...clamp, easing: ease });
                  const secs = Math.max(0, Math.floor((sf - i * 2) / 30) + Math.floor(random(`t${i}`) * 40));
                  return (
                    <div key={a} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", fontSize: 15, color: K.soft, opacity: show, transform: `translateX(${(1 - show) * -16}px)` }}>
                      {dealt ? <Tick size={14} /> : <Spinner size={14} color={K.blue} />}
                      <span style={{ flex: 1, whiteSpace: "nowrap" }}>{a}</span>
                      <span style={{ fontFamily: mono, fontSize: 13, color: K.mute }}>0:{String(secs).padStart(2, "0")}</span>
                    </div>
                  );
                })}
                <span style={{ fontSize: 14, color: K.mute, padding: "6px 10px", opacity: interpolate(sf, [28, 34], [0, 1], clamp) }}>+ 12 more on Fly.io</span>
              </div>
            </div>

            <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", minWidth: 0, transformStyle: "preserve-3d" }}>
              <div style={{ height: 64, display: "flex", alignItems: "center", gap: 14, padding: "0 36px", borderBottom: `1px solid ${K.hair}` }}>
                <span style={{ fontSize: 19, color: K.text, fontWeight: 500 }}>Northstar Mutual</span>
                <span style={{ fontSize: 16, color: K.mute }}>Auto renewal · $248/mo</span>
                <span style={{ marginLeft: "auto", fontSize: 14, fontFamily: mono, color: K.soft, padding: "6px 10px", borderRadius: 8, background: K.raised }}>
                  {frame < b.swarm ? "watching" : dealt ? "agreed $185" : `negotiating · ${agentsShown} agents`}
                </span>
              </div>

              <div style={{ flex: 1, position: "relative", overflow: "hidden", transformStyle: "preserve-3d" }}>
                <div style={{ position: "absolute", left: 0, right: 0, top: 0, opacity: log, transformStyle: "preserve-3d" }}>
                  <div style={{ width: 860, margin: "0 auto", padding: "34px 0", display: "flex", flexDirection: "column", gap: 26, transform: `translateY(${scrollLog}px)`, transformStyle: "preserve-3d" }}>
                    <In at={2} style={{ alignSelf: "flex-end", maxWidth: 600, padding: "14px 18px", borderRadius: 16, background: K.raised, fontSize: 19, color: K.text, lineHeight: 1.45 }}>
                      Keep my insurance fair. Negotiate when it makes sense, I only sign.
                    </In>
                    <Step at={8} done={20} title="Read your renewal notice" meta="AgentMail" />
                    <Step at={16} done={30} title="Extracted coverage from the declarations page" meta="Mastra">
                      <Lift at={34} until={b.market - 14} z={110}>
                        <div style={{ borderRadius: 14, background: K.raised, border: `1px solid ${K.line}`, overflow: "hidden" }}>
                          {COVER.map(([l, v, must], i) => (
                            <In key={l} at={30 + i * 3} y={6} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderTop: i ? `1px solid ${K.line}` : "none", fontSize: 17 }}>
                              <span style={{ color: K.text, flex: 1 }}>{l}</span>
                              {must && <span style={{ fontSize: 12, fontFamily: mono, color: K.blue, padding: "3px 8px", borderRadius: 6, background: "rgba(91,155,255,0.12)" }}>must keep</span>}
                              <span style={{ color: K.soft, fontVariantNumeric: "tabular-nums", width: 180, textAlign: "right" }}>{v}</span>
                            </In>
                          ))}
                        </div>
                      </Lift>
                    </Step>
                    <Step at={b.market - 4} done={b.market + 30} title="Searched the web" meta="Exa">
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <span style={{ fontFamily: mono, fontSize: 15, color: K.soft }}>
                          “{typed("california auto insurance rate changes 2026", frame, b.market, 3)}”
                          <span style={{ color: K.mute }}>{frame > b.market + 18 ? "  · 48 sources" : ""}</span>
                        </span>
                        {RESULTS.map(([d, t, hit], i) => (
                          <In key={d} at={b.market + 12 + i * 3} y={6} style={{ display: "flex", alignItems: "baseline", gap: 12, fontSize: 16 }}>
                            <span style={{ fontFamily: mono, fontSize: 13, color: hit ? K.blue : K.mute, width: 190 }}>{d}</span>
                            <span style={{ color: hit ? K.text : K.soft }}>{t}</span>
                          </In>
                        ))}
                      </div>
                    </Step>
                    <Step at={b.life - 6} done={b.life + 16} title="Read 90 days of bank transactions" meta="private">
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <In at={b.life + 18} y={6}>
                          <Lift at={b.life + 20} until={b.overpay - 10} z={80}>
                            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 12, background: K.raised, border: `1px solid ${K.line}`, fontSize: 18 }}>
                              <span style={{ fontFamily: mono, color: K.blue, fontSize: 22, width: 76 }}>−60%</span>
                              <span style={{ color: K.text, flex: 1 }}>Driving far less since Aug 10</span>
                              <span style={{ color: K.mute, fontSize: 15 }}>low-mileage discount</span>
                            </div>
                          </Lift>
                        </In>
                        <In at={b.life + 34} y={6}>
                          <Lift at={b.life + 36} until={b.overpay - 10} z={80}>
                            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 12, background: K.raised, border: `1px solid ${K.line}`, fontSize: 18 }}>
                              <span style={{ fontFamily: mono, color: K.green, fontSize: 22, width: 76 }}>+18%</span>
                              <span style={{ color: K.text, flex: 1 }}>Paycheck went up</span>
                              <span style={{ color: K.mute, fontSize: 15 }}>kept private</span>
                            </div>
                          </Lift>
                        </In>
                      </div>
                    </Step>
                    <In at={b.overpay - 4} y={10}>
                      <Lift at={b.overpay} z={150}>
                        <div style={{ padding: "26px 28px", borderRadius: 16, background: K.raised, border: `1px solid ${K.line}` }}>
                          <div style={{ fontSize: 15, color: K.mute, fontFamily: mono, marginBottom: 10 }}>VERDICT</div>
                          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.03em", color: K.text }}>
                            Overpaying <span style={{ color: K.blue }}>$70</span> a month.
                          </div>
                          <div style={{ fontSize: 19, color: K.soft, marginTop: 8 }}>Fair price is $178. Across five policies Maya overpays $117 a month.</div>
                        </div>
                      </Lift>
                    </In>
                  </div>
                </div>

                <div style={{ position: "absolute", left: 0, right: 0, top: 0, opacity: board, transformStyle: "preserve-3d" }}>
                  <div style={{ width: 900, margin: "0 auto", padding: "30px 0", display: "flex", flexDirection: "column", gap: 18, transformStyle: "preserve-3d" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 22, color: K.text, fontWeight: 500 }}>Negotiating with 5 insurers</span>
                      <span style={{ fontSize: 15, color: K.mute, fontFamily: mono }}>each agent on its own Fly.io Machine</span>
                    </div>
                    <Lift at={b.swarm + 4} until={b.deal - 8} z={70}>
                      <div style={{ borderRadius: 14, background: K.raised, border: `1px solid ${K.line}`, overflow: "hidden" }}>
                        {LINES.map((l, i) => {
                          const cur = l.offers.filter(([f]) => sf >= f).slice(-1)[0];
                          const agreed = l.final !== undefined && sf >= l.final;
                          const flash = cur ? interpolate(sf - cur[0], [0, 4, 16], [0, 1, 0], clamp) : 0;
                          return (
                            <In key={l.insurer} at={b.swarm + 4 + i * 3} y={6} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderTop: i ? `1px solid ${K.line}` : "none", background: `rgba(91,155,255,${flash * 0.12})` }}>
                              {agreed ? <Tick size={17} /> : <Spinner size={17} color={K.blue} />}
                              <span style={{ fontSize: 18, color: K.text, flex: 1 }}>{l.insurer}</span>
                              <span style={{ fontSize: 14, fontFamily: mono, color: K.mute, width: 200 }}>{l.via}</span>
                              <span style={{ fontSize: 22, fontVariantNumeric: "tabular-nums", width: 90, textAlign: "right", color: agreed ? K.green : cur ? K.text : K.mute }}>{cur ? usd(cur[1]) : "…"}</span>
                            </In>
                          );
                        })}
                      </div>
                    </Lift>
                    <In at={b.swarm + 34} y={6} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 17, color: K.soft }}>
                      <span style={{ width: 8, height: 8, borderRadius: 9, background: K.blue }} />
                      Bayline offered $205. Shared with every agent through Neon.
                    </In>
                    <In at={b.swarm + 56} y={6} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 17, color: K.soft }}>
                      <span style={{ width: 8, height: 8, borderRadius: 9, background: K.blue }} />
                      “Bayline is at $205 for the same cover. Can you beat it?”
                      <span style={{ fontFamily: mono, fontSize: 14, color: K.mute }}>GPT-Live</span>
                    </In>
                    <In at={b.deal - 2} y={14}>
                      <Lift at={b.deal} z={190}>
                        <div style={{ padding: "26px 30px", borderRadius: 16, background: "#14261D", border: `1px solid rgba(63,207,142,0.35)` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 17, color: K.green, fontWeight: 500 }}>
                            <Tick size={18} /> Agreed with Northstar Mutual · same coverage
                          </div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 22, marginTop: 10 }}>
                            <span style={{ fontSize: 34, color: K.mute, textDecoration: "line-through", fontVariantNumeric: "tabular-nums" }}>$248</span>
                            <span style={{ fontSize: 64, fontWeight: 600, color: K.text, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>$185</span>
                            <span style={{ fontSize: 22, color: K.soft }}>a month</span>
                            <span style={{ marginLeft: "auto", fontSize: 30, fontWeight: 600, color: K.green, fontVariantNumeric: "tabular-nums" }}>
                              +{usd(Math.round(interpolate(frame, [b.deal + 6, b.deal + 30], [0, 756], { ...clamp, easing: ease })))}/yr
                            </span>
                          </div>
                          <div style={{ fontSize: 15, color: K.mute, marginTop: 10, fontFamily: mono }}>confirmation sent via AgentMail · you sign, the agent never does</div>
                        </div>
                      </Lift>
                    </In>
                  </div>
                </div>
              </div>

              <div style={{ padding: "0 36px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 14, background: K.raised, border: `1px solid ${K.line}`, fontSize: 17, color: K.mute }}>
                  <span style={{ flex: 1 }}>Ask Service Haggle anything…</span>
                  <span style={{ fontFamily: mono, fontSize: 13 }}>assistant-ui</span>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: K.text, display: "grid", placeItems: "center", color: K.canvas, fontSize: 16 }}>↑</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Callouts b={b} />
      </div>
    </AbsoluteFill>
  );
};
