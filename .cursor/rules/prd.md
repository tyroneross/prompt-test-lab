### Simple PRD Template v1.3 (MVP-First)

---

## 1. Problem Statement

Product builders need a **manual, human-in-the-loop loop** to A/B-test alternate LLM prompts against identical input, review results, optionally tweak a variant, and **one-click promote the winner as the new “base prompt.”**
Inside *Atomize News* this loop is buried in a monolith, requires LangChain-specific CLI deploys, and can’t be reused elsewhere.

**Prompt Testing Lab** will be extracted as a serverless Vercel micro-service that:

1. Lets users paste **plain text** and multiple prompt variants (MVP).
2. Runs A/B tests on demand.
3. Shows side-by-side diffs (prompt + output).
4. Deploys the chosen prompt via LangChain, versions every deploy, provides a 5-minute rollback window.
5. Stays cost-light for a single primary user yet scales to multiple apps, future file/URL inputs, and additional framework adapters.

---

## 2. Goals & Success Criteria

| #      | Goal                    | MVP Success Metric                                                |
| ------ | ----------------------- | ----------------------------------------------------------------- |
| **G1** | **Fast manual loop**    | End-to-end ≤ 10 min for ≤ 3 variants                              |
| **G2** | **Clear results**       | 100 % of tests show side-by-side diff + winner selector           |
| **G3** | **Safe deployment**     | Every deploy tagged (`vX.Y.Z`), rollback ≤ 30 s                   |
| **G4** | **Text-only input**     | Plain-text entry works; upload/URL UI stub labelled “Coming Soon” |
| **G5** | **LangChain parity**    | Deploy flow matches current CLI; adapter interface sketched       |
| **G6** | **Multi-app readiness** | ≥ 2 target apps fetch correct base prompt                         |
| **G7** | **Cost guardrail**      | Infra spend ≤ \$25 / mo; email alert if exceeded                  |

---

## 3. Users & Roles

| User Type         | Deployment Privilege? | Capabilities                                                          | Data Isolation              |
| ----------------- | --------------------- | --------------------------------------------------------------------- | --------------------------- |
| **Builder**       | **Yes**               | create/edit prompts & tests, deploy, rollback, manage apps & settings | Sees all records            |
| **Prompt Tester** | **No**                | create/edit prompts & tests, view their own results                   | RLS: `user_id = auth.uid()` |
| **Target App**    | n/a                   | `GET /prompt/{app_id}` to fetch latest base prompt                    | No human data               |

Authentication: **GitHub OAuth + Email Magic-Link (Resend)** via NextAuth.
“Deployment Privilege” controlled by `can_deploy` boolean in **users** table.

---

## 4. Core Workflows

### Flow A  – Prompt Testing

1. Sign in → Select app
2. Paste input text → Enter ≥ 2 prompt variants
3. **Start Test** → Worker runs prompts in parallel
4. Side-by-side **Prompt Diff | Output Diff** table → Select winner & optional inline edit
5. **Save Candidate Prompt** (awaits Builder)

### Flow B  – Deploy Candidate (Builder)

1. Review Prompt Diff + Output Diff (collapsible panes)
2. **Deploy** → stores diff, versions, timestamps
3. Success toast “v1.3.0 live – Undo?” (5 min window)

### Flow C  – Target App Retrieval

Fixed **5-minute cache** per app → `GET /prompt/{app_id}` returns `{version, prompt, updated_at}`.

---

## 5. Features – Prioritized MVP-First

| #       | Feature                               | User Story                                                                            |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| **F1**  | Plain-text input panel                | `As a Prompt Tester, I want to paste test text so I can experiment quickly.`          |
| **F2**  | Prompt variant editor                 | `As a Prompt Tester, I want to enter multiple variants side-by-side to compare them.` |
| **F3**  | Manual “Start Test”                   | `As a Prompt Tester, I decide when the experiment begins.`                            |
| **F4**  | Side-by-side diff (prompt + output)   | `As a Prompt Tester, I need color-coded diffs to spot differences fast.`              |
| **F5**  | Winner select & inline edit           | `As a Prompt Tester, I refine and nominate the best prompt.`                          |
| **F6**  | Save Candidate Prompt                 | `As a Prompt Tester, I hand off the winner for deployment.`                           |
| **F7**  | One-click deploy + versioning         | `As a Builder, I promote the candidate prompt while keeping history.`                 |
| **F8**  | Immediate rollback (5-min)            | `As a Builder, I can revert if issues appear.`                                        |
| **F9**  | Auth with “Deployment Privilege” flag | `As an Admin, I control who can deploy.`                                              |
| **F10** | REST `GET /prompt/{app_id}`           | `As a Target App, I fetch the latest prompt easily.`                                  |
| **F11** | Cost guardrail email alert            | `As a Builder, I’m warned if infra spend > $25.`                                      |

**Future (Post-MVP)** – File/URL inputs, automated scoring, webhook push, model toggle, adapters, RBAC, analytics dashboard, voice/CLI triggers, per-app cache TTL.

---

## 6. AI / LLM Use (Optional)

*Prompt Testing Lab* relies on external LLMs (GPT-4o in OpenAI) via **LangChain**.
No local LLM required in MVP; adapter layer will allow model swapping and off-line engines (e.g., Ollama) post-MVP.
Failure handling: if model call errors, variant status → “Error” with retry option; test completes when ≥ 1 variant succeeds.

---

## 7. Storage & Persistence (Supabase)

