import { createHash, randomBytes } from "node:crypto";
import { AgentMailClient } from "agentmail";
import { keepAlive } from "./background";
import { makePdf, pdfText } from "./pdf";
import { policyDocument } from "./policy-doc";
import { store } from "./store";
import type { Deal, DealCheck, DealMail, Person, Policy } from "./types";

// Closing a negotiated deal over AgentMail, end to end, in one email thread:
//   1 confirm   Maya's inbox -> insurer policy desk: confirm the agreed terms in writing
//   2 request   desk replies: to bind we need date of birth, licence number, VIN
//   3 release   agent drafts the reply with the sealed values filled in at the mail layer;
//               the draft waits in AgentMail until Maya approves it (human in the loop)
//   4 contract  desk sends the policy contract as a PDF; the agent downloads and checks it
//               against the deal and asks for a corrected version if a term is off
//   5 sign      Maya signs; the agent replies with a signed receipt PDF (SHA-256 of the contract)
//   6 bound     desk confirms the policy number; the policy and stance update
// No model sees sealed values: this flow is plain code, and the voice and email negotiators
// only ever get shareable facts.
// The policy desk is a mock insurer back office with its own real AgentMail inbox.

let client: AgentMailClient | null = null;
const mail = () => {
  if (!process.env.AGENTMAIL_API_KEY) throw new Error("AGENTMAIL_API_KEY is not set");
  client ??= new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
  return client;
};
export const hasDealMail = () => !!process.env.AGENTMAIL_API_KEY;

const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const usd = (n: number) => `$${n.toFixed(2)}`;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
// Lower-case a label for prose, but keep acronyms like VIN.
const lower = (s: string) => (s === s.toUpperCase() ? s : s.toLowerCase());
const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

// ---- sealed facts -----------------------------------------------------------------------

const SEALED = [
  { label: "Date of birth", owner: "person" as const, match: /birth|\bdob\b/i },
  { label: "Driver's licence", owner: "person" as const, match: /licen[cs]e/i },
  { label: "VIN", owner: "policy" as const, match: /\bvin\b|vehicle identification/i },
  { label: "Home address", owner: "person" as const, match: /\baddress\b/i },
];

const sealedValue = (label: string, owner: "person" | "policy", person: Person, policy: Policy) =>
  (owner === "person" ? person.facts : policy.facts).find(
    (f) => f.label === label && f.disclosure === "hidden",
  )?.value;

export const mask = (v: string) =>
  v.length <= 4
    ? "••••"
    : `${v.slice(0, 2)}${"•".repeat(Math.min(10, v.length - 4))}${v.slice(-2)}`;

// ---- inboxes ------------------------------------------------------------------------------

async function mayaInbox(person: Person) {
  return process.env.AGENTMAIL_INBOX ?? person.inbox;
}

async function deskInbox(insurer: string) {
  const username = `${slug(insurer).split("-")[0]}-desk`;
  try {
    const r = await mail().inboxes.create({
      username,
      displayName: `${insurer} Policy Desk`,
      clientId: `${username}-v1`,
    });
    return (r as { inboxId: string }).inboxId;
  } catch {
    return `${username}@agentmail.to`;
  }
}

type Msg = {
  messageId: string;
  from: string;
  subject?: string;
  text?: string;
  extractedText?: string;
  attachments?: { attachmentId: string; filename?: string }[];
};

// Wait for the next message in `inbox` on this deal's thread that `inbox` didn't send.
// messages.list is newest first, so the oldest unseen match is the last one.
async function waitFor(
  inbox: string,
  ref: string,
  seen: Set<string>,
  timeoutMs = 60000,
): Promise<Msg> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const res = (await mail().inboxes.messages.list(inbox, { limit: 30 })) as { messages?: Msg[] };
    const hit = (res.messages ?? [])
      .filter(
        (m) =>
          (m.subject ?? "").includes(ref) &&
          !m.from.toLowerCase().includes(inbox.toLowerCase()) &&
          !seen.has(m.messageId),
      )
      .at(-1);
    if (hit) {
      seen.add(hit.messageId);
      return (await mail().inboxes.messages.get(inbox, hit.messageId)) as Msg;
    }
    await sleep(2000);
  }
  throw new Error(`No reply in ${inbox} for ${ref} after ${timeoutMs / 1000}s`);
}

