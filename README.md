# miniature-palm-tree
## Medical Spanish for Nurses — workbook

A 73-page, fillable, print-ready PDF workbook: pronunciation, anatomy and pain,
a 60-question admission interview, medication safety, 48 emergency flashcards,
cultural notes, 8 bilingual discharge templates, interpreter rules, pediatric and
geriatric adaptations, 70 quiz questions with keys, a 100-phrase pocket card and
a two-way glossary.

- Finished PDF: `dist/Medical-Spanish-for-Nurses.pdf`
- Content: `workbook/content/*.html` (assembled in filename order)
- Styling: `workbook/template/print.css`

Rebuild:

```bash
pip install -r workbook/requirements.txt
python3 workbook/build.py            # -> dist/Medical-Spanish-for-Nurses.pdf
```

The build renders twice so the table of contents shows real page numbers, then
turns every `<a class="fill" href="fillfield:NAME">` into an AcroForm text field.
