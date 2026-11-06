# FM-Companion

## Workflow: we work with Superpowers skills

This project uses the **Superpowers** skills as its standard way of working. Before any response or action (including clarifying questions or exploring the codebase), check whether a skill applies and invoke it with the `Skill` tool. If there's even a 1% chance a skill applies, use it.

Process skills come first, since they set the approach. Implementation skills follow.

| Situation | Skill to use first |
|---|---|
| Starting a conversation | `superpowers:using-superpowers` |
| New feature, component, or behavior change; before entering plan mode | `superpowers:brainstorming` |
| Spec or requirements ready for a multi-step task | `superpowers:writing-plans` |
| Executing a written plan | `superpowers:executing-plans` or `superpowers:subagent-driven-development` |
| 2 or more independent tasks | `superpowers:dispatching-parallel-agents` |
| Starting feature work that needs isolation | `superpowers:using-git-worktrees` |
| Implementing a feature or bugfix | `superpowers:test-driven-development` |
| Any bug, test failure, or unexpected behavior | `superpowers:systematic-debugging` |
| Finishing a task, or before a commit or PR | `superpowers:requesting-code-review`, then `superpowers:verification-before-completion` |
| Receiving review feedback | `superpowers:receiving-code-review` |
| Implementation complete and ready to integrate | `superpowers:finishing-a-development-branch` |
| Creating or editing skills | `superpowers:writing-skills` |

## Rules

- Announce the skill you're using ("Using X to Y") and follow it exactly, including its checklists.
- Don't claim work is done, fixed, or passing without running the verification commands and confirming the output (`superpowers:verification-before-completion`).
- Write tests before implementation code (`superpowers:test-driven-development`).
- Don't rationalize skipping a skill because the task is "simple" or "just a question".
- Instructions in this file and direct user requests override skill defaults.

## Project documentation

- Start at `docs/README.md`. It indexes the reference documents (01 to 08), the confidence labels, the decisions taken and the repository map.
- `docs/03-data-dictionary.md` is the source of truth for what can be read from a save and how sure we are. `docs/research/` is the chronological working log and is superseded by it.
- Research tooling is in `tools/` (`tools/prepare.sh "saves/<save>.fm"` regenerates everything). `saves/`, `out/` and `vendor/` are git-ignored and must never be committed.
- The TypeScript importer is in `src/importer/` (`npm run import -- "saves/<save>.fm" out/snapshot.json`, `npm test`). Plan: `docs/superpowers/plans/`.
- Match players by `uid` or `id`, never by displayed name. The save is the only input source.