const bodyOf = (m: Msg) => m.extractedText ?? m.text ?? "";

async function update(deal: Deal, patch: Partial<Deal>, mailEntry?: DealMail) {
  const fresh = (await store.deal(deal.id)) ?? deal;
  Object.assign(deal, fresh, patch);
  if (mailEntry) deal.mails = [...fresh.mails, mailEntry];
  await store.putDeal(deal);
}

// ---- start --------------------------------------------------------------------------------

export async function startDeal(input: {
  policyId: string;
  monthly: number;
  insurer?: string;
  callId?: string;
  autopilot?: boolean;
}) {
  const [policy, person] = await Promise.all([store.policy(input.policyId), store.person()]);
  if (!policy) throw new Error(`Unknown policy ${input.policyId}`);
  const insurer = input.insurer ?? policy.insurer;
  const [inbox, desk] = await Promise.all([mayaInbox(person), deskInbox(insurer)]);
  const id = `deal-${Date.now().toString(36)}`;
  const ref = `D-${randomBytes(3).toString("hex").toUpperCase()}`;
  const deal: Deal = {
    id,
    ref,
    policyId: policy.id,
    callId: input.callId,
    insurer,
    monthly: input.monthly,
    previousMonthly: policy.monthlyPremium,
    status: "confirming",
    inbox,
    desk,
    requested: [],
    mails: [],
    autopilot: !!input.autopilot,
    createdAt: now(),
    updatedAt: now(),
  };
  await store.putDeal(deal);
  keepAlive(run(deal, () => confirmStep(deal, policy, person)));
  return deal;
}

async function run(deal: Deal, step: () => Promise<void>) {
  try {
    await step();
  } catch (e) {
    console.error(`[deal ${deal.id}]`, e);
    await update(deal, { status: "failed", note: e instanceof Error ? e.message : String(e) });
  }
}

const subjectFor = (deal: Deal, policy: Policy, person: Person) =>
  `Binding ${deal.insurer} ${policy.kind} policy at ${usd(deal.monthly)}/mo for ${person.name} [${deal.ref}]`;

