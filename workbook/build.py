#!/usr/bin/env python3
"""
Build the Medical Spanish for Nurses workbook PDF.

Pipeline
--------
1.  Assemble  template/base.html  +  every file in  content/  (sorted) into a
    single print-ready HTML document.
2.  Render it to PDF with headless Chromium (via Playwright).
3.  Read back the link annotations Chromium emitted:
      * href="tocmark:<id>"   -> tells us which page a chapter landed on, so the
                                 table of contents can be filled in and the book
                                 re-rendered with real page numbers.
      * href="fillfield:<id>" -> converted into a real AcroForm text field at the
                                 same rectangle, which is what makes the PDF
                                 fillable on screen as well as printable.
4.  Write dist/Medical-Spanish-for-Nurses.pdf

Usage:  python3 workbook/build.py [--out DIR] [--no-fields]
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
import tempfile
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    BooleanObject,
    DictionaryObject,
    FloatObject,
    NameObject,
    NumberObject,
    TextStringObject,
)

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
TEMPLATE = ROOT / "template"

PDF_NAME = "Medical-Spanish-for-Nurses.pdf"

FOOTER = """
<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7pt;
            color:#8a8aa0;padding:0 0.7in;display:flex;justify-content:space-between;">
  <span>Medical Spanish for Nurses &mdash; A Clinical Communication Workbook</span>
  <span class="pageNumber"></span>
