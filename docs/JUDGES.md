# Who we're pitching to

Eleven judges. Eight of them built a sponsor tool, so each will mostly ask one question: *did this team
use my product for the thing it's best at, or just to tick a box?* This page maps every judge to what
Lowball already does, what's missing, and the one sentence to say on stage.

Status as of 13:10 PT. Owners in brackets.

## At a glance

| Sponsor | Judge | What we do with it today | Gap to close |
|---|---|---|---|
| **AgentMail** | Haakam Aujla | The agent has its own inbox, emails brokers for quotes, reads replies, counters with other lines' offers, asks for written confirmation | Mock broker agents on their own inboxes so email runs agent-to-agent during the demo [Anders] |
| **Exa** | Jeff Wang | 30-day replay where the agent only sees what was published up to each day; price scans with structured extraction and cited URLs | Show one cited source on stage, not a list [Erik] |
| **Neon** | Nikita Shamgunov | One Postgres shared by Vercel and every Fly agent; parallel calls share offers through it; agents claim work with `SKIP LOCKED` | Route model calls through **Neon AI Gateway** (keys not set yet) [Erik] |
| **Mastra** | Abhi Aiyer | Chat agent and strategist agent with research, network, bank-data and round-status tools | No workflow or memory yet. Stretch: email line as a workflow that suspends while waiting for a reply [open] |
| **Fly.io** | Scott Johnston | Every negotiation line is its own Fly Machine; a warm pool claims new lines instantly; spawn as many as you like | Say it out loud on stage: "each of these is a separate computer" [Erik] |
| **assistant-ui** | Simon Farshid | Ask box built from primitives, styled to match the app | Tool calls render as cards (offer, price ledger, negotiation status) for Best UI [Erik] |
| **Kernel** | Catherine Jue | Retention check: a cloud browser starts cancelling online and stops at the "please stay" offer, never confirming | Show the live view for 5 seconds [Anders] |
| **Executor** | Rhys Sullivan | Not used | Skip unless it's a 15-minute job |
| **CodeRabbit** | Erik Thorelli | Not used; repo is private | Public repo + MIT license + README + CodeRabbit on PRs for Best Open Source [team decision] |
| Design | Jakub Krehel (Interfere) | B2 Daylight design: one calm column, motion only where it means something | Polish empty and loading states [Erik] |
| Business | James da Costa (a16z) | Not in the pitch yet | One sentence on market and network effect (below) [presenter] |

## Judge by judge

**Haakam Aujla, AgentMail.** AgentMail exists so agents can have their own email identity and hold
two-way conversations. The strongest thing we can show him is our agent and a broker's agent emailing
each other, with the thread readable in the hub, and a human able to jump in mid-thread without
breaking anything.

**Jeff Wang, Exa.** Exa is search built for models: semantic queries, content extraction, date windows.
Our replay uses exactly that. On each simulated day the agent asks Exa only for what was published by
then, so the 30-day story is real research, not a script. Every price in the ledger links to its source.

**Nikita Shamgunov, Databricks (Neon).** Neon is presenting the event. He'll want Postgres doing real
work for agents. Ours does: one `docs` table is the shared memory between a dashboard on Vercel and any
number of agents on Fly, and agents claim work atomically. Adding the AI Gateway makes it two Neon
products. A natural extension to mention: a database branch per negotiation round.

**Scott Johnston, Fly.io.** Fly's pitch is that agents need real computers, not sandboxes. Ours run
that way: every call or email thread is its own Machine that lives for as long as the negotiation
does, independent of the website.

**Abhi Aiyer, Mastra.** He'll look for idiomatic Mastra, meaning more than one agent with tools. We have
two agents, a strategist that never leaks private limits, and shared tools. If time allows, the email
line as a suspend/resume workflow is the most "Mastra" thing we could add.

**Simon Farshid, assistant-ui.** He also sponsors Best UI ($750). He'll notice whether the chat looks
like the default template (it doesn't) and whether tool calls become real UI (not yet). Cards for an
offer, the price ledger and live negotiation status would close that gap.

**Catherine Jue, Kernel.** Kernel's strength is real browser work where there's no API, including
logged-in flows. The retention check is a good fit: it walks a cancel flow and stops at the save offer.
The live view on screen sells it.

**Rhys Sullivan, Executor.** Executor is a tool and MCP gateway (per Anders' research). We don't need it;
better to say nothing than to bolt it on.

**Erik Thorelli, CodeRabbit.** Best Open Source is $10k. That needs a public repo, a licence, a real
README and CodeRabbit reviewing our PRs. The repo is Anders' in the `astar-as` org, so going public is
a team call.

**Jakub Krehel, Interfere.** A design engineer, so he'll judge craft: type, spacing, motion, empty
states. Same work as for Simon, so it counts twice.

**James da Costa, a16z.** The only investor judge. He'll ask whether this is a business. Our answer:

> Insurers quietly charge loyal customers more every renewal, and almost nobody shops around because it's
> tedious. Lowball does the shopping and the haggling for you. It gets better with every member, because
> what members actually pay becomes leverage for the next negotiation. Insurance is the wedge; every
> recurring bill is the expansion.

## The 3-minute story

One renewal, told end to end, with judges in it.

1. **The state.** The dashboard: "Maya pays $954 a month. $70 of that is too much." Tap auto: coverage
   and must-keep requirements, plus what the agent noticed over 30 days, with sources. *(Exa, Neon)*
2. **The decision.** Ask: "Why is my car insurance too expensive?" The answer cites real market prices.
   *(assistant-ui, Mastra)*
3. **The round.** Tap Negotiate. Three judges' phones ring at once (`/demo/receiver/1-3`) while two
   email threads start. Each line is its own Fly Machine. *(Fly, GPT-Live, AgentMail)*
4. **Shared memory.** A judge offers a price. Within seconds the other lines use it as leverage, visible
   in the hub timeline. *(Neon)*
5. **The deal.** One broker agrees. The agent thanks them and asks for confirmation by email; the
   dashboard flips to the new price and the yearly saving. *(AgentMail)*
6. **Close.** One sentence each: Kernel retention check, open source, the business line above.

## Takeaways

1. **Shared memory across parallel negotiations is our hook.** Nobody else will have three phones
   ringing at once with agents learning from each other.
2. **Depth beats breadth.** Five deep integrations (AgentMail, Exa, Neon, Fly, assistant-ui) are worth
   more than ten mentions.
3. **Design counts twice** (Simon and Jakub), so polish is worth real time.
4. **Open source is worth $10k** if the team agrees to go public.
