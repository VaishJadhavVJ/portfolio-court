# Ask the Council: design proposal

*Proposal only. Nothing here is implemented.*

## The idea

A visitor types a question ("Which project should I look at first?") and the three voices debate it live, in the courtroom, followed by the narrator's verdict. Today every debate is pre-generated offline and the courtroom is fully static.

## What we learned from the endpoint we deleted

Until September 2026 the site had `POST /api/council/debate`. It was the whole threat model in one file:

- **No authentication, no bot check, no rate limit.** Anyone could call it as often as they liked.
- **Free-form input straight into the prompt.** The `topic` field was any string, of any length, pasted into all nine agent prompts.
- **A cache that was trivial to bypass.** `?live=true`, or simply any topic not already cached, triggered a full live debate.
- **Amplification.** One request cost nine LLM calls plus four Notion queries. A small script could run up the model bill and exhaust the Notion rate limit, which would also break the landing page's background rebuilds.
- **A free proxy on my domain.** The model's text was returned as-is, so a crafted topic could make "my" courtroom say anything and hand the result back as JSON.

Nothing in the site called it. It was deleted rather than hardened.

## Threat model for a live version

| Threat | Impact |
|---|---|
| Automated abuse (scripts, scrapers, bots) | Spend, provider quota exhausted, site degraded |
| Prompt injection through the question | Off-brand or harmful text shown on my site, or the model used as a free general-purpose proxy |
| Oversized or adversarial input | Higher cost per call, slower responses, more injection surface |
| Notion rate limits | Landing page rebuilds fail (they keep serving the last good page, but updates stall) |
| Provider outage or slow responses | A live courtroom that hangs for a visitor |
| Key leakage | Only if the key ever reaches the client; it must stay server-side |

## Guardrails, in order of the request path

1. **Kill switch.** One environment variable (`COUNCIL_LIVE=off`) turns the feature off and the UI falls back to pre-generated cases. It is checked before anything else, on every request.
2. **Bot protection.** Vercel BotID (or the Vercel Firewall's bot challenge) on the route, so scripted traffic is rejected before it costs anything.
3. **Rate limits.** Per IP, for example 3 questions per hour and 10 per day, in a small key-value store (Upstash Redis or Vercel KV). Returns 429 with a friendly courtroom message.
4. **Input cap.** Questions are trimmed and rejected above 200 characters. No markdown, no URLs.
5. **Portfolio-only scope.** A cheap first check decides whether the question is about my projects, work or skills; anything else gets a canned "Out of order!" line from the narrator and no debate. The portfolio data in the prompt comes from the static build, never from Notion at request time.
6. **Prompt hardening.** The question goes into the user message as quoted data, with an explicit instruction that it is a question from a visitor and never an instruction. Replies are validated with the same JSON checks the offline generator uses, and anything that fails is replaced by the canned line, never by the raw model output.
7. **Hard daily spend cap.** A global counter of questions per UTC day (for example 200). When it is reached, the route answers from pre-generated cases until the next day. This is enforced in code, independent of any provider-side budget.
8. **No persistence.** Visitor questions are not stored or logged beyond the aggregate counters.
9. **Timeouts.** A single live debate takes about 15 seconds today. Stream lines to the courtroom as they arrive, and abandon the request at 30 seconds.

## Cost per question on GLM-4.5-Flash

Measured on 2026-09-24 with the real agents and portfolio data, using the provider's own usage figures: one live debate is **9 calls, 22,306 prompt tokens and 424 completion tokens**, taking **about 15 seconds**. The narrator's verdict adds one more call of roughly 1,500 prompt tokens.

So a question is about **23,800 prompt tokens and 500 completion tokens**.

- **GLM-4.5-Flash is free.** Z.ai's pricing page lists it as free for input and output ([docs.z.ai/guides/overview/pricing](https://docs.z.ai/guides/overview/pricing)). Zhipu's own docs add that GLM-4.5-Flash was retired on 2026-01-30 and that its requests are now routed to GLM-4.7-Flash, which is also free ([docs.bigmodel.cn, GLM-4.5-Flash](https://docs.bigmodel.cn/cn/guide/models/free/glm-4.5-flash)). So the marginal cost per question is **$0**, and the offline generator is most likely already running on GLM-4.7-Flash.
- **Free is limited by concurrency, not money.** Limits are per model and per account tier, are shown only in the account console, and overload returns errors 1302 or 1305 ([rate limits](https://docs.bigmodel.cn/cn/api/rate-limit.md)). A burst of visitors would hit that ceiling, and so would an attacker, which would also block the offline generator.
- **If a paid model were needed**, at Z.ai's published prices per million tokens:

| Model | Input | Output | Per question | At a 200/day cap |
|---|---|---|---|---|
| GLM-4.7-FlashX | $0.07 | $0.40 | about $0.0019 | about $0.37/day |
| GLM-4.5-Air | $0.20 | $1.10 | about $0.0053 | about $1.06/day |

Money is not the constraint. Abuse, reliability and quality control are.

## Recommendation

**Not worth building for this site right now.**

The honest arithmetic is not about money. It is about attention: a portfolio gets a small number of visitors, most of whom will not type a question, and the ones who do would wait about fifteen seconds for an answer that the pre-generated cases already give them with better quality control. Against that sits a public, unauthenticated-by-nature entry point to an LLM key, which is exactly the thing we just removed.

If the goal is interactivity, a cheaper design gets most of the charm: a menu of preset questions ("Which project shipped first?", "What would you cut?") whose debates are generated offline by the existing pipeline, reviewed, and served statically. No live endpoint, no key exposure, no spend, and every line is checked before anyone sees it.

If a truly live version is ever wanted, build it only with all nine guardrails above in place from day one, start with the kill switch set to off, and turn it on for a limited trial.