</div>
"""

EMPTY = '<div style="display:none"></div>'


# --------------------------------------------------------------------------- #
#  Table of contents
# --------------------------------------------------------------------------- #

# (level, number-label, title, tocmark id)
TOC: list[tuple[str, str, str, str]] = [
    ("main", "",     "How to Use This Workbook",                     "how-to-use"),
    ("main", "1",    "Sounds First: Spanish Pronunciation for Clinicians", "ch1"),
    ("sub",  "",     "The five vowels &middot; consonants that trip you up &middot; stress", ""),
    ("main", "2",    "Anatomy &amp; Pain Vocabulary",                "ch2"),
    ("sub",  "",     "Head to toe &middot; pain scales &middot; describing symptoms", ""),
    ("main", "3",    "The Admission Interview",                      "ch3"),
    ("sub",  "",     "60 intake questions &middot; allergies &middot; meds &middot; history &middot; SDOH", ""),
    ("main", "4",    "Medication Administration",                    "ch4"),
    ("sub",  "",     "Dose, route, timing &middot; side effects &middot; refusal &amp; teach-back", ""),
    ("main", "5",    "Emergency Response Flashcards",                "ch5"),
    ("sub",  "",     "Codes &middot; falls &middot; bleeding &middot; respiratory distress &middot; stroke", ""),
    ("main", "6",    "Cultural Competency Notes",                    "ch6"),
    ("sub",  "",     "Family &amp; decision-making &middot; health beliefs &middot; respect and register", ""),
    ("main", "7",    "Discharge Instructions",                       "ch7"),
    ("sub",  "",     "Fillable templates for eight common discharges", ""),
    ("main", "8",    "Working With Interpreters",                    "ch8"),
    ("sub",  "",     "When you must call one &middot; how to run the encounter &middot; documentation", ""),
    ("main", "9",    "Pediatric &amp; Geriatric Adaptations",        "ch9"),
    ("sub",  "",     "Talking to children and caregivers &middot; aging, hearing, dignity", ""),
    ("main", "10",   "Self-Assessment Quizzes",                      "ch10"),
    ("sub",  "",     "Five chapter tests, 70 questions", ""),
    ("main", "11",   "Answer Keys",                                  "ch11"),
    ("main", "12",   "Pocket Reference Card &mdash; 100 Clinical Phrases", "ch12"),
    ("main", "A",    "Appendix A &mdash; Everyday Bedside Spanish",   "apxa"),
    ("sub",  "",     "The shift &middot; meals &middot; hygiene &middot; mobility &middot; lines &middot; tests &middot; nights", ""),
    ("main", "B",    "Appendix B &mdash; Eight Bedside Dialogues",    "apxb"),
    ("main", "C",    "Appendix C &mdash; Two-Way Glossary",           "apxc"),
    ("sub",  "",     "270 clinical terms &middot; 70 things patients say to you", ""),
    ("main", "D",    "Appendix D &mdash; Eight-Week Plan &amp; Progress Log", "apxd"),
]


def render_toc(pages: dict[str, int] | None) -> str:
    rows = []
    for level, num, title, mark in TOC:
        if level == "sub":
            rows.append(
                f'<tr class="sub"><td class="n"></td>'
                f'<td class="t">{title}</td><td class="pg"></td></tr>'
            )
            continue
        pg = ""
        if pages is not None and mark in pages:
            pg = str(pages[mark])
        rows.append(
            f'<tr><td class="n">{num}</td><td class="t">{title}</td>'
            f'<td class="pg">{pg}</td></tr>'
        )
    return (
        '<section class="chapter" id="toc">\n'
        '<p class="chapter-num">Contents</p>\n'
        '<h1 class="chapter-title">What&rsquo;s Inside</h1>\n'
        '<table class="toc">\n' + "\n".join(rows) + "\n</table>\n"
        "</section>\n"
    )


# --------------------------------------------------------------------------- #
#  HTML assembly
# --------------------------------------------------------------------------- #

def assemble(pages: dict[str, int] | None) -> str:
    css = (TEMPLATE / "print.css").read_text(encoding="utf-8")
    base = (TEMPLATE / "base.html").read_text(encoding="utf-8")

    parts: list[str] = []
    for path in sorted(CONTENT.glob("*.html")):
        html = path.read_text(encoding="utf-8")
        parts.append(html)
        if path.name.startswith("01-"):          # front matter, then the TOC
            parts.append(render_toc(pages))

    body = "\n".join(parts)
    return base.replace("__CSS__", css).replace("__BODY__", body)


# --------------------------------------------------------------------------- #
#  Chromium render
# --------------------------------------------------------------------------- #

def find_chromium() -> str | None:
    for pattern in ("chromium-*/chrome-linux/chrome",
                    "chromium_headless_shell-*/chrome-linux/*"):
        for cand in sorted(Path("/opt/pw-browsers").glob(pattern), reverse=True):
            if cand.is_file():
                return str(cand)
    return shutil.which("chromium") or shutil.which("google-chrome")


def render(html: str, out_pdf: Path) -> None:
    from playwright.sync_api import sync_playwright

    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "workbook.html"
        src.write_text(html, encoding="utf-8")
        with sync_playwright() as p:
            kwargs = {}
            exe = find_chromium()
            if exe:
                kwargs["executable_path"] = exe
            browser = p.chromium.launch(**kwargs)
            page = browser.new_page()
            page.goto(src.as_uri(), wait_until="networkidle")
            page.pdf(
                path=str(out_pdf),
                format="Letter",
                print_background=True,
                display_header_footer=True,
                header_template=EMPTY,
                footer_template=FOOTER,
                margin={"top": "0.75in", "bottom": "0.85in",
                        "left": "0.7in", "right": "0.7in"},
            )
            browser.close()


# --------------------------------------------------------------------------- #
#  Annotation harvesting / rewriting
# --------------------------------------------------------------------------- #

def annot_uri(annot: DictionaryObject) -> str | None:
    action = annot.get("/A")
    if action is None:
        return None
    uri = action.get_object().get("/URI")
    return str(uri) if uri is not None else None


def harvest_tocmarks(pdf: Path) -> dict[str, int]:
    """Map tocmark id -> 1-based page number."""
    reader = PdfReader(str(pdf))
    found: dict[str, int] = {}
    for i, page in enumerate(reader.pages, start=1):
        for ref in page.get("/Annots") or []:
            uri = annot_uri(ref.get_object())
            if uri and uri.startswith("tocmark:"):
                found.setdefault(uri.split(":", 1)[1], i)
    return found


def helvetica() -> DictionaryObject:
    return DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
        NameObject("/Encoding"): NameObject("/WinAnsiEncoding"),
    })


def convert_links_to_fields(src: Path, dst: Path) -> int:
    """Turn `fillfield:` link annotations into AcroForm text fields, drop `tocmark:`."""
    writer = PdfWriter(clone_from=str(src))

    font_ref = writer._add_object(helvetica())
    fields: list = []
    used: dict[str, int] = {}
    default_appearance = TextStringObject("/Helv 9 Tf 0 0 0.35 rg")

    for page in writer.pages:
        annots = page.get("/Annots")
        if not annots:
            continue
        kept = ArrayObject()
        page_ref = page.indirect_reference
        for ref in annots:
            annot = ref.get_object()
            uri = annot_uri(annot)

            if uri and uri.startswith("tocmark:"):
                continue                                  # invisible marker, discard

            if uri and uri.startswith("fillfield:"):
                stem = re.sub(r"[^A-Za-z0-9_.-]", "_", uri.split(":", 1)[1]) or "field"
                used[stem] = used.get(stem, 0) + 1
                name = stem if used[stem] == 1 else f"{stem}_{used[stem]}"

                rect = [FloatObject(float(v)) for v in annot["/Rect"]]
                widget = DictionaryObject({
                    NameObject("/Type"): NameObject("/Annot"),
                    NameObject("/Subtype"): NameObject("/Widget"),
                    NameObject("/FT"): NameObject("/Tx"),
                    NameObject("/Rect"): ArrayObject(rect),
                    NameObject("/T"): TextStringObject(name),
                    NameObject("/V"): TextStringObject(""),
                    NameObject("/DA"): default_appearance,
                    NameObject("/Ff"): NumberObject(0),
                    NameObject("/F"): NumberObject(4),          # print
                    NameObject("/P"): page_ref,
                    NameObject("/MK"): DictionaryObject(),      # no border, no fill
                })
                widget_ref = writer._add_object(widget)
                fields.append(widget_ref)
                kept.append(widget_ref)
                continue

            kept.append(ref)

        page[NameObject("/Annots")] = kept

    acro = DictionaryObject({
        NameObject("/Fields"): ArrayObject(fields),
        NameObject("/DA"): default_appearance,
        NameObject("/NeedAppearances"): BooleanObject(True),
        NameObject("/DR"): DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/Helv"): font_ref})}
        ),
    })
    writer._root_object[NameObject("/AcroForm")] = writer._add_object(acro)

    writer.add_metadata({
        "/Title": "Medical Spanish for Nurses - A Clinical Communication Workbook",
        "/Subject": "Clinical Spanish communication reference and workbook for nurses",
        "/Keywords": "medical Spanish, nursing, patient communication, interpreter, workbook",
        "/Creator": "workbook/build.py",
    })

    with open(dst, "wb") as fh:
        writer.write(fh)
    return len(fields)


# --------------------------------------------------------------------------- #

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default=str(ROOT.parent / "dist"), help="output directory")
    ap.add_argument("--no-fields", action="store_true", help="skip the AcroForm pass")
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        pass1 = Path(tmp) / "pass1.pdf"
        print("- pass 1: rendering to discover chapter page numbers")
        render(assemble(None), pass1)

        pages = harvest_tocmarks(pass1)
        print(f"  found {len(pages)} chapter markers")

        pass2 = Path(tmp) / "pass2.pdf"
        print("- pass 2: rendering with the table of contents filled in")
        render(assemble(pages), pass2)

        # Chapter positions must not have moved; the TOC is a fixed-height table.
        after = harvest_tocmarks(pass2)
        drift = {k for k, v in pages.items() if after.get(k) != v}
        if drift:
            print(f"  ! pagination drifted for {sorted(drift)} - re-rendering once more")
            pages = after
            render(assemble(pages), pass2)

        final = out_dir / PDF_NAME
        if args.no_fields:
            shutil.copyfile(pass2, final)
            n = 0
        else:
            print("- pass 3: converting markers into fillable form fields")
            n = convert_links_to_fields(pass2, final)

        total = len(PdfReader(str(final)).pages)
        print(f"\n  {final}  -  {total} pages, {n} fillable fields")
    return 0


if __name__ == "__main__":
    sys.exit(main())
