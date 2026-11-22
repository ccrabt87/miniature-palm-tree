# Medical Spanish for Nurses — A Clinical Communication Workbook

A 97-page fillable, printable PDF workbook for nurses caring for Spanish-speaking
patients, plus the product listing page it is sold from.

| Output | Path |
| --- | --- |
| The workbook | `dist/Medical-Spanish-for-Nurses.pdf` — 97 pages, 356 fillable form fields |
| The listing page | `index.html` → `dist/Listing-Medical-Spanish-for-Nurses.pdf` |

## What's in the book

Front matter (scope and safety, how to use it, contents), twelve chapters and four
appendices:

1. **Sounds First** — vowels, consonants, stress rules, false friends, cognate patterns
2. **Anatomy & Pain Vocabulary** — head to toe, pain quality, the full 0–10 scale sentence
3. **The Admission Interview** — 60 numbered intake questions through SDOH screening
4. **Medication Administration** — forms, routes, timing, side effects, refusal, teach-back
5. **Emergency Response Flashcards** — 24 cut-out cards, 72 phrases
6. **Cultural Competency Notes** — names, register, family decision-making, health beliefs
7. **Discharge Instructions** — eight fillable Spanish discharge templates
8. **Working With Interpreters** — when it is required, how to run the encounter, what to chart
9. **Pediatric & Geriatric Adaptations** — register, diminutives, caregiver questions, dignity
10. **Self-Assessment Quizzes** — five tests, 70 questions
11. **Answer Keys** — every answer with its reasoning
12. **Pocket Reference Card** — 100 phrases, two cut-out sides
- **Appendix A** Everyday bedside Spanish, plus numbers, times and dates
- **Appendix B** Eight scripted bedside dialogues with English gloss
- **Appendix C** Two-way glossary — 270 English→Spanish terms, 70 things patients say to you
- **Appendix D** Eight-week study plan and progress log

A safety line runs through the whole book: it is a bedside communication tool, not an
interpreter qualification. Consent, diagnosis, prognosis, code status and discharge
teaching are marked throughout as requiring a qualified medical interpreter.

## Building

```bash
python3 -m pip install pypdf playwright     # plus a working `cryptography` for pypdf
python3 workbook/build.py                   # writes dist/Medical-Spanish-for-Nurses.pdf
python3 workbook/build.py --no-fields       # skip the AcroForm pass
```

Rendering uses headless Chromium through Playwright. `build.py` locates a browser under
`/opt/pw-browsers` or on `PATH`, so no `playwright install` step is needed in this
environment.

## How the build works

`workbook/content/*.html` are the source of truth — plain HTML fragments, concatenated in
filename order into `workbook/template/base.html` with `workbook/template/print.css`.
Three passes:

1. **Render** to discover which page each chapter landed on. Chapters carry an invisible
   `<a class="tocmark" href="tocmark:ch3">` anchor; Chromium emits these as PDF link
   annotations, which `build.py` reads back.
2. **Re-render** with the table of contents filled in. The TOC is a fixed-height table, so
   pagination does not move; the build verifies that and re-renders once more if it does.
3. **Post-process** with pypdf: every `<a class="fill" href="fillfield:NAME">` link
   annotation becomes a real AcroForm text field at the same rectangle, and the `tocmark`
   annotations are dropped. `/NeedAppearances` is set so readers render typed text.

That link-annotation trick is what makes the blanks genuinely fillable — Chromium cannot
emit form fields itself, but the rectangles it gives links are exact.

### Editing

Edit the HTML in `workbook/content/` and rebuild. To add a fillable blank, use
`<a class="fill w-md" href="fillfield:unique_name"></a>` (`w-sm`, `w-md`, `w-lg`,
`w-full`, and `box-field` for a bordered box). Field names must be unique; duplicates are
automatically suffixed.

## Outstanding production item

The listing advertises an **audio pronunciation guide reached by QR code**. The workbook
is wired for it — the inside back cover has a QR panel placeholder and fillable fields for
the URL and access code, and Chapter 1's practice page refers to it — but the recordings
and the QR image itself are not in this repo and have to be produced and dropped in before
the product ships as described.

## License

All content original. © 2026, all rights reserved. Licensed for personal and individual
professional use; not for redistribution or resale.

Nothing in the workbook is medical advice. Dosing, thresholds and assessment findings in
examples are illustrative only.
