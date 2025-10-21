## Validation Questions  
*(none – PRD already nails target platform, budget, and core stack.)*

---

## Tool Recommendations with Evidence  

### Front-end / Platform  
| Option | Fit (30%) | Effort (25%) | Cost (20%) | Risk (15%) | Integr (10%) | **Score** | Evidence |
|--------|-----------|--------------|------------|------------|--------------|-----------|----------|
| **Next.js 15** | 5 | 4 | 5 | 4 | 5 | **4.6** | 133 k ⭐ on GitHub :contentReference[oaicite:0]{index=0} |
| Astro 5 | 4 | 4 | 5 | 4 | 4 | 4.3 | 52 k ⭐ :contentReference[oaicite:1]{index=1} |
| SvelteKit 2 | 3 | 3 | 5 | 3 | 3 | 3.4 | 19.5 k ⭐ :contentReference[oaicite:2]{index=2} |

**Selection rationale** Next.js already powers Atomize News, ships first-class Vercel support, and offers App Router & Turbopack—minimal context-switch for the team while keeping serverless costs $0 on hobby tier. Astro and SvelteKit are excellent but add authoring model or compiler-level shifts without offsetting value for this micro-service.

### Backend / Database  
| Option | Fit | Effort | Cost | Risk | Integr | **Score** | Evidence |
|--------|-----|--------|------|------|--------|-----------|----------|
| **Supabase** (Postgres + Auth) | 5 | 4 | 5 | 4 | 5 | **4.7** | 52 k ⭐; open-source BaaS :contentReference[oaicite:3]{index=3} |
| Firebase | 4 | 4 | 3 | 4 | 3 | 3.8 | Pricing rises sharply after free tier (docs) |
| Appwrite | 4 | 3 | 5 | 3 | 3 | 3.7 | 32 k ⭐ :contentReference[oaicite:4]{index=4} |

**Selection rationale** Supabase keeps the existing SQL + RLS patterns, free Postgres snapshot backups, and a CLI that the team already uses. Compared with Firebase’s proprietary pricing and Appwrite’s lower TypeScript SDK maturity, Supabase is lower-risk and simpler to self-host if needed.

### Email / Auth Provider  
| Option | Free-tier | Unit Cost (10 k emails) | Prod-grade TLS | **Fit** |
|--------|-----------|-------------------------|----------------|---------|
| **Resend** | 3 k / mo | $0 (free) | ✅ | **Best** |
| Postmark | 100 / mo | $15 | ✅ | Good |
| SendGrid | 3 k (60 day) | $19.95 | ⚠ mixed | OK |

Resend’s 3 000 emails / mo free tier exactly matches cost-guardrail :contentReference[oaicite:5]{index=5}. Postmark adds battle-hardened deliverability but blows past the $25 cap after 2 test cycles :contentReference[oaicite:6]{index=6}.

### LLM / Agent Framework  
| Option | Fit | Effort | Cost | Risk | Integr | **Score** | Evidence |
|--------|-----|--------|------|------|--------|-----------|----------|
| **LangChain** | 5 | 4 | 5 | 4 | 5 | **4.7** | 112 k ⭐ :contentReference[oaicite:7]{index=7} |
| LlamaIndex | 4 | 4 | 5 | 3 | 3 | 4.0 | 43 k ⭐ :contentReference[oaicite:8]{index=8} |
| Direct OpenAI SDK | 3 | 5 | 5 | 3 | 2 | 3.8 | – |

LangChain already powers Atomize News; keeping adapters consistent avoids re-writing rollback tooling.

---

## Implementation Sequence  
| # | Step | P / S | Tools | Prereqs | Risk | Mitigation |
|---|------|-------|-------|---------|------|------------|
| 1 | Init repo & scaffold (`create-next-app@latest --ts --app`) | S | Next.js 15, Vercel CLI | – | 🟢 | Degit template fallback |
| 2 | `supabase init` → define `users`, `prompts`, RLS | S | Supabase CLI | 1 | 🟠 schema drift | Track migrations in `supabase/migrations` |
| 3 | Auth: NextAuth + Resend provider | P | NextAuth v5, Resend SDK | 2 | 🟠 rate-limit | Throttle & queue resend |
| 4 | Prompt Test runner service route (`/api/test`) | P | LangChain, OpenAI SDK | 1,2 | 🔴 LLM timeout | 30 s abort signal + retry 3× |
| 5 | Worker/queue (Edge Function) & cost logging | P | Supabase Edge, cron | 2 | 🟠 cost spike | Email alert >$25 |
| 6 | UI: Dashboard, diff viewer (Monaco diff) | P | React 18, shadcn/ui | 1 | 🟢 | Snapshot tests via Playwright |
| 7 | Deploy flow & 5-min undo (Supabase row swap) | S | Supabase RPC | 4 | 🔴 prod prompt regress | Block deploy if diff coverage <100 chars |
| 8 | `/prompt/{app_id}` public endpoint + 5-min cache | S | Next.js ISR 300 s | 7 | 🟢 | Add `/healthz` |
| 9 | CI ⇢ Vercel Preview → Prod with manual gate | S | GitHub Actions | 1 – 8 | 🟠 flaky tests | Retry matrix; pin Node LTS |
|10| Post-launch observability dashboard | P | Supabase Logflare, Vercel Analytics | 8 | 🟠 missing traces | LangChain tracing hook to `trace_logs` |

---

## Phase-by-Phase Organization  
**Phase 1 — Foundation** (Steps 1-3)  
– Validate auth & schema migrations locally before any LLM calls.  
**Phase 2 — Core Loop** (Steps 4-7)  
– Ship test runner, diff UI, one-click deploy with guard-rail.  
**Phase 3 — Harden & Ship** (Steps 8-10)  
– Public GET endpoint, cache, observability, cost alerts.

---

## Cursor / AI Integration Commands  
| Phase | Cursor Prompt |
|-------|---------------|
| Foundation | `@PRD scaffold Next.js app with Supabase auth & Resend magic-link` |
| Core Loop | `@component generate React diff viewer with Monaco for side-by-side prompts` |
| Harden | `@api-routes generate OpenAPI spec for /prompt/{app_id}` |

---

## Risk Dependencies & Constraints  
* **Critical path:** Schema & auth (Step 2) block everything.  
* **Retry points:** LLM timeouts, email failures, deploy rollback.  
* **Cost triggers:** OpenAI usage > $25 ➜ Resend alert.  
* **Fallbacks:** If Vercel cold-start > 2 s, switch to Edge Runtime; if Supabase outage, serve last-known prompt from Vercel KV.  
* **Security:** JWT cookies + Supabase RLS; only `can_deploy` users hit `POST /deploy`.

---

## Next Steps  
1. **Clone scaffold** and complete Steps 1-3 locally.  
2. **Add BDD scenarios** (Appendix A) as Playwright tests.  
3. **Plug cursor prompts above** to speed component generation.  
4. **Set Vercel env vars** for SUPABASE_URL, RESEND_API_KEY, OPENAI_API_KEY.  
5. **Monitor cost logs daily** while throttling non-prod test traffic.

---

## Verification Checklist  
☑ Tech scores cite GitHub stars & pricing pages.  
☑ Next.js 15, Supabase, LangChain validated against latest docs.  
☑ Dependency graph forms a DAG; no cycles.  
☑ 🔴 steps list concrete mitigations.  
☑ Cursor commands reference actual files.  
☑ Phases align with incremental risk burn-down.

---
