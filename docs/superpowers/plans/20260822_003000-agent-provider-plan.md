# Implementation Plan: Multi-Provider Agent Support

See the active working plan at `tasks/plan.md` and the task checklist at `tasks/todo.md` for full implementation details.

## Summary

Add a provider abstraction so JheckBot conversations can run against Devin, Claude Code, Codex, Gemini CLI, or a custom binary. The plan is split into three phases:

1. **Foundation**: define the `AgentAdapter` interface, refactor `DevinAdapter` to implement it, add provider persistence, and expose provider-aware API endpoints.
2. **Routing and UI**: wire `AgentManager` and `PromptExecutionService` to the conversation's provider, update health checks, and add a provider selector to the chat composer and project page.
3. **Adapters and QA**: implement Claude Code, Codex, Gemini CLI, and custom adapters, then run the full test/build/lint suite and produce a QA report.

## Key files

- `tasks/plan.md`
- `tasks/todo.md`
- `docs/superpowers/specifications/20260822_003000-agent-provider-design.md`