async function confirmStep(deal: Deal, policy: Policy, person: Person) {
  const subject = subjectFor(deal, policy, person);
  const facts = (label: string) => policy.facts.find((f) => f.label === label)?.value;
  const text = [
    "Hello,",
    "",
    `I'm the AI assistant for ${person.name}. Following our conversation, please confirm these terms in writing so we can bind the policy:`,
    "",
    `Policy: ${policy.product}`,
    `Monthly premium: ${usd(deal.monthly)} (currently ${usd(policy.monthlyPremium)})`,
    `Liability limits: ${facts("Liability limits") ?? "unchanged"}`,
    `Collision deductible: ${facts("Deductible") ?? "unchanged"}`,
    `Effective: at renewal on ${policy.renewsOn}`,
    "",
    `${person.firstName} will review and sign the contract herself. I can't sign or pay on her behalf.`,
    "",
    `Thanks,\n${person.firstName}'s assistant`,
  ].join("\n");
  const sent = (await mail().inboxes.messages.send(deal.inbox, {
    to: [deal.desk],
    subject,
    text,
    labels: ["deal", "confirmation"],
  })) as { messageId?: string };
  await update(
    deal,
    {},
    {
      at: now(),
      direction: "out",
      from: deal.inbox,
      to: deal.desk,
      subject,
      summary: `Asked ${deal.insurer} to confirm ${usd(deal.monthly)}/mo in writing.`,
      labels: ["deal", "confirmation"],
      messageId: sent.messageId,
    },
  );

  // Insurer side answers, then the agent reads the request and drafts the release.
  await deskAnswer(deal, "request");
  const reply = await waitFor(
    deal.inbox,
    deal.ref,
    new Set(deal.mails.map((m) => m.messageId!).filter(Boolean)),
  );
  const asked = SEALED.filter((s) => s.match.test(bodyOf(reply)));
  await update(
    deal,
    {},
    {
      at: now(),
      direction: "in",
      from: deal.desk,
      to: deal.inbox,
      subject: reply.subject ?? "",
      summary: `Confirmed ${usd(deal.monthly)}/mo. Needs ${asked.map((s) => lower(s.label)).join(", ")} to bind.`,
      labels: ["binding-request"],
      messageId: reply.messageId,
    },
  );

  const values = asked
    .map((s) => ({ ...s, value: sealedValue(s.label, s.owner, person, policy) }))
    .filter((s): s is typeof s & { value: string } => !!s.value);
  const draftText = [
    "Hello,",
    "",
    `Thank you for confirming. Here are the details you asked for, released with ${person.firstName}'s approval for binding only:`,
    "",
    `Named insured: ${person.name}`,
    ...values.map((v) => `${v.label}: ${v.value}`),
    "",
    "Please send the policy contract for her signature.",
    "",
    `Thanks,\n${person.firstName}'s assistant`,
  ].join("\n");
  const draft = (await mail().inboxes.drafts.create(deal.inbox, {
    to: [deal.desk],
    subject: `Re: ${reply.subject ?? subjectFor(deal, policy, person)}`,
    text: draftText,
    inReplyTo: reply.messageId,
    labels: ["sensitive", "needs-approval"],
  })) as { draftId: string };
  await update(
    deal,
    {
      status: "awaiting_release",
      draftId: draft.draftId,
      requested: values.map((v) => ({ label: v.label, masked: mask(v.value), owner: v.owner })),
    },
    {
      at: now(),
      direction: "draft",
      from: deal.inbox,
      to: deal.desk,
      subject: `Re: ${reply.subject ?? ""}`,
      summary: deal.autopilot
        ? `Drafted the reply with ${values.length} sealed facts. Releasing under ${person.firstName}'s standing approval.`
        : `Drafted the reply with ${values.length} sealed facts. Waiting for ${person.firstName} to approve.`,
      labels: ["sensitive", "needs-approval"],
    },
  );
  if (deal.autopilot) {
    await update(deal, { status: "releasing", releasedAt: now() });
    await releaseStep(deal);
  }
}

// ---- release ------------------------------------------------------------------------------

export async function releaseDeal(id: string) {
  const deal = await store.deal(id);
  if (!deal?.draftId || deal.status !== "awaiting_release") throw new Error("Nothing to release");
  await update(deal, { status: "releasing", releasedAt: now() });
  keepAlive(run(deal, () => releaseStep(deal)));
  return deal;
}

// A fresh draft can take a few seconds before AgentMail will send it; retry on 404.
async function sendDraft(inbox: string, draftId: string) {
  for (let i = 0; ; i++) {
    try {
      return (await mail().inboxes.drafts.send(inbox, draftId, { addLabels: ["released"] })) as {
        messageId?: string;
      };
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode !== 404 || i >= 10) throw e;
      await sleep(2000);
    }
  }
}

async function releaseStep(deal: Deal) {
  const sent = await sendDraft(deal.inbox, deal.draftId!);
  await update(
    deal,
    {},
    {
      at: now(),
      direction: "out",
      from: deal.inbox,
      to: deal.desk,
      subject: `Re: [${deal.ref}]`,
      summary: `Sent ${deal.requested.map((r) => lower(r.label)).join(", ")} ${deal.autopilot ? "under Maya's standing approval" : "after Maya approved the draft"}.`,
      labels: ["sensitive", "released"],
      messageId: sent.messageId,
    },
  );
  await receiveContract(deal, 1);
}

