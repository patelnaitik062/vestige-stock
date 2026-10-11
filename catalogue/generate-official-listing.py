"""Generate a printable official Vestige product listing with compatible setup QRs."""

from __future__ import annotations

import json
import sys
from io import BytesIO
from pathlib import Path

import qrcode
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "catalogue" / "vestige-products-current.json"


def money(value: object) -> str:
    if value is None or value == "":
        return "—"
    try:
        return f"₹{float(value) / 100:,.2f}".rstrip("0").rstrip(".")
    except (TypeError, ValueError):
        return str(value)


def qr_image(payload: str) -> Image:
    qr = qrcode.QRCode(box_size=4, border=1)
    qr.add_data(payload)
    qr.make(fit=True)
    stream = BytesIO()
    qr.make_image(fill_color="black", back_color="white").save(stream, format="PNG")
    stream.seek(0)
    return Image(stream, width=15 * mm, height=15 * mm)


def footer(canvas, document, retrieved: str) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#555555"))
    canvas.drawString(12 * mm, 8 * mm, f"Source: official Vestige India public catalogue API | Retrieved {retrieved}")
    canvas.drawRightString(285 * mm, 8 * mm, f"Page {document.page}")
    canvas.restoreState()


def build() -> None:
    snapshot = json.loads(SOURCE.read_text(encoding="utf-8-sig"))
    records = snapshot["products"]
    retrieved = snapshot["fetchedAt"][:10]
    output = ROOT / f"Vestige-Official-Product-Listing-{retrieved}.pdf"
    styles = getSampleStyleSheet()
    title = ParagraphStyle("ListingTitle", parent=styles["Title"], alignment=TA_CENTER, fontSize=18, leading=22)
    intro = ParagraphStyle("Intro", parent=styles["BodyText"], fontSize=9, leading=12)
    cell = ParagraphStyle("Cell", parent=styles["BodyText"], fontSize=6.5, leading=8)
    head = ParagraphStyle("Head", parent=cell, textColor=colors.white, alignment=TA_CENTER)

    document = SimpleDocTemplate(
        str(output),
        pagesize=landscape(A4),
        rightMargin=8 * mm,
        leftMargin=8 * mm,
        topMargin=10 * mm,
        bottomMargin=13 * mm,
        title="Vestige Official Product Listing",
        author="Vestige Stock",
    )
    story = [
        Spacer(1, 22 * mm),
        Paragraph("Vestige Official Product Listing", title),
        Spacer(1, 8 * mm),
        Paragraph(
            f"<b>{len(records)} unique products</b> from the public India catalogue API "
            f"(location WHMP1; retrieved {retrieved}). Values are shown exactly as returned by the official API. "
            "MRP is tax-inclusive; DP means unit price; distributor price, PV, BV, GST, HSN, "
            "pack and category are included from the dated snapshot. "
            "<b>NC is not exposed by the public API and is shown as unavailable.</b> "
            "The QR in each row contains the app-compatible setup payload "
            "<b>VSCAT:&lt;product-code&gt;</b>; it is not a physical pack barcode.",
            intro,
        ),
        Spacer(1, 8 * mm),
        Paragraph("Official catalogue endpoint: https://apiv2.veston.in/api/mc/item/getItemListByMultipleFilterWeb", intro),
        PageBreak(),
    ]

    headers = ["QR", "Code", "Product", "Pack", "Category", "MRP", "DP", "Distributor", "PV", "BV", "GST", "HSN", "NC"]
    widths = [18 * mm, 16 * mm, 48 * mm, 18 * mm, 31 * mm, 18 * mm, 18 * mm, 22 * mm, 14 * mm, 17 * mm, 12 * mm, 20 * mm, 14 * mm]
    rows_per_page = 8
    for start in range(0, len(records), rows_per_page):
        rows = [[Paragraph(header, head) for header in headers]]
        for record in records[start:start + rows_per_page]:
            code = str(record.get("code") or "—")
            product = str(record.get("name") or "—")
            pack = str(record.get("pack") or "—")
            category = str(record.get("category") or "—")
            gst = record.get("gstBps")
            rows.append([
                qr_image(f"VSCAT:{code}"),
                Paragraph(code, cell),
                Paragraph(product, cell),
                Paragraph(pack, cell),
                Paragraph(category, cell),
                Paragraph(money(record.get("mrp")), cell),
                Paragraph(money(record.get("dp")), cell),
                Paragraph(money(record.get("distributorPrice")), cell),
                Paragraph(money(record.get("pv")), cell),
                Paragraph(money(record.get("bv")), cell),
                Paragraph(f"{gst / 100:g}%" if gst is not None else "—", cell),
                Paragraph(str(record.get("hsn") or "—"), cell),
                Paragraph("Unavailable", cell),
            ])
        table = Table(rows, colWidths=widths, repeatRows=1, rowHeights=[17 * mm] + [18 * mm] * (len(rows) - 1))
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7b1e1e")),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#aaaaaa")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (1, -1), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8f1f1")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ]))
        story.append(table)
        if start + rows_per_page < len(records):
            story.append(PageBreak())

    document.build(
        story,
        onFirstPage=lambda canvas, doc: footer(canvas, doc, retrieved),
        onLaterPages=lambda canvas, doc: footer(canvas, doc, retrieved),
    )
    print(f"Generated {output} with {len(records)} products")


if __name__ == "__main__":
    build()
