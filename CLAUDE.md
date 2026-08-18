# CLAUDE.md

Guidance for Claude Code (claude.ai/code) and other AI assistants working in this
repository.

## The one thing to know first

**`main` is empty.** It contains a single commit ("Initial commit") whose entire
tracked contents are:

```
README.md    # one line: "# miniature-palm-tree"
```

All real work in this repository lives on **unmerged feature branches**. Nothing
has ever been merged into `main`. A fresh checkout of `main` (or of any branch cut
from it, including most `claude/*` branches) will look completely empty — that is
expected, not a broken clone.

Consequences for any session that starts here:

- There is no build system, no dependency manifest at the root, no test suite, no
  linter or formatter config, and no CI workflow (no `.github/` on any branch).
- If asked to "run the tests", "build the project", or "follow the existing
  conventions", the honest answer is that none exist repo-wide. Per-branch
  projects have their own ad-hoc commands, listed below.
- Do not infer a language or layout for new work from the branch you happen to be
  on. Ask, or pick something self-contained and say what you picked.

## What this repository actually is

A scratchpad for **small, standalone, self-contained projects** — each one a
separate branch, each with its own README and no shared tooling. The projects to
date are single-file-ish deliverables meant to be shipped somewhere else (itch.io,
Etsy, a browser) rather than assembled into one application.

Common characteristics across every project here:

- **Zero external dependencies.** Vanilla JS/HTML/CSS on the web side; Python
  standard library only on the Python side.
- **No build step.** Files are opened or run directly.
- **Self-documenting.** Each project ships a README (sometimes a QUICKSTART or
  CHANGELOG) covering setup, usage, and deployment.
- **Emoji-rich, user-facing prose** in READMEs and console output.

Match that style when adding to an existing branch. Prefer it for new work here
too unless the user asks for something else.

## Branch inventory

Because `main` is empty, this is the closest thing the repository has to a
directory structure. Check `git log --oneline origin/<branch>` before assuming any
of it is current.

### `origin/copilot/add-ai-agent-tutoring` — K-12 tutoring agent (Python)

Largest project in the repository. Pure standard library, Python 3.7+.

| File | Purpose |
| --- | --- |
| `k12_tutor.py` | Everything: enums, dataclasses, `K12TutorAgent`, `TutorModal` (~528 lines) |
| `examples.py` | Runnable demos; takes mode `1`-`4` as argv or prompts |
| `test_k12_tutor.py` | Tests |
| `QUICKSTART.md`, `README.md` | Docs |
| `requirements.txt` | Deliberately all-comments — no dependencies are installed |

Commands:

```bash
python k12_tutor.py            # runs the built-in demo in main()
python examples.py 3           # feature demo; 1=interactive, 2=quick practice
python test_k12_tutor.py       # runs all tests, exits non-zero on failure
```

**There is no pytest.** `test_k12_tutor.py` defines plain `test_*()` functions and
a hand-written `run_all_tests()` runner that catches `AssertionError`, prints
`✓`/`✗` lines, and returns an exit code. To run a *single* test, call it directly:

```bash
python -c "import test_k12_tutor as t; t.test_start_session()"
```

If you add a test, you must also append it to the `tests` list in
`run_all_tests()` — nothing discovers it automatically.

Architecture notes worth knowing before editing `k12_tutor.py`:

- `GradeLevel`, `Subject`, `DifficultyLevel` are `Enum`s; `TutoringSession` and
  `Question` are `@dataclass`es. Pass enum members, not strings.
- The question bank is built in `_initialize_question_bank()` and keyed by
  category strings like `"math_elementary"` — these keys are the API surface
  callers use with `ask_question()`, so renaming one breaks tests and examples.
- `K12TutorAgent` holds a single `current_session`; `start_session()` replaces it.
  Progress tracking (`questions_asked`, `correct_answers`) lives on that session
  object and is lost when it is replaced.
- `TutorModal` is presentation only — it formats strings for a text UI and holds
  no tutoring logic. Keep that split.

### `origin/claude/monetize-dice-roller-O5ToR` — Zeros to Heroes dice roller (web)

Vanilla JS/HTML/CSS browser app for a TTRPG, packaged for itch.io. Files:
`index.html`, `app.js` (~568 lines), `styles.css`, plus `README.md`,
`CHANGELOG.md`, `ITCH_PAGE_DESCRIPTION.md`.