async function receiveContract(deal: Deal, version: number) {
  await deskAnswer(deal, version === 1 ? "contract" : "corrected");
  const policy = (await store.policy(deal.policyId))!;
  const msg = await waitFor(
    deal.inbox,
    deal.ref,
    new Set(deal.mails.map((m) => m.messageId!).filter(Boolean)),
  );
  const att = msg.attachments?.find((a) => (a.filename ?? "").toLowerCase().endsWith(".pdf"));
  if (!att) throw new Error("Contract email had no PDF attached");
  const meta = (await mail().inboxes.messages.getAttachment(
    deal.inbox,
    msg.messageId,
    att.attachmentId,
  )) as { downloadUrl: string };
  const pdf = Buffer.from(await (await fetch(meta.downloadUrl)).arrayBuffer());
  const text = pdfText(pdf);
  const checks = checkContract(text, deal, policy);
  const ok = checks.every((c) => c.ok);
  await update(
    deal,
    {
      contract: { filename: att.filename ?? "contract.pdf", sha256: sha256(pdf), version, checks },
      contractPdf: pdf.toString("base64"),
    },
    {
      at: now(),
      direction: "in",
      from: deal.desk,
      to: deal.inbox,
      subject: msg.subject ?? "",
      summary: ok
        ? `Contract v${version} matches the deal on every term.`
        : `Contract v${version}: ${checks
            .filter((c) => !c.ok)
            .map((c) => `${c.label.toLowerCase()} says ${c.found}, agreed ${c.expected}`)
            .join("; ")}.`,
      labels: ["contract"],
      attachment: att.filename,
      messageId: msg.messageId,
    },
  );
  await mail()
    .inboxes.messages.update(deal.inbox, msg.messageId, {
      addLabels: [ok ? "contract-verified" : "contract-mismatch"],
    })
    .catch(() => {});

  if (ok && deal.autopilot) {
    const person = await store.person();
    await update(deal, {
      status: "signing",
      signature: { name: person.name, at: now(), mode: "autopilot" },
    });
    return signStep(deal);
  }
  if (ok) return update(deal, { status: "awaiting_signature" });
  if (version >= 2)
    return update(deal, {
      status: "failed",
      note: "The corrected contract still doesn't match the agreed terms.",
    });
  const bad = checks.filter((c) => !c.ok);
  const text2 = [
    "Hello,",
    "",
    "Thanks for the contract. Before Maya signs, it needs a correction:",
    "",
    ...bad.map((c) => `- ${c.label}: the contract says ${c.found}, but we agreed ${c.expected}.`),
    "",
    "Please send a corrected version.",
    "",
    "Thanks,\nMaya's assistant",
  ].join("\n");
  const r = (await mail().inboxes.messages.reply(deal.inbox, msg.messageId, {
    text: text2,
    labels: ["correction"],
  })) as { messageId?: string };
  await update(
    deal,
    {},
    {
      at: now(),
      direction: "out",
      from: deal.inbox,
      to: deal.desk,
      subject: `Re: ${msg.subject ?? ""}`,
      summary: `Caught the mismatch and asked for a corrected contract.`,
      labels: ["correction"],
      messageId: r.messageId,
    },
  );
  return receiveContract(deal, version + 1);
}

function checkContract(text: string, deal: Deal, policy: Policy): DealCheck[] {
  const field = (label: string) =>
    text.match(new RegExp(`^${label}:\\s*(.+)$`, "im"))?.[1]?.trim() ?? "missing";
  const fact = (label: string) => policy.facts.find((f) => f.label === label)?.value ?? "";
  const money = (s: string) => Number(s.replace(/[^0-9.]/g, ""));
  const premium = field("Monthly premium");
  const checks: DealCheck[] = [
    {
      label: "Monthly premium",
      expected: usd(deal.monthly),
      found: premium,
      ok: Math.abs(money(premium) - deal.monthly) < 0.01,
    },
    {
      label: "Named insured",
      expected: "Maya Okafor",
      found: field("Named insured"),
      ok: field("Named insured") === "Maya Okafor",
    },
  ];
  if (fact("Liability limits"))
    checks.push({
      label: "Liability limits",
      expected: fact("Liability limits"),
      found: field("Liability limits"),
      ok: field("Liability limits") === fact("Liability limits"),
    });
  if (fact("Deductible")) {
    const found = field("Collision deductible");
    checks.push({
      label: "Collision deductible",
      expected: fact("Deductible"),
      found,
      ok: money(found) === money(fact("Deductible")),
    });
  }
  return checks;
}

