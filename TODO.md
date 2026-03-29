# rcl v0.2 — Implementation Plan

## P0: Ship Before Promoting

### 1. Wire Up Inline PR Review Comments
- [ ] Add `--inline` flag to CLI (default when `--post` is used)
- [ ] Add `--post-mode comment|inline|both` option
- [ ] Wire `createReviewComments()` from `output/github.ts` into `index.ts` post flow
- [ ] Unmappable findings fall back to PR summary comment (already handled)
- [ ] Test: post inline comments to a real PR

### 2. File Filtering / Ignore Patterns
- [ ] Add `ignore` array to config schema (glob patterns)
- [ ] Add `include` array to config schema (glob patterns)
- [ ] Add `--ignore` and `--include` CLI flags
- [ ] Built-in defaults: skip `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `*.min.js`, `*.map`, `dist/**`, `vendor/**`
- [ ] Apply filters in resolver before chunking
- [ ] Add `picomatch` or `minimatch` dependency for glob matching
- [ ] Test: verify filtering works on local patches and GitHub PRs

### 3. Retry Logic + Provider Resilience
- [ ] Add `retries` and `retryDelayMs` to config schema (default: 2 retries, 1000ms base)
- [ ] Implement exponential backoff with jitter in `runner.ts`
- [ ] Respect `Retry-After` header from provider responses
- [ ] Retry on: 429, 500, 502, 503, 504, ETIMEDOUT, ECONNRESET
- [ ] Do NOT retry on: 400, 401, 403 (config/auth errors)
- [ ] Log retry attempts to terminal: "Retrying anthropic/claude-opus-4-6 (attempt 2/3)..."
- [ ] Test: mock adapter that fails then succeeds

### 4. CI Policy Engine
- [ ] Add `policy` section to config schema:
  - `failOn`: severity threshold (default: `high`)
  - `requireConsensus`: minimum model count for blocking findings (default: 1)
  - `categories`: array of categories that block (default: all)
  - `ignoreCategories`: categories to skip in CI (e.g., `style`)
- [ ] Add CLI flags: `--fail-on medium`, `--require-consensus 2`
- [ ] Implement policy evaluation after consensus
- [ ] Return structured exit codes: 0 = pass, 1 = blocking findings, 2 = runtime error
- [ ] Add `--soft-fail` flag (always exit 0, but report findings)
- [ ] Print CI summary: "2 blocking findings (policy: severity >= medium, consensus >= 2)"
- [ ] Test: various policy configurations

### 5. `rcl init` Config Scaffolding
- [ ] Add `init` command to CLI
- [ ] Detect available API keys from env vars
- [ ] Interactive prompts: select models, set thresholds, ignore patterns
- [ ] Write `.review-councilrc.json`
- [ ] Add `--github-action` flag to also generate `.github/workflows/rcl.yml`
- [ ] Use `inquirer` or `prompts` for interactive mode
- [ ] Support `--yes` for non-interactive defaults

### 6. GitHub Action
- [ ] Create `action.yml` in repo root
- [ ] Inputs: `models`, `github-token`, `anthropic-key`, `openai-key`, `google-key`, `fail-on`, `post-mode`, `ignore`
- [ ] Action runs: install rcl, run review on `${{ github.event.pull_request }}`, post results
- [ ] Dockerfile or composite action (prefer composite for speed)
- [ ] Add usage example to README
- [ ] Test in a real workflow

---

## Unique Ideas

### 7. Provider Capability Profiles (GPT-5.4)
- [ ] Create `src/dispatch/capabilities.ts`
- [ ] Define `ModelCapabilities` interface: `supportsJSON`, `supportsToolCalling`, `supportsTemperature`, `supportsResponseFormat`, `maxContext`, `maxOutput`
- [ ] Build capability registry keyed by model pattern (regex)
- [ ] Known profiles: o1/o3 (no temp, no response_format), gpt-5.x (completion_tokens), claude (tool_use)
- [ ] Adapters query capabilities instead of hardcoded regex checks
- [ ] Refactor openai.ts temperature/format logic to use capabilities
- [ ] Test: capability lookups for known models

### 8. Real Token Usage Tracking (Opus)
- [ ] Capture `usage` from Anthropic response (`input_tokens`, `output_tokens`)
- [ ] Capture `usage` from OpenAI response (`prompt_tokens`, `completion_tokens`)
- [ ] Capture `usageMetadata` from Google response
- [ ] Add `tokenUsage` field to `ReviewResponse` type
- [ ] Display actual usage in terminal output after review
- [ ] Include in JSON output
- [ ] Compare actual vs estimated in `--estimate` mode

### 9. Review Context Injection (Opus)
- [ ] Add `--context` CLI flag (string)
- [ ] Add `context` field to config schema
- [ ] Inject context into system prompt: "Additional context about this codebase: ..."
- [ ] Prompt builder includes context when present
- [ ] Test: context appears in built prompts

### 10. Disagreement Analysis (GPT-5.4)
- [ ] After consensus, identify findings flagged by only 1 model
- [ ] Identify findings where models disagree on severity
- [ ] Add `disagreements` section to output (terminal, markdown, JSON)
- [ ] Show: "Model A flagged as HIGH security, Model B did not flag"
- [ ] Add `--show-disagreements` flag (default: on in verbose mode)
- [ ] Test: synthetic findings with disagreements

### 11. Budget Controls (GPT-5.4)
- [ ] Add `maxCostPerRun` to config schema (USD, optional)
- [ ] Add `--max-cost` CLI flag
- [ ] Before each chunk dispatch, estimate remaining cost
- [ ] Stop if budget would be exceeded, report partial results
- [ ] Add `--stop-after-findings N` to halt early when enough blocking findings found
- [ ] Test: budget enforcement stops review

### 12. Review Artifact Pipeline (GPT-5.4)
- [ ] Define artifact types: `ResolvedDiff`, `PromptPlan`, `ModelRun`, `ConsensusResult`, `PolicyDecision`
- [ ] Add `--artifacts-dir` CLI flag (default: none, opt-in)
- [ ] Write each stage as JSON to artifacts dir
- [ ] Include: raw model responses, parsed findings, consensus decisions, policy result
- [ ] Enables future: resumability, debugging, hosted sync
- [ ] Test: artifacts written correctly

---

## Implementation Order

Phase 1 (core): 7 → 3 → 2 → 8 → 9
Phase 2 (CI):   4 → 10 → 11 → 12
Phase 3 (ship): 1 → 5 → 6
