"""Generate the offline app catalogue from a saved official API snapshot."""

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "catalogue" / "vestige-products-current.json"
OUTPUT = ROOT / "app" / "src" / "main" / "assets" / "catalogue.js"
LEGACY = ROOT / "catalogue" / "vestige-india-2026-09-16.json"

snapshot = json.loads(SOURCE.read_text(encoding="utf-8-sig"))
legacy = json.loads(LEGACY.read_text(encoding="utf-8-sig"))
legacy_urls = {item["code"]: item["sourceUrl"] for item in legacy["products"]}
items = []
for product in snapshot["products"]:
    item = dict(product)
    item["referenceMrp"] = item.pop("mrp")
    item["sourceUrl"] = legacy_urls.get(
        item["code"], "https://www.myvestige.com/allProducts"
    )
    items.append(item)

data = json.dumps(items, ensure_ascii=False, separators=(",", ":"))
OUTPUT.write_text(
    """/* Official Vestige India catalogue API snapshot: """
    + snapshot["fetchedAt"][:10]
    + """; source snapshot is kept in catalogue/. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VestigeCatalog=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const version="""
    + json.dumps(snapshot["fetchedAt"][:10])
    + """;
const items="""
    + data
    + """;
function lookup(raw){const scan=String(raw||'').trim().replace(/[\\r\\n]+$/,'');if(!/^VSCAT:/i.test(scan))return null;return items.find(p=>p.code===scan.slice(6).trim().toUpperCase())||null;}
function pending(state){const linked=new Set((state.products||[]).map(p=>String(p.catalogCode||'').trim().toUpperCase()).filter(Boolean));return items.filter(p=>!linked.has(p.code));}
function prefill(item,barcode){if(!items.includes(item))throw new Error('Unknown catalogue entry.');if(!barcode||String(barcode).trim().toUpperCase().startsWith('VSCAT:'))throw new Error('Scan the physical pack barcode first.');const cleaned=String(barcode).trim();return {barcode:cleaned,catalogCode:item.code,name:item.name,pack:item.pack,category:item.category,mrp:item.referenceMrp,dp:item.dp||0,gstBps:item.gstBps,reorder:5,expiryRequired:!['Business Tools','Fashion Accessories','Sharp Appliance','Others'].includes(item.category),active:true,distributorPrice:item.distributorPrice,pv:item.pv,bv:item.bv,hsn:item.hsn};}
return Object.freeze({version,items,lookup,pending,prefill});
});
""",
    encoding="utf-8",
)
print(f"Generated {OUTPUT} with {len(items)} products from {snapshot['fetchedAt']}")