// ---- sign ---------------------------------------------------------------------------------

export async function signDeal(id: string, name: string) {
  const deal = await store.deal(id);
  if (!deal || deal.status !== "awaiting_signature") throw new Error("Nothing to sign");
  const person = await store.person();
  if (name.trim().toLowerCase() !== person.name.toLowerCase())
    throw new Error(`Type ${person.name} to sign`);
  await update(deal, {
    status: "signing",
    signature: { name: person.name, at: now(), mode: "typed" },
  });
  keepAlive(run(deal, () => signStep(deal)));
  return deal;
}

async function signStep(deal: Deal) {
  const [policy, person] = await Promise.all([store.policy(deal.policyId), store.person()]);
  if (!policy) throw new Error("Policy is gone");
  const receiptId = `R-${randomBytes(4).toString("hex").toUpperCase()}`;
  const lines = [
    `Receipt ${receiptId} - deal ${deal.ref}`,
    "",
    `Insurer: ${deal.insurer}`,
    `Policy: ${policy.product}`,
    `Monthly premium: ${usd(deal.monthly)} (was ${usd(deal.previousMonthly)}, saves ${usd((deal.previousMonthly - deal.monthly) * 12)} a year)`,
    `Contract: ${deal.contract?.filename} (version ${deal.contract?.version})`,
    `Contract SHA-256: ${deal.contract?.sha256.slice(0, 32)}`,
    `                  ${deal.contract?.sha256.slice(32)}`,
    `Checks: ${deal.contract?.checks.map((c) => `${c.label} OK`).join(", ")}`,
    "",
    `Signed electronically by ${deal.signature!.name}`,
    `Signed at: ${deal.signature!.at}`,
    ...(deal.signature!.mode === "autopilot"
      ? [
          "Signed under a standing authorization the signer set for this deal: sign when",
          "every term matches the agreed deal. Her assistant verified each term first.",
        ]
      : [
          "The signer reviewed the contract above and intends to sign it. Her assistant",
          "prepared and verified the documents but did not sign or pay on her behalf.",
        ]),
    "",
    `Sealed facts released for binding: ${deal.requested.map((r) => r.label).join(", ")} (approved ${deal.releasedAt})`,
  ];
  const pdf = makePdf(`${deal.insurer} - signed policy receipt`, lines);
  const filename = `Signed-receipt-${receiptId}.pdf`;
  const last = deal.mails.filter((m) => m.direction === "in" && m.messageId).at(-1)!;
  const cc = process.env.DEAL_CC ? [process.env.DEAL_CC] : undefined;
  const r = (await mail().inboxes.messages.reply(deal.inbox, last.messageId!, {
    text: `Hello,\n\n${person.name} has signed the contract. The signed receipt is attached (receipt ${receiptId}, contract SHA-256 ${deal.contract?.sha256.slice(0, 12)}…).\n\nPlease bind the policy and send the policy number.\n\nThanks,\n${person.firstName}'s assistant`,
    cc,
    attachments: [{ filename, contentType: "application/pdf", content: pdf.toString("base64") }],
    labels: ["signed", "receipt"],
  })) as { messageId?: string };
  await update(
    deal,
    {
      receipt: { id: receiptId, sha256: sha256(pdf), filename },
      receiptPdf: pdf.toString("base64"),
    },
    {
      at: now(),
      direction: "out",
      from: deal.inbox,
      to: cc ? `${deal.desk}, cc ${cc[0]}` : deal.desk,
      subject: `Re: [${deal.ref}]`,
      summary: `Sent the signed receipt ${receiptId}.`,
      labels: ["signed", "receipt"],
      attachment: filename,
      messageId: r.messageId,
    },
  );

  await deskAnswer(deal, "bound");
  const bound = await waitFor(
    deal.inbox,
    deal.ref,
    new Set(deal.mails.map((m) => m.messageId!).filter(Boolean)),
  );
  const policyNumber = bodyOf(bound).match(/Policy number:\s*([A-Z0-9-]+)/i)?.[1];
  const decAtt = bound.attachments?.find((a) => (a.filename ?? "").toLowerCase().endsWith(".pdf"));
  let policyPdf: string | undefined;
  if (decAtt) {
    const meta = (await mail().inboxes.messages.getAttachment(
      deal.inbox,
      bound.messageId,
      decAtt.attachmentId,
    )) as { downloadUrl: string };
    policyPdf = Buffer.from(await (await fetch(meta.downloadUrl)).arrayBuffer()).toString("base64");
  }
  await update(
    deal,
    {
      status: "bound",
      receipt: { ...deal.receipt!, policyNumber },
      policyPdf,
      policyFilename: decAtt?.filename,
    },
    {
      at: now(),
      direction: "in",
      from: deal.desk,
      to: deal.inbox,
      subject: bound.subject ?? "",
      summary: `Bound. Policy number ${policyNumber ?? "on file"}; the issued policy declarations are attached.`,
      labels: ["bound", "policy"],
      attachment: decAtt?.filename,
      messageId: bound.messageId,
    },
  );
  await applyBound(deal, policy, policyNumber);
}

