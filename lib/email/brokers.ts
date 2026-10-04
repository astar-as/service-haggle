import { AgentMailClient } from "agentmail";
import { parseOffer } from "../strategist";
import type { Policy } from "../types";
import { refTag } from "./thread";

// Mock insurance brokers with their own AgentMail inboxes, so email lines run agent to agent in
// the demo. Stateless: on each poll of an email line, the broker looks at its own inbox and
// answers when the newest message on that line's thread came from Lowball. It opens with a quote,
// concedes halfway toward its floor on each counter, accepts any ask at or above the floor,
// confirms in writing, and stays quiet once Lowball says it went elsewhere.

interface Broker {
  username: string;
  person: string;
  insurer: string;
  open: number; // share of the current premium
  floor: number;
}

export const MOCK_BROKERS: Broker[] = [
  {
    username: "goldengate-broker",
    person: "Dana Kim",
    insurer: "Golden Gate Mutual",
    open: 0.87,
    floor: 0.76,
  },
  {
    username: "redwood-broker",
    person: "Sam Ortiz",
    insurer: "Redwood Direct",
    open: 0.85,
    floor: 0.79,
  },
];

const address = (b: Broker) => `${b.username}@agentmail.to`;
export const brokerFor = (email: string) =>
  MOCK_BROKERS.find((b) => address(b) === email.toLowerCase());
export const isMockBroker = (email?: string) => !!email && !!brokerFor(email);

let client: AgentMailClient | null = null;
const mail = () => (client ??= new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY }));
const ensured = new Set<string>();

async function ensureInbox(b: Broker) {
  if (ensured.has(b.username)) return;
  await mail()
    .inboxes.create({
      username: b.username,
      displayName: `${b.person} · ${b.insurer}`,
      clientId: `${b.username}-v1`,
    })
    .catch(() => undefined);
  ensured.add(b.username);
}

export async function ensureBrokerInboxes() {
  await Promise.all(MOCK_BROKERS.map(ensureInbox));
}

type Msg = {
  messageId: string;
  from: string;
  subject?: string;
  text?: string;
  extractedText?: string;
  timestamp?: string | Date;
};
const usd = (n: number) => `$${Math.round(n)}`;
// Replies carry the quoted thread below; only the new part counts.
const fresh = (text: string) => text.split(/\n\s*On .+wrote:|\n>|\nFrom: /)[0];
// The broker's own last quote: the first "$NNN a month" in its newest message.
const quoted = (text: string) =>
  Number(fresh(text).match(/\$(\d{2,4})(?:\.\d{2})? a month/)?.[1]) || undefined;

const QUIET =
  /gone with another offer|leave it here|close this request|went with another|no longer need/i;
const CONFIRM_ASK =
  /confirm (this|these|the terms|in writing)|reply to confirm|written confirmation/i;

export async function brokerTick(callId: string, email: string, policy: Policy) {
  const b = brokerFor(email);
  if (!b || !process.env.AGENTMAIL_API_KEY) return;
  await ensureInbox(b);
  const inbox = address(b);
  const ref = refTag(callId);
  const res = (await mail().inboxes.messages.list(inbox, { limit: 30 })) as { messages?: Msg[] };
  const thread = (res.messages ?? [])
    .filter((m) => (m.subject ?? "").includes(ref))
    .sort((x, y) => new Date(x.timestamp ?? 0).getTime() - new Date(y.timestamp ?? 0).getTime());
  const last = thread.at(-1);
  if (!last || last.from.toLowerCase().includes(inbox)) return; // nothing new from Lowball
  if (Date.now() - new Date(last.timestamp ?? Date.now()).getTime() < 4000) return; // reply like a person, not instantly

  const full = (await mail().inboxes.messages.get(inbox, last.messageId)) as Msg;
  const theirs = fresh(full.extractedText ?? full.text ?? "");
  if (QUIET.test(theirs)) return;

  const premium = policy.monthlyPremium;
  const floor = Math.round(premium * b.floor);
  const quotes = thread.filter((m) => m.from.toLowerCase().includes(inbox));
  const lastQuote = quotes.length
    ? (quoted(
        await mail()
          .inboxes.messages.get(inbox, quotes.at(-1)!.messageId)
          .then((m) => (m as Msg).text ?? ""),
      ) ?? Math.round(premium * b.open))
    : undefined;
  const ask = parseOffer(theirs, premium);
  const sign = `\n\nBest,\n${b.person}\n${b.insurer} · Personal lines`;

  let text: string;
  if (lastQuote === undefined) {
    const open = Math.round(premium * b.open);
    text = `Hello,\n\nThanks for reaching out on behalf of Maya. For the same full coverage on the 2019 Civic (100/300/100 liability, $500 deductibles) we can offer ${usd(open)} a month, starting October 20.\n\nHappy to talk through it.${sign}`;
  } else if (CONFIRM_ASK.test(theirs) && ask === undefined) {
    text = `Hello,\n\nConfirmed in writing: ${usd(lastQuote)} a month for the same coverage, effective October 20. I'll send the paperwork for Maya to sign.${sign}`;
  } else if (ask !== undefined && ask >= floor) {
    text = `Hello,\n\nWe can do ${usd(ask)} a month for the same coverage. Consider that confirmed; I'll send the paperwork for Maya to sign.${sign}`;
  } else {
    const next = Math.max(floor, Math.round(lastQuote - (lastQuote - floor) * 0.5));
    text =
      next >= lastQuote
        ? `Hello,\n\nI've checked again and ${usd(lastQuote)} a month is the lowest we can go for this coverage.${sign}`
        : `Hello,\n\nI went back to underwriting. With her clean record and the lower mileage, we can come down to ${usd(next)} a month for the same coverage.${sign}`;
  }
  await mail().inboxes.messages.reply(inbox, last.messageId, { text, labels: ["broker-reply"] });
}
