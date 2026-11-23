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
Needs:  pip install playwright pypdf   (and a Chromium build Playwright can drive)
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
    DecodedStreamObject,
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
MAX_PAGINATION_PASSES = 4

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
    ("sub",  "",     "The five vowels &middot; consonants that trip you up &middot; stress &middot; false friends", ""),
    ("main", "2",    "Anatomy &amp; Pain Vocabulary",                "ch2"),
    ("sub",  "",     "Head to toe &middot; pain scales &middot; describing symptoms", ""),
    ("main", "3",    "The Admission Interview",                      "ch3"),
    ("sub",  "",     "60 intake questions &middot; allergies &middot; meds &middot; history &middot; social needs", ""),
    ("main", "4",    "Medication Administration",                    "ch4"),
    ("sub",  "",     "Dose, route, timing &middot; side effects &middot; refusal &amp; teach-back", ""),
    ("main", "5",    "Emergency Response Flashcards",                "ch5"),
    ("sub",  "",     "48 fold-over cards &middot; falls &middot; bleeding &middot; breathing &middot; stroke &middot; chest pain", ""),
    ("main", "6",    "Cultural Competency Notes",                    "ch6"),
    ("sub",  "",     "Family &amp; decision-making &middot; health beliefs &middot; respect and register", ""),
    ("main", "7",    "Discharge Instructions",                       "ch7"),
    ("sub",  "",     "Fillable bilingual templates for eight common discharges", ""),
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
    ("sub",  "",     "__GLOSS_EN__ clinical terms &middot; __GLOSS_ES__ things patients say to you", ""),
    ("main", "D",    "Appendix D &mdash; Eight-Week Plan &amp; Progress Log", "apxd"),
]


def glossary_counts() -> tuple[int, int]:
    """Count glossary entries so the TOC never advertises a wrong number."""
    path = next(CONTENT.glob("*appendix-c*.html"), None)
    if path is None:
        return 0, 0
    html = path.read_text(encoding="utf-8")
    en = len(re.findall(r'<p class="g">', html))
    es = len(re.findall(r'<p class="gp">', html))
    return en, es


def render_toc(pages: dict[str, int] | None) -> str:
    en, es = glossary_counts()
    rows = []
    for level, num, title, mark in TOC:
        title = title.replace("__GLOSS_EN__", str(en)).replace("__GLOSS_ES__", str(es))
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
        parts.append(path.read_text(encoding="utf-8"))
        if path.name.startswith("01-"):          # front matter, then the TOC
            parts.append(render_toc(pages))

    body = "\n".join(parts)
    return base.replace("__CSS__", css).replace("__BODY__", body)


# --------------------------------------------------------------------------- #
#  Chromium render
# --------------------------------------------------------------------------- #

def chromium_override() -> str | None:
    """
    Normally Playwright finds its own browser, so return None. Only fall back to
    an explicit binary when the pre-installed build is the one we must use
    (e.g. the pip Playwright version doesn't match the installed browser).
    """
    pinned = Path("/opt/pw-browsers/chromium")
    if pinned.exists():
        return str(pinned.resolve())
    for name in ("chromium", "chromium-browser", "google-chrome"):
        if found := shutil.which(name):
            return found
    return None


def render(html: str, out_pdf: Path) -> None:
    from playwright.sync_api import sync_playwright

    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "workbook.html"
        src.write_text(html, encoding="utf-8")
        with sync_playwright() as p:
            try:
                browser = p.chromium.launch()
            except Exception:
                exe = chromium_override()
                if not exe:
                    raise
                browser = p.chromium.launch(executable_path=exe)
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

def page_annots(page) -> list:
    """/Annots may be an inline array or an indirect reference to one."""
    annots = page.get("/Annots")
    if annots is None:
        return []
    return list(annots.get_object())


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
        for ref in page_annots(page):
            uri = annot_uri(ref.get_object())
            if uri and uri.startswith("tocmark:"):
                found.setdefault(uri.split(":", 1)[1], i)
    return found


def add_obj(writer: PdfWriter, obj):
    """pypdf has kept this private through 6.x; prefer a public name if one appears."""
    fn = getattr(writer, "add_object", None) or writer._add_object
    return fn(obj)


def helvetica() -> DictionaryObject:
    return DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
        NameObject("/Encoding"): NameObject("/WinAnsiEncoding"),
    })