async function applyBound(deal: Deal, policy: Policy, policyNumber?: string) {
  const saved = deal.previousMonthly - deal.monthly;
  const same = deal.insurer === policy.insurer;
  await store.putPolicy({
    ...policy,
    insurer: deal.insurer,
    monthlyPremium: deal.monthly,
    facts: [
      ...policy.facts.filter((f) => f.label !== "Policy number"),
      ...(policyNumber
        ? [{ label: "Policy number", value: policyNumber, disclosure: "shareable" as const }]
        : []),
    ],
  });
  const stance = await store.stance(policy.id);
  await store.putStance({
    policyId: policy.id,
    verdict: "won",
    fairMonthly: deal.monthly,
    headline: `Won $${saved} a month off.`,
    detail: `${deal.insurer} bound ${policyNumber ?? "the policy"} at $${deal.monthly}/mo after Maya signed. Receipt ${deal.receipt?.id}.${same ? "" : ` I'll cancel ${policy.insurer} once the new policy starts.`}`,
    activity: `won $${saved} off`,
    updatedAt: now(),
    ...(stance ? { walkAwayMonthly: undefined } : {}),
  });
  await store.addSignal({
    id: `sig-deal-${deal.id}`,
    personId: policy.personId,
    policyId: policy.id,
    at: now().slice(0, 10),
    source: "email",
    title: `Signed and bound: ${deal.insurer} at $${deal.monthly}/mo, saving $${saved * 12} a year. Receipt ${deal.receipt?.id} by email.`,
    impactMonthly: -saved,
  });
}

export async function declineDeal(id: string) {
  const deal = await store.deal(id);
  if (!deal || deal.status !== "awaiting_release") throw new Error("Nothing to decline");
  if (deal.draftId)
    await mail()
      .inboxes.drafts.delete(deal.inbox, deal.draftId)
      .catch(() => {});
  await update(
    deal,
    { status: "declined", note: "Maya declined to release her details. Nothing was sent." },
    {
      at: now(),
      direction: "draft",
      from: deal.inbox,
      to: deal.desk,
      subject: "",
      summary: "Draft deleted. No sealed facts left the inbox.",
      labels: ["declined"],
    },
  );
  return deal;
}

// ---- mock insurer policy desk ----------------------------------------------------------------
// Answers from its own AgentMail inbox. The first contract it sends has the deductible wrong,
// so the agent's contract check has something real to catch.

