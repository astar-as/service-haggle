import React from "react";
import { C, card, Counter, Powered, Rise, Scene } from "../theme";

const Row: React.FC<{ name: string; sub: string; price: string; gap?: string; live?: boolean; first?: boolean }> = ({ name, sub, price, gap, live, first }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "0 36px", height: gap ? 118 : 100, borderTop: first ? "none" : `1.5px solid ${C.hair}` }}>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 32, fontWeight: 600 }}>{name}</span>
      <span style={{ fontSize: 24, color: C.subtle }}>
        {sub.split("·")[0]}
        {sub.includes("·") && (
          <>
            {" · "}
            <span style={{ color: live ? C.accent : C.subtle, fontWeight: live ? 500 : 400 }}>{sub.split("·")[1].trim()}</span>
          </>
        )}
      </span>
    </div>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <span style={{ fontSize: 32, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{price}</span>
      {gap && <span style={{ fontSize: 24, fontWeight: 500, color: C.accent }}>{gap}</span>}
    </div>
  </div>
);

export const Dashboard: React.FC = () => (
  <Scene push={0.05}>
    <div style={{ position: "absolute", left: "50%", top: 90, width: 1120, marginLeft: -560, display: "flex", flexDirection: "column", gap: 44 }}>
      <Rise delay={0}>
        <div style={{ fontSize: 92, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1.08 }}>
          Maya pays <Counter from={0} to={954} start={0} duration={16} /> a month.
        </div>
      </Rise>
      <Rise delay={6}>
        <div style={{ fontSize: 92, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1.08, color: C.accent, marginTop: -36 }}>
          <Counter from={0} to={117} start={6} duration={16} /> of that is too much.
        </div>
      </Rise>
      <Rise delay={12}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0 8px", fontSize: 26, fontWeight: 600 }}>
            <span>Needs negotiating</span>
            <span style={{ color: C.accent }}>−$117/mo</span>
          </div>
          <div style={{ ...card, overflow: "hidden" }}>
            <Row first name="Northstar Mutual" sub="Auto · overpaying $70" price="$248" gap="−$70" live />
            <Row name="Meridian Health" sub="Health · waiting for Nov 1" price="$642" gap="−$47" />
          </div>
        </div>
      </Rise>
      <Rise delay={18}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: "0 8px", fontSize: 26, fontWeight: 600 }}>Fair</div>
          <div style={{ ...card, overflow: "hidden" }}>
            <Row first name="Evergreen Term" sub="Life" price="$24" />
            <Row name="Pawsure" sub="Pet · won $9 off in September" price="$22" />
          </div>
        </div>
      </Rise>
    </div>
    <Powered items={["Ask anything · assistant-ui"]} delay={20} style={{ left: "auto", right: 150 }} />
  </Scene>
);
