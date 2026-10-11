"""Generate an app-importable CSV of catalogue products, all with zero stock."""

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "catalogue" / "vestige-products-current.json"
FIELDS = [
    "catalog_code",
    "product_name",
    "pack",
    "category",
    "mrp",
    "dp",
    "gst_percent",
    "distributor_price",
    "pv",
    "bv",
    "hsn",
    "stock",
]


def decimal(value: int) -> str:
    return f"{value / 100:.2f}"


def build() -> Path:
    snapshot = json.loads(SOURCE.read_text(encoding="utf-8-sig"))
    retrieved = snapshot["fetchedAt"][:10]
    output = ROOT / f"Vestige-Product-Catalogue-Import-{retrieved}.csv"
    with output.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS)
        writer.writeheader()
        for product in snapshot["products"]:
            writer.writerow({
                "catalog_code": product["code"],
                "product_name": product["name"],
                "pack": product["pack"],
                "category": product["category"],
                "mrp": decimal(product["mrp"]),
                "dp": decimal(product["dp"]),
                "gst_percent": f"{product['gstBps'] / 100:g}",
                "distributor_price": decimal(product["distributorPrice"]),
                "pv": decimal(product["pv"]),
                "bv": decimal(product["bv"]),
                "hsn": product["hsn"],
                "stock": "0",
            })
    print(f"Generated {output.name} with {len(snapshot['products'])} zero-stock products")
    return output


if __name__ == "__main__":
    build()
