<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent team

Subagents live in `.claude/agents/`. Typical loop: **product-manager** specs a feature → **developer** builds it → **qa** tests it and writes an HTML report → product-manager triages any bugs.

| Agent | File | Owns | Daily task log |
|---|---|---|---|
| product-manager | `.claude/agents/product-manager.md` | `docs/features.md`, `docs/specs/` | `docs/tasks/product-manager.md` |
| developer | `.claude/agents/developer.md` | `src/`, spec "Implementation notes" | `docs/tasks/developer.md` |
| qa | `.claude/agents/qa.md` | `qa/reports/` (HTML; open `qa/reports/index.html`) | `docs/tasks/qa.md` |

A shipping agent will be added once the Supabase backend (F-010) is connected.

Every agent keeps one task-log file: a `## YYYY-MM-DD` heading per day, newest on top, with a checklist it updates as it works.