def empty_appearance(writer: PdfWriter, rect: list[float], font_ref) -> object:
    """
    A blank /AP /N stream so viewers that ignore /NeedAppearances (Chrome's
    built-in viewer, macOS Preview, many mobile apps) still render the widget
    and let the user type into it.
    """
    w = abs(rect[2] - rect[0])
    h = abs(rect[3] - rect[1])
    stream = DecodedStreamObject()
    stream.set_data(b"/Tx BMC EMC")
    stream.update({
        NameObject("/Type"): NameObject("/XObject"),
        NameObject("/Subtype"): NameObject("/Form"),
        NameObject("/BBox"): ArrayObject([FloatObject(0), FloatObject(0),
                                          FloatObject(w), FloatObject(h)]),
        NameObject("/Resources"): DictionaryObject({
            NameObject("/Font"): DictionaryObject({NameObject("/Helv"): font_ref})
        }),
    })
    return add_obj(writer, stream)


def convert_links_to_fields(src: Path, dst: Path) -> int:
    """Turn `fillfield:` link annotations into AcroForm text fields, drop `tocmark:`."""
    writer = PdfWriter(clone_from=str(src))

    font_ref = add_obj(writer, helvetica())
    fields: list = []
    taken: set[str] = set()
    default_appearance = TextStringObject("/Helv 0 Tf 0 0 0.35 rg")   # 0 = auto-size

    for page in writer.pages:
        annots = page_annots(page)
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
                name, n = stem, 1
                while name in taken:                      # never collide with a
                    n += 1                                # literal "foo_2" either
                    name = f"{stem}_{n}"
                taken.add(name)

                rect = [float(v) for v in annot["/Rect"]]
                tall = abs(rect[3] - rect[1]) > 30        # multi-line boxes
                widget = DictionaryObject({
                    NameObject("/Type"): NameObject("/Annot"),
                    NameObject("/Subtype"): NameObject("/Widget"),
                    NameObject("/FT"): NameObject("/Tx"),
                    NameObject("/Rect"): ArrayObject([FloatObject(v) for v in rect]),
                    NameObject("/T"): TextStringObject(name),
                    NameObject("/V"): TextStringObject(""),
                    NameObject("/DA"): default_appearance,
                    NameObject("/Ff"): NumberObject(4096 if tall else 0),  # multiline
                    NameObject("/F"): NumberObject(4),          # print
                    NameObject("/P"): page_ref,
                    NameObject("/MK"): DictionaryObject(),      # no border, no fill
                    NameObject("/AP"): DictionaryObject({
                        NameObject("/N"): empty_appearance(writer, rect, font_ref)
                    }),
                })
                widget_ref = add_obj(writer, widget)
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
    writer.root_object[NameObject("/AcroForm")] = add_obj(writer, acro)

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
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(ROOT.parent / "dist"), help="output directory")
    ap.add_argument("--no-fields", action="store_true", help="skip the AcroForm pass")
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    expected = {mark for level, _, _, mark in TOC if level == "main"}

    with tempfile.TemporaryDirectory() as tmp:
        pdf = Path(tmp) / "pass.pdf"
        print("- pass 1: rendering to discover chapter page numbers")
        render(assemble(None), pdf)
        pages = harvest_tocmarks(pdf)
        print(f"  found {len(pages)} of {len(expected)} chapter markers")

        missing = expected - pages.keys()
        if missing:
            print(f"  ! no tocmark found for {sorted(missing)}", file=sys.stderr)
            return 1

        # Re-render until the page numbers printed in the TOC match reality.
        for attempt in range(2, MAX_PAGINATION_PASSES + 2):
            print(f"- pass {attempt}: rendering with the table of contents filled in")
            render(assemble(pages), pdf)
            after = harvest_tocmarks(pdf)
            drift = sorted(k for k in pages if after.get(k) != pages[k])
            if not drift:
                break
            print(f"  ! pagination drifted for {drift}")
            pages = after
        else:
            print("  ! pagination never settled; refusing to write a wrong TOC",
                  file=sys.stderr)
            return 1

        final = out_dir / PDF_NAME
        if args.no_fields:
            shutil.copyfile(pdf, final)
            n = 0
        else:
            print("- final pass: converting markers into fillable form fields")
            n = convert_links_to_fields(pdf, final)

        total = len(PdfReader(str(final)).pages)
        print(f"\n  {final}  -  {total} pages, {n} fillable fields")
    return 0


if __name__ == "__main__":
    sys.exit(main())
