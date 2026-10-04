import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ease, K, sans, usd } from "../cx";

const POLICIES = [
  ["Northstar Mutual", "Auto", 248],
  ["Meridian Health", "Health", 642],
  ["Pawsure", "Pet", 22],
  ["Evergreen Term", "Life", 24],
  ["Hearthly", "Renters", 18],
] as const;

const Line: React.FC<{ from: number; to: number; children: React.ReactNode; size?: number }> = ({ from, to, children, size = 96 }) => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [from, from + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const b = interpolate(frame, [to - 8, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 330,
        textAlign: "center",
        fontSize: size,
        fontWeight: 600,
        letterSpacing: "-0.04em",
        color: K.text,
        opacity: a * (1 - b),
        transform: `translateY(${(1 - a) * 18 - b * 18}px)`,
        filter: `blur(${(1 - a) * 6 + b * 6}px)`,
      }}
    >
      {children}
    </div>
  );
};

export const Problem: React.FC<{ pages: number; covered: number; overpaying: number }> = ({ pages, covered, overpaying }) => {
  const frame = useCurrentFrame();
  const list = interpolate(frame, [pages - 6, pages + 6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const print = interpolate(frame, [pages - 2, pages + 12, covered - 6, covered + 2], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: K.canvas, fontFamily: sans }}>
      <Line from={0} to={pages - 2}>Five insurers.</Line>
      <Line from={pages} to={covered - 2}>Pages of fine print.</Line>
      <Line from={covered} to={overpaying - 2}>
        Are you <span style={{ color: K.blue }}>covered?</span>
      </Line>
      <Line from={overpaying} to={9999}>
        Are you <span style={{ color: K.blue }}>overpaying?</span>
      </Line>

      <div style={{ position: "absolute", left: 610, right: 610, top: 500, display: "flex", flexDirection: "column", opacity: list }}>
        {POLICIES.map(([name, kind, price], i) => {
          const p = interpolate(frame, [6 + i * 5, 18 + i * 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
          return (
            <div
              key={name}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 16,
                padding: "16px 4px",
                borderTop: i ? `1px solid ${K.line}` : "none",
                opacity: p,
                transform: `translateY(${(1 - p) * 12}px)`,
              }}
            >
              <span style={{ fontSize: 28, color: K.text, fontWeight: 500, flex: 1 }}>{name}</span>
              <span style={{ fontSize: 22, color: K.mute }}>{kind}</span>
              <span style={{ fontSize: 28, color: K.soft, width: 90, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(price)}</span>
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", left: 560, right: 560, top: 500, height: 330, overflow: "hidden", opacity: print }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, transform: `translateY(${-(frame - pages) * 3}px)` }}>
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} style={{ height: 7, borderRadius: 4, background: K.line, width: `${45 + ((i * 37) % 55)}%` }} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
