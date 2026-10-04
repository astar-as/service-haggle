# insurance-agent-hack

**A personal agent that shops and negotiates your insurance renewals. You only sign.**

Built at the [Build Personal Agents Hack](https://build-personal-agents.com/), San Francisco, 4 October 2026.

## The problem

Every year, loyal customers pay more for the same coverage. Discounts and retention offers mostly go
to people who shop around or call to complain, and most people never do either because it's tedious
and uncomfortable.

## What the agent does

```
1. GATHER    Read your declarations page (from email or PDF) into a local graph: car, coverage, price, renewal date
2. SHOP      Request quotes from several insurers, sharing only the fields each quote needs
3. COMPARE   Normalise the quotes so coverage, limits and deductibles line up
4. LEVERAGE  Ask your current insurer to match, and find discounts you're missing
5. YOU SIGN  The insurer sends an e-signature document. The agent never signs or pays.
6. CLEAN UP  Cancel the old policy, only after the new one is confirmed
```

## Design principles

- **Local first.** Your personal graph (people, contracts, prices, limits) is stored only on your Mac.
- **Disclosure levels.** Each fact is `hidden`, `private` (the agent may use it but never say it) or `shareable`.
- **Strategist and channel split.** The strategist knows your limits and only hands out decisions. The
  channel agents (email, voice) never see the limits, so they can't leak them.
- **Sealed secrets.** Values like your driver's licence number and date of birth are filled in at send
  time and never enter the model's context.
- **A human signs.** The agent never binds coverage, signs or pays.

## Stack

Mastra (agents), Neon (Postgres plus the AI Gateway for model choice), AgentMail (email channel),
Exa (market research), assistant-ui (UI), Fly.io (hosting).

## Status

Work in progress, built during the hackathon.