| Table                  | Key Fields                                                                | Notes                            |
| ---------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| **users**              | `user_id`, provider, `can_deploy`                                         | Supabase Auth                    |
| **target\_apps**       | `app_id`, name, cache\_ttl\_sec (300)                                     | room for webhook URL             |
| **prompts**            | `app_id`, `semantic_version`, prompt\_text, deployed\_at, deployed\_by    | PK (`app_id`,`semantic_version`) |
| **tests**              | `test_id`, `user_id`, `app_id`, input\_text, created\_at                  |                                  |
| **variants**           | `variant_id`, `test_id`, label, prompt\_text                              |                                  |
| **outputs**            | `output_id`, `variant_id`, output\_text, latency\_ms, tokens              |                                  |
| **candidate\_prompts** | `candidate_id`, `test_id`, edited\_prompt\_text                           |                                  |
| **trace\_logs**        | run\_id, `variant_id`, model, timing, token\_usage\_json, `chunk_refs`\[] |                                  |
| **cost\_logs**         | ts, model, tokens\_in/out, cost\_usd                                      |                                  |

*New dedicated Supabase project*, RLS enabled on user-scoped tables, daily backups.

---

## 8. Non-Functional Requirements

| Area              | Target                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| **Performance**   | P95 test-run ≤ 8 s (3 variants, GPT-4o)                                  |
| **Scalability**   | ≥ 10 concurrent tests, Vercel autoscale                                  |
| **Availability**  | 99.5 % monthly                                                           |
| **Security**      | HTTPS only, JWT cookies, RLS, `can_deploy` check                         |
| **Cost**          | ≤ \$25 / mo infra, email alert if exceeded                               |
| **Tech Stack**    | Next.js 14 · React · TypeScript · LangChain · Supabase PG · ≤ 5 new deps |
| **Observability** | LangChain tracing → `trace_logs`, `/healthz`, Vercel analytics           |
| **Accessibility** | Automated Lighthouse WCAG 2.1 AA pass                                    |
| **Compliance**    | No PII beyond email; GDPR delete via table row delete                    |

---

## 9. Wireframes / UX Notes

1. **Dashboard / Test Setup** – Input textarea, Variant columns, Start Test, cost badge.
2. **Test Results** – Side-by-side Prompt Diff | Output Diff, winner radio.
3. **Deploy Review** – Prompt + Output diff panes, semantic version, Deploy button.
4. **Deploy Success** – toast with 5-min Undo link.
5. **Settings Page** – Profile, Apps, Cost Alert, **Theme toggle (“Calm Precision” navy palette)**.
6. **Login Modal** – GitHub / Email Magic-Link.

Palette: Navy-900 #0B1F36, Navy-700 #123B63, Navy-100 #E8F0F8, Accent-Cyan #29BDE0, Success-Green #33C48D, Error-Red #F55455.

---

## 10. Open Questions *(none – all resolved)*

(See decision log under Q1-Q9 and BDD choices.)

---

## 11. Completion Checklist

* [ ] Save PRD to `/prompt-testing-lab/prd.md`
* [ ] Add **Appendix A** with BDD Gherkin scenarios
* [ ] Push repo scaffold (Next.js 14 + Supabase) to GitHub → Vercel deploy
* [ ] Configure GitHub & Resend creds in Vercel env vars
* [ ] Run `supabase db push` to set up new DB
* [ ] Schedule daily cost-alert CRON function
* [ ] Generate OpenAPI spec & (optional) Swagger UI
* [ ] Lighthouse accessibility check before launch
* [ ] Provide `.env.example` for contributors

*(Linear issues export deferred until you adopt Linear.)*

---

## 12. Final Deliverables

1. **Markdown PRD** (this document)
2. **User stories** (Section 5)
3. **Appendix A – BDD Scenarios** (below)
4. *(Optional later)* Linear/CSV issue list
5. *(Optional)* Lighthouse & OpenAPI reports

---

## Appendix A – BDD Scenarios

```gherkin
Feature: Prompt Testing – Happy Path

  Scenario: Run a two-variant test and deploy the winner
    Given I am signed in as a Builder
    And I am on the Dashboard for app "Atomize News"
    And I have entered input text "Breaking AI news"
    And I have entered prompt variant A and prompt variant B
    When I press "Start Test"
    Then I should see side-by-side diffs for variants A and B
    When I select variant B as the winner
    And I press "Save Candidate"
    And I press "Deploy"
    Then the API should return 200
    And the toast should read "v1.0.0 live – Undo?"
    And the target app GET endpoint should now return prompt version v1.0.0

Feature: Prompt Testing – Invalid Auth

  Scenario: Tester attempts to deploy without privilege
    Given I am signed in as a Prompt Tester
    And a Candidate Prompt exists
    When I navigate to the Deploy Review page
    Then I should not see the "Deploy" button
    And an authorization error is logged if I hit the deploy API directly

Feature: Prompt Testing – Model Call Failure

  Scenario: One variant times out
    Given the OpenAI API will timeout for variant B
    When I press "Start Test"
    Then variant A status is "Completed"
    And variant B status is "Error – Retry?"
    And the overall test is marked "Partial Success"

Feature: Cost Guardrail

  Scenario: Infra spend exceeds $25 in current month
    Given the cost_logs total for this month is $26
    When the daily cost-alert CRON runs
    Then an email should be sent via Resend to the Builder
    And the email subject should contain "Cost Alert"

Feature: Undo Deploy

  Scenario: Builder rolls back within 5-minute window
    Given version v1.0.0 is live
    When I click "Undo" within 5 minutes
    Then the previous version v0.9.2 becomes the base prompt
    And the toast should read "Rollback successful"
```

*Edge cases covered: unauthorized deploy, model failure, cost overrun, rollback timing.*

---

**End of PRD – Prompt Testing Lab (MVP)**
