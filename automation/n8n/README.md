# n8n control plane for the monthly redesign

n8n learns from how redesign PRs are reviewed, and answers typed decisions from a local CPU model.
The redesign runner keeps the agent work. n8n holds the feedback loop and the decision log.

```
GitHub PRs ──gh (SSH to host)──▶ PR review learner ──▶ decider (CPU) ──▶ Data Table: redesign_reviews
                                                                               │
redesign runner ──GET /webhook/redesign-feedback───────────────────────────────┘
redesign runner ──POST /webhook/decide──▶ decide gateway ──▶ decider ──▶ Data Table: decisions
```

## Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `pr-review-learner` | every hour, `POST /webhook/redesign-reviews/sync`, manual | Lists closed `redesign/*` PRs with `gh`. Picks PRs never classified, or updated (e.g. a new review comment) after their last decision. Reads the owner's review comments, asks the decider typed questions, applies code rules, and upserts one row per PR. |
| `feedback-api` | `GET /webhook/redesign-feedback` | Returns `avoid_styles`, `lessons`, `rejected`, `accepted` and `needs_review` for the runner. |
| `decide-gateway` | `POST /webhook/decide` | TypeSafe System One request in, averaged answer out. Logs every decision for later calibration. |
| `setup-data-tables` | `POST /webhook/setup-redesign-tables` | Creates both data tables if they do not exist. |
| `alerts` | `POST /webhook/redesign-alert`; monthly on the 2nd at 06:00 UTC | Posts `{level, title, message, url}` to Discord. The monthly check alerts when no redesign PR exists for the month, or when it is only a draft. The runner (failure, PR ready) and the weekly probe call the webhook. |

Every webhook requires the header `x-redesign-token` (credential "Redesign webhook token"). The runner reads the same secret as `N8N_WEBHOOK_TOKEN` from its env file.

### How a PR becomes a row

1. **State, not prose.** The learner sends structured state: files changed, additions, the owner's comments, and whether a later PR with the same style was merged.
2. **Typed questions.** One `choice` for the main reason (`pipeline-failure`, `superseded`, `test-run`, `broken-layout`, `unreadable`, `style-disliked`, `too-similar`, `no-reason`). Then one `noul` (yes/no) per signal the pipeline acts on: `says_too_similar`, `says_quality_problem`, `avoid_style`.
3. **Code decides.** `Decide (code rules)` turns probabilities into `avoid`, `lesson` and `needs_review` with named thresholds. A single choice keeps only one reason. A review can give several, so the yes/no questions carry the signals.

### The decide gateway

```bash
curl -s -X POST http://127.0.0.1:5678/webhook/decide \
  -H 'content-type: application/json' -H 'x-requested-by: runner' \
  -d '{"state": {...}, "questions": {"pick": {"type": "choice", "instructions": "...", "criteria": {"a": "...", "b": "..."}}}, "debias": 3}'
```

`debias` (1–3) asks each choice again with its options rotated and averages the runs. Small models favour some option positions, and this needs no labelled data.

## The decider service

`decider/` wraps [Mapika/decider](https://github.com/Mapika/decider) (Apache-2.0), an open model family that copies TypeSafe Jev's API. The upstream server loads full-precision weights (about 8 GB for the 2B on CPU), so this wrapper serves the quantized GGUF files through `decider.infer.Decider` and keeps the `/v1/systemone` wire format.

Measured on the host (AMD EPYC Genoa, 4 vCPU, `llama.cpp` built with `GGML_NATIVE`):

| Model | ~260-token input | ~775-token input | RAM | "can't read it" review → avoid style |
|---|---|---|---|---|
| `decider-4b-v2.1-Q4_K_M` (default) | 6–7 s | 45 s | 3.4 GB | 0.91 |
| `decider-2b-v11-Q4_K_M` | 2.5 s | 18 s | 1.7 GB | 0.43 |

Input length drives latency (about 17 tokens/s of prompt on this CPU). Keep state short: the learner sends only the owner's comments, not deploy-bot comments.

## Setup

Requirements: Docker with Compose, `gh` logged in on the host, sshd reachable from the Docker network.

```bash
cd automation/n8n
cp docker-compose.override.example.yml docker-compose.override.yml   # Tailscale address + hostname; edit to match
# DECIDER_REPO / DECIDER_GGUF / DECIDER_THREADS choose the decision model (default 4B Q4_K_M, 4 threads)
docker compose up -d --build        # first decider start downloads the 2.7 GB model
# open http://<N8N_HOST>:5678 and create the owner account
scripts/create-ssh-credential.sh    # SSH key for gh on the host, allowed from the n8n network only
scripts/create-webhook-token.sh     # webhook secret: n8n credential + N8N_WEBHOOK_TOKEN in the runner env
scripts/create-discord-credential.sh < discord-webhook-url.txt   # alert channel
scripts/deploy-workflows.sh         # import + publish workflows, create data tables
T=$(cat ~/n8n/secrets/webhook-token)
curl -s -H "x-redesign-token: $T" -X POST http://127.0.0.1:5678/webhook/redesign-reviews/sync >/dev/null   # first backfill
curl -s -H "x-redesign-token: $T" http://127.0.0.1:5678/webhook/redesign-feedback
```

## Gotchas found while building this

- A CLI `n8n execute` run cannot use Data Tables ("the module is disabled"). Trigger setup through a webhook on the running server instead.
- Workflows activated with `n8n publish:workflow` register their triggers only after a restart.
- n8n's expression sandbox blocks any property named `caller`. Use another name.
- A `lastNode` webhook answers HTTP 500 "No item to return was found" when the run ends with no items (for example, no PR needs re-classifying). The execution still succeeds; callers of `/redesign-reviews/sync` ignore the status and only wait for it to finish.
- The HTTP Request node sends all items at once by default. The decider scores one request at a time, so the node uses batching with a batch size of 1. Otherwise the queue outlasts the timeout.
