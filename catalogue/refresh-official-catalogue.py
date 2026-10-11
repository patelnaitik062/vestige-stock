"""Refresh the official Vestige API snapshot and regenerate the app bundle."""

from datetime import datetime
from pathlib import Path
import json
import subprocess
import sys
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
API = "https://apiv2.veston.in/api/mc/item/getItemListByMultipleFilterWeb"
OUTPUT = ROOT / "catalogue" / "vestige-products-current.json"

payload = {
    "locationcode": "WHMP1",
    "from": 0,
    "size": 1000,
    "countrycode": "1",
    "categoryid": 0,
    "type": "desc",
    "sortByKey": "mrp",
    "directKey": [],
    "rangeKey": [],
}
request = Request(
    API,
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json", "User-Agent": "Vestige-Stock catalogue refresh"},
)
with urlopen(request, timeout=45) as response:
    result = json.loads(response.read())
if isinstance(result, str):
    result = json.loads(result)
if result.get("statusCode") not in (None, 200) or not isinstance(result.get("results"), list):
    raise ValueError("Official catalogue API returned an unexpected response.")

products = {}
for row in result["results"]:
    code = str(row.get("itemcode") or row.get("skuCode") or "").strip().upper()
    pack = str(row.get("netContent") or row.get("netcontent") or "").strip()
    mrp = row.get("mrp")
    dp = row.get("unitPrice", row.get("unitprice"))
    gst = row.get("gstcode", row.get("hsntax"))
    if (
        not code
        or not pack
        or mrp in (None, "")
        or dp in (None, "")
        or gst in (None, "")
        or float(mrp) <= 0
        or float(dp) <= 0
    ):
        continue

    def paise(value):
        return round(float(value) * 100) if value not in (None, "") else None

    products[code] = {
        "code": code,
        "name": str(row.get("displayname") or row.get("productName") or row.get("positemname") or "").strip(),
        "pack": pack,
        "category": str(row.get("categoryvalue") or row.get("categoryName") or "").strip(),
        "mrp": paise(mrp),
        "dp": paise(dp),
        "distributorPrice": paise(row.get("distributorprice")),
        "pv": paise(row.get("pointvalue", row.get("associatedPv"))),
        "bv": paise(row.get("businessvalue", row.get("associatedBv"))),
        "gstBps": round(float(gst) * 100) if gst not in (None, "") else None,
        "hsn": str(row.get("HSNCode") or row.get("hsnId") or "").strip(),
        "sourceUrl": "https://www.myvestige.com/allProducts",
    }

if not products:
    raise ValueError("Official catalogue response contained no usable product records.")

snapshot = {
    "fetchedAt": datetime.now(ZoneInfo("Asia/Kolkata")).isoformat(timespec="seconds"),
    "country": "India",
    "currency": "INR",
    "sourceIndex": "https://www.myvestige.com/allProducts",
    "sourceApi": API,
    "location": "WHMP1",
    "apiRecordCount": len(result["results"]),
    "recordCount": len(products),
    "products": sorted(products.values(), key=lambda product: (product["category"], product["code"])),
}
OUTPUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
subprocess.run(
    [sys.executable, str(ROOT / "catalogue" / "generate-bundled-catalogue.py"), str(OUTPUT)],
    cwd=ROOT,
    check=True,
)
subprocess.run(
    [sys.executable, str(ROOT / "catalogue" / "generate-zero-stock-import.py")],
    cwd=ROOT,
    check=True,
)
print(f"Saved {len(products)} products with positive MRP and DP and published GST from the official API to {OUTPUT}")
