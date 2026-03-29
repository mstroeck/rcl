# rcl Roadmap — Synthesized from Opus, GPT-5.4 & Gemini 3 Pro

## Where All Three Models Agree (Highest Confidence)

These came up independently across all three models, making them the clearest priorities:

### 🔴 P0 — Ship Before Promoting

| # | Initiative | Effort | Why all 3 flagged it |
|---|-----------|--------|---------------------|
| 1 | **GitHub Action** | S-M | "Single highest-leverage thing" (Opus). The adoption surface for any CI tool. Without it, nobody will bother. |
| 2 | **Inline PR review comments** | S | `createReviewComments()` already exists but isn't wired up. "The code is written, just ship it" — all three models noticed. |
| 3 | **File filtering / ignore patterns** | S | Reviewing lockfiles and generated code wastes tokens and generates noise. Every model called this out. |
| 4 | **Retry logic + provider resilience** | S-M | Zero retry logic on transient 429/500/timeout. All three models flagged this as a production blocker. |
| 5 | **CI policy engine** | M | `--ci` only does exit-code-on-high. Teams need: severity gates, consensus thresholds, changed-lines-only mode, baseline comparisons. |
| 6 | **`rcl init` config scaffolding** | S | No way to generate a config file. All three models suggested this. |

### 🟡 P1 — Production Hardening

| # | Initiative | Effort | Cross-model signal |
|---|-----------|--------|-------------------|
| 7 | **Result caching** | M | Reviews cost $0.10-$1+ per run. Re-running on unchanged chunks is waste. All three flagged it. |
| 8 | **Suppressions / triage workflow** | M | `.rclignore`, inline `rcl-ignore-next-line`, fingerprinted baselines. Without this, noise kills adoption. |
| 9 | **Finding fingerprints + persistent history** | M | Stable identity across runs enables: baselines, suppression, trend tracking, dashboards. Substrate for everything else. |
| 10 | **Git diff / local workflow support** | S | `rcl review --staged`, `rcl review HEAD~3..HEAD`, `rcl review main..feature`. All three want this. |
| 11 | **GitHub Checks + SARIF output** | M | Standard integration surfaces. Makes rcl feel like a real security/quality tool, not just "LLM in a CLI." |

### 🟢 P2 — Differentiation

| # | Initiative | Effort | Cross-model signal |
|---|-----------|--------|-------------------|
| 12 | **Smarter consensus (embeddings/semantic)** | M-L | Word-overlap dedup works for obvious dupes but misses semantic equivalence. Consensus is the moat — invest in it. |
| 13 | **GitLab + Bitbucket support** | L | Broadens addressable market. Abstract resolver/poster interfaces. All three said "do this after GitHub is excellent." |
| 14 | **Plugin system for providers** | M-L | Ollama, Together, Bedrock, Azure OpenAI. The `openai-compat` adapter is a start but not extensible enough. |
| 15 | **Auto-fix mode** | L | `--fix` generates commits, `--fix --push` pushes to PR branch. High impact but high effort. |
| 16 | **VS Code extension** | L | Review staged changes in-editor. All three models suggested it, all ranked it lower priority. |

---

## Unique Ideas Worth Stealing

Things only one model proposed but that are genuinely good:

### From Opus
- **Cost estimator calibration**: Compare `chars/4` heuristic against actual token usage from provider responses. Capture real `usage.input_tokens` / `output_tokens`.
- **Review context injection**: `--context "This is a PCI-compliant payments service"` to steer the review focus.

### From GPT-5.4
- **Disagreement analysis**: Show where models *disagree* on severity/category. "Controversial" findings that need human triage. This makes consensus transparent.
- **Provider capability profiles**: Each model declares `supportsJSON`, `supportsToolCalling`, `supportsTemperature`, `maxContext`. Removes ad-hoc branching in adapters.
- **Canonical review artifact pipeline**: `ResolvedDiff → PromptPlan → ModelRun → NormalizedReview → ConsensusReview → PolicyDecision`. Persist as JSON. Gives resumability, debuggability, future hosted sync.
- **Budget controls**: Max cost per run, stop after N blocking findings, cheap-first strategy (run Flash/mini first, escalate to premium when uncertain).

### From Gemini
- **Interactive TUI for findings**: Browse, filter, and ignore findings in a terminal UI. Surprisingly no one else suggested this.
- **Stateful finding database**: SQLite for cross-run tracking. Foundation for incremental reviews and quality metrics.

---

## Architecture Improvements (All Three Agree)

1. **Unify response parsing** — each adapter has its own JSON extraction. Extract shared `parseModelResponse()`.
2. **Replace `console.warn` with structured diagnostics** — return in result objects, let outputs decide rendering.
3. **Proper error types** — `ConfigError`, `ProviderError`, `ParseError` with error codes for programmatic handling.
4. **Separate core engine from CLI** — `core` (diff/prompt/dispatch/consensus/policy) vs `cli` (commander/terminal) vs `integrations` (github/gitlab/sarif).

---

## Monetization Path (Consensus View)

All three models converged on the same strategy:

**Open-source CLI = acquisition channel. Hosted team control plane = product.**

| Tier | What's included |
|------|----------------|
| **Free / OSS** | CLI, multi-model review, JSON/Markdown output, basic GitHub posting |
| **Team ($15-29/user/mo)** | Hosted dashboard, run history, org policies, suppressions, analytics, GitHub App |
| **Enterprise** | SSO/SAML, RBAC, audit logs, VPC deployment, data retention controls, compliance |

Optional: managed model access (no BYOK needed) as usage-based add-on.

---

## Competitive Positioning (Consensus View)

| Tool | Approach | rcl's advantage |
|------|----------|----------------|
| GitHub Copilot Review | Single model, vendor-locked | Multi-model consensus, provider-agnostic |
| CodeRabbit | Single model SaaS, black box | Open-source, self-hosted, configurable |
| Semgrep/CodeQL | Rule-based static analysis | AI finds what rules miss; complementary |
| "Just paste diff into Claude" | Manual, no CI | Automated, consensus, CI-integrated |

**Positioning**: "The open-source, multi-model code review tool that eliminates AI review noise through consensus."

---

## Recommended 90-Day Plan

### Weeks 1-2: Ship the basics
- Wire up inline PR comments (code exists)
- File filtering with sensible defaults
- Retry logic with exponential backoff
- `rcl init`

### Weeks 3-4: CI-ready
- GitHub Action (marketplace)
- CI policy engine (severity gates, consensus thresholds)
- Changed-lines-only validation
- SARIF output

### Weeks 5-8: Production-grade
- Result caching (per-chunk, hash-based)
- Suppression workflow + finding fingerprints
- Git diff / local workflow (`--staged`, branch ranges)
- Structured logging + actual token tracking

### Weeks 9-12: Differentiation
- Semantic dedup (embeddings or TF-IDF upgrade)
- Disagreement reporting
- Model profiles / presets (`fast`, `thorough`, `security`)
- Provider capability profiles (fix temperature/format issues structurally)

**After 12 weeks**: rcl is production-grade, CI-native, and ready for public launch + hosted product planning.
