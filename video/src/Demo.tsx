import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile } from "remotion";
import { K } from "./cx";
import { AppShot } from "./scenes/AppShot";
import { End } from "./scenes/End";
import { Intro } from "./scenes/Intro";
import { Problem } from "./scenes/Problem";
import timing from "./timing.json";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const T = 12;
const VO_DELAY = 6;
const RATE = 1.1;
const t = (k: keyof typeof timing) => f(timing[k] / RATE) + VO_DELAY;

const cutIntro = t("meet") - 6;
const cutApp = t("reads") - 8;
const cutEnd = t("brand") - 6;
const wallAt = t("voEnd") - cutEnd + 12;
export const DURATION = t("voEnd") + f(3.4);

const beats = {
  read: 8,
  market: t("market") - cutApp,
  life: t("life") - cutApp,
  notices: t("notices") - cutApp,
  overpay: t("overpay") - cutApp,
  swarm: t("swarm") - cutApp,
  deal: t("deal") - cutApp,
  end: cutEnd - cutApp + T,
};

const SFX: { at: number; src: string; volume: number }[] = [
  { at: cutIntro - 4, src: "whoosh.mp3", volume: 0.22 },
  { at: cutApp - 4, src: "whoosh.mp3", volume: 0.3 },
  { at: t("market") + 2, src: "ticks.mp3", volume: 0.18 },
  { at: t("swarm"), src: "ring.mp3", volume: 0.18 },
  { at: t("deal") + 2, src: "chime.mp3", volume: 0.4 },
  { at: cutEnd - 4, src: "whoosh.mp3", volume: 0.25 },
  { at: cutEnd + wallAt - 4, src: "whoosh.mp3", volume: 0.25 },
];

export const Demo: React.FC = () => (
  <AbsoluteFill style={{ background: K.canvas }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={cutIntro + T}>
        <Problem pages={t("pages")} covered={t("covered")} overpaying={t("overpaying")} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence durationInFrames={cutApp - cutIntro + T}>
        <Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence durationInFrames={cutEnd - cutApp + T}>
        <AppShot b={beats} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence durationInFrames={DURATION - cutEnd}>
        <End wallAt={wallAt} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Audio
      src={staticFile("music.mp3")}
      volume={(fr) => interpolate(fr, [0, 10, DURATION - 110, DURATION - 60, DURATION - 5], [0, 0.3, 0.3, 0.55, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />
    <Sequence from={VO_DELAY}>
      <Audio src={staticFile("vo.mp3")} volume={1} playbackRate={RATE} />
    </Sequence>
    {SFX.map((s, i) => (
      <Sequence key={i} from={s.at} durationInFrames={60}>
        <Audio src={staticFile(s.src)} volume={s.volume} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
