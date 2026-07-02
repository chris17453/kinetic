---
name: autonomous-loop
description: Use for Kinetic implementation, debugging, cleanup, and verification tasks where Codex should keep iterating until the task is complete or blocked.
---

# Autonomous Kinetic Loop

Use this workflow when the user asks Codex to implement, fix, debug, review, clean up, or verify work in this repository.

1. Restate the concrete outcome and success criteria internally.
2. Inspect relevant files before editing.
3. For broad exploration or docs lookup, spawn `research-mini` if available and wait for a concise summary.
4. Make a short plan for non-trivial changes.
5. Edit only the files needed for the requested outcome.
6. Run the narrowest useful verification command.
7. If verification fails, inspect the failure, fix it, and rerun the relevant check.
8. Escalate only when blocked by missing credentials, unavailable services, destructive actions, or ambiguous product requirements.

Prefer repository commands from `AGENTS.md` and `Makefile`.

Do not use this skill for pure brainstorming, architecture discussion, or cases where the user explicitly asks for no code changes.