Commands: none. Open `index.html` in a browser. Deployment is uploading those
three files to itch.io as an HTML project (the README documents the full flow).

Architecture notes:

- `app.js` is one flat script organized by banner comments
  (`// ===` CONFIGURATION, ITCH.IO INTEGRATION, PERSISTENCE, DICE ROLLING LOGIC,
  HISTORY, PROBABILITY, PRESETS, ANALYTICS, EXPORT, EVENT LISTENERS). Keep new
  code inside the matching section rather than appending to the bottom.
- Module-level mutable state: `rollHistory`, `presets`, `isPremium`. DOM handles
  are cached in `const`s near the event-listener section.
- The dice mechanic ("tryptych") is three d6, one per axis, each with its own
  modifier: Stat (-5..+5), Context (-3..+3), Symbolic (-2..+3). The sum is
  bucketed by `OUTCOME_BANDS` into Miss / Strained / Clean / Surpassing Success.
  `OUTCOME_BANDS` is the single source of truth for thresholds — the probability
  calculator and analytics both read it, so edit it there and nowhere else.
- Persistence is `localStorage` under the keys `zth_premium`, `zth_history`,
  `zth_presets`.
- **Monetization gating is client-side and advisory.** `checkItchPurchase()` asks
  the itch.io JS API (`Itch.getPurchaseStatus()`) and falls back to the
  `zth_premium` localStorage flag, which the UI itself can set for testing. Every
  premium feature sits behind an `isPremium` check in the same file the user
  downloads; treat it as an honor system, and do not describe it to the user as
  enforcement.

### `origin/claude/attachment-style-tarot-page-ags73e` — Attachment Style Tarot (web/PDF)

A single self-contained `attachment-style-tarot.html` (~192 lines, all CSS
inlined in `<style>`, no JS, no assets) plus a `attachment-style-tarot.pdf` export
for an Etsy listing. Editorial/landing-page content. Open the HTML directly; the
PDF is the shipped artifact.

### `origin/claude/claude-md-documentation-osuteg`

An earlier CLAUDE.md, written when the branch inventory above did not exist and
describing the repository as simply empty. This file supersedes it. If both ever
land, keep this one.

## Conventions

There is no repo-wide style config to defer to, so match the file you are editing:

- **Python:** type hints on public methods, docstrings on every class and method,
  `Enum` over string constants, `@dataclass` for records, 4-space indent.
- **JavaScript:** plain functions and `const`/`let`, no framework, no modules or
  bundler; `// ===` banner comments to separate concerns; `document.getElementById`
  handles cached once at the bottom.
- **CSS:** custom properties on `:root` for the palette (e.g. `--hero-gold`);
  responsive, mobile-friendly layouts.
- **Docs:** every project gets a README that a non-developer could follow end to
  end, including how to deploy or publish it.

Do not introduce a package manager, bundler, framework, or CI workflow without
asking — the no-dependencies property is the most consistent decision visible in
this repository, and it is what makes these projects droppable onto itch.io or
openable from disk.

## Git workflow

- The default branch is `main`.
- Work on a feature branch, never directly on `main`. Sessions driven by the
  Claude GitHub integration are handed an explicit branch name and must push only
  to that branch.
- Branch names follow `claude/<slug>-<suffix>` (or `copilot/<slug>` for GitHub
  Copilot's work). One project per branch.
- Push with `git push -u origin <branch-name>`; on network failures retry a few
  times with exponential backoff.
- Only open a pull request when the user explicitly asks for one. There is no PR
  template in this repository.
- If the pull request for a designated branch has already been merged, do not
  stack new commits on the merged history. Reset the branch from the latest `main`
  (`git fetch origin main && git checkout -B <branch> origin/main`) and push the
  follow-up as a new pull request.
- Branches here are long-lived and unmerged. Before continuing someone's work,
  `git fetch origin` and read that branch's own README — it is authoritative for
  that project.

## Environment notes

Sessions may run in an ephemeral remote container that clones the repository fresh
at startup and is reclaimed afterward. Anything worth keeping must be committed and
pushed before the session ends.

## Keeping this file honest

When a project lands, is merged into `main`, or gains real tooling, update this
file in the same change. An out-of-date CLAUDE.md is worse than a short one — the
statement "`main` is empty" in particular must be corrected the moment it stops
being true.
