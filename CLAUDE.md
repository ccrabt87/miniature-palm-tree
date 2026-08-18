# CLAUDE.md

Guidance for Claude Code (claude.ai/code) and other AI assistants working in this repository.

## Current state of the repository

**This repository is currently empty.** As of the last update to this file, the
entire tracked contents are:

```
README.md    # a single line: "# miniature-palm-tree"
```

There is no source code, no build system, no dependency manifest, no test suite,
no linter or formatter configuration, and no CI workflow. `main` contains one
commit ("Initial commit") that adds `README.md`.

Do not assume a language, framework, or directory layout — none has been chosen
yet. If you are asked to "run the tests", "build the project", or "follow the
existing conventions", the correct answer is that these do not exist yet. Say so
and ask what the project should be, rather than guessing.

## Working in an empty repository

When adding the first real code, these decisions have not been made and should be
confirmed with the user rather than assumed:

- Language and runtime, and the version to target
- Package manager and dependency manifest
- Directory layout (e.g. `src/` vs. a flat root)
- Test framework and how tests are invoked
- Lint/format tooling
- Whether CI should be set up (`.github/workflows/`)

Once the first of these is established, **update this file in the same change**
so the next session starts with accurate information. The sections below are
placeholders that exist to be filled in — an out-of-date CLAUDE.md is worse than
a short one.

## Commands

_None yet._ There is nothing to build, run, test, or lint.

When commands exist, record them here with the exact invocation, including how to
run a **single** test — that is the command assistants need most often and the
one hardest to infer.

## Architecture

_None yet._

When there is code, describe the parts that are not obvious from reading a single
file: how modules depend on one another, where the entry points are, where state
lives, and any non-standard patterns a newcomer would trip over. Skip anything a
`ls` or a glance at one file already makes clear.

## Conventions

_None yet._ There is no existing code to match.

## Git workflow

- The default branch is `main`.
- Do work on a feature branch, not directly on `main`. Sessions driven by the
  Claude GitHub integration are given an explicit branch name to develop on and
  must push only to that branch.
- Push with `git push -u origin <branch-name>`. On network failures, retry a few
  times with exponential backoff.
- Only open a pull request when the user explicitly asks for one.
- If the pull request for a designated branch has already been merged, do not
  stack new commits on the merged history. Reset the branch from the latest
  `main` (`git fetch origin main && git checkout -B <branch> origin/main`) and
  push the follow-up work as a new pull request.
- There is no PR template in this repository.

## Environment notes

Sessions may run in an ephemeral remote container that clones the repository
fresh at startup and is reclaimed afterward. Anything worth keeping must be
committed and pushed before the session ends.