async function deskAnswer(deal: Deal, kind: "request" | "contract" | "corrected" | "bound") {
  const seen = new Set((await store.deal(deal.id))?.deskSeen ?? []);
  const incoming = await waitFor(deal.desk, deal.ref, seen);
  await update(deal, { deskSeen: [...seen] });
  const person = await store.person();
  const policy = (await store.policy(deal.policyId))!;
  const fact = (label: string) => policy.facts.find((f) => f.label === label)?.value ?? "";
  const sign = `\n\n${deal.insurer} Policy Desk`;

  if (kind === "request") {
    const text = `Hello,\n\nWe confirm ${usd(deal.monthly)} per month for ${person.name}'s ${policy.product}, effective ${policy.renewsOn}, with coverage unchanged.\n\nTo bind the policy we need the insured's date of birth, driver's licence number and the vehicle identification number (VIN). Please reply on this thread.${sign}`;
    await mail().inboxes.messages.reply(deal.desk, incoming.messageId, {
      text,
      labels: ["binding-request"],
    });
    return;
  }
  if (kind === "bound") {
    // Same number series as the insurer's existing policy (e.g. NSM-CA-…), otherwise initials.
    const onFile = deal.insurer === policy.insurer ? fact("Policy number") : "";
    const prefix = onFile
      ? onFile.split("-").slice(0, 2).join("-")
      : `${deal.insurer
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .toUpperCase()}-CA`;
    const number = `${prefix}-${Math.floor(20000 + Math.random() * 79999)}-${Math.floor(1000 + Math.random() * 8999)}`;
    const text = `Hello,\n\nThank you. The signed receipt is on file and the policy is bound. Your policy declarations are attached; please keep them for your records.\n\nPolicy number: ${number}\nEffective: ${policy.renewsOn}\nMonthly premium: ${usd(deal.monthly)}${sign}`;
    const dec = policyDocument({
      variant: "bound",
      policy,
      person,
      insurer: deal.insurer,
      monthly: deal.monthly,
      previousMonthly: deal.previousMonthly,
      policyNumber: number,
      dealRef: deal.ref,
    });
    await mail().inboxes.messages.reply(deal.desk, incoming.messageId, {
      text,
      labels: ["bound", "policy"],
      attachments: [
        {
          filename: `${slug(deal.insurer)}-policy-${number}.pdf`,
          contentType: "application/pdf",
          content: dec.toString("base64"),
        },
      ],
    });
    return;
  }
  const released = bodyOf(incoming);
  const val = (label: string) =>
    released.match(new RegExp(`^${label}:\\s*(.+)$`, "im"))?.[1]?.trim();
  const version = kind === "contract" ? 1 : 2;
  const deductible = version === 1 && fact("Deductible") === "$500" ? "$1,000" : fact("Deductible");
  const pdf = policyDocument({
    variant: "contract",
    policy,
    person,
    insurer: deal.insurer,
    monthly: deal.monthly,
    previousMonthly: deal.previousMonthly,
    version,
    deductible,
    dealRef: deal.ref,
    sealed: { dob: val("Date of birth"), licence: val("Driver's licence"), vin: val("VIN") },
  });
  const filename = `${slug(deal.insurer)}-contract-${deal.ref}-v${version}.pdf`;
  const text = [
    "Hello,",
    "",
    version === 1
      ? `Thank you for sending the binding details. Attached is the auto policy contract for ${person.name} covering the ${fact("Vehicle")}, effective ${policy.renewsOn} for six months at ${usd(deal.monthly)} per month.`
      : `Apologies for the error in the first version. Attached is the corrected auto policy contract for ${person.name}, effective ${policy.renewsOn} at ${usd(deal.monthly)} per month.`,
    "",
    "Please review the coverage summary and return the signed copy on this thread. Coverage begins once the signed contract is on file.",
    sign,
  ].join("\n");
  await mail().inboxes.messages.reply(deal.desk, incoming.messageId, {
    text,
    labels: ["contract"],
    attachments: [{ filename, contentType: "application/pdf", content: pdf.toString("base64") }],
  });
}
