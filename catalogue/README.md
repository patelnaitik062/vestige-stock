# Official Vestige India catalogue

`vestige-india-2026-09-16.json` is the historical website-card snapshot.
`vestige-products-current.json` is the source for the current app bundle. Its
`fetchedAt` field records when it was refreshed from the official public India
catalogue endpoint
(`https://apiv2.veston.in/api/mc/item/getItemListByMultipleFilterWeb`, location
`WHMP1`). At the current snapshot, 233 of 236 API records have positive MRP and
DP, published pack details and GST and are bundled. The snapshot includes name, pack, category,
MRP, DP, GST, distributor price, PV, BV, HSN and source URL. Money and point
values are stored as integer paise/hundredths. Catalogue records are references,
not local stock.

The public API does not publish manufacturer pack barcodes or NC. No live
availability is imported, and every new local product begins at zero stock.
Review current prices against the printed pack and purchase invoice.

Run `python catalogue/refresh-official-catalogue.py` to fetch the official API
and regenerate the current snapshot, `app/src/main/assets/catalogue.js`, and
the dated zero-stock import CSV.
The dated `vestige-products-YYYY-MM-DD.json` files are historical snapshots and
should not be overwritten. To rebuild from an existing snapshot, run
`python catalogue/generate-bundled-catalogue.py [snapshot-path]`. The app matches
`VSCAT:<itemcode>` QRs, but never treats those as physical barcodes. A pack
barcode must be scanned first. For already registered products, catalogue
linking adds only the catalogue facts not already stored and does not replace
their names, prices, stock or transaction history.

The listing PDF can be regenerated from the current snapshot with
`python catalogue/generate-official-listing.py`; its filename includes the
snapshot date and each row includes its compatible setup QR. This identifier is
not a manufacturer barcode.

Generate an app-importable, zero-stock product CSV with
`python catalogue/generate-zero-stock-import.py`. The dated CSV contains the
published product values and an explicit `stock` value of `0`, but no physical
barcodes (the public API does not provide them). In the app, import it from
**Products > Import zero-stock catalogue CSV**. This adds unlinked catalogue
records and does not replace the JSON backup or existing store data. Link each
record to a scanned physical pack barcode before receiving or selling stock.

An existing product can acquire a catalogue reference without changing its
price, name, barcode, stock or completed transaction history. The bundled reference
list is separate from transactional inventory; JSON backups include confirmed
product links, and old version-1 backups remain readable.
