# Vestige Stock — Android inventory and billing

An offline inventory and billing app for one distributor and one Android device.
The interface has a light background, green accents, bottom navigation, compact
dashboard cards, animated sheets, and prominent barcode actions.

## Build without Android Studio

GitHub Actions builds and lints this project when application files are pushed to
`main`, or when **Build Android APK** is run manually from the Actions tab.
The **Vestige-Stock-build** artifact contains the release APK before signing,
Android's `apksigner.jar`, package metadata and checksums. An unsigned APK cannot
be installed: the final downloadable APK must be signed with the owner's private
key. Signing keys and passwords are never committed or uploaded to this repository.
The delivered signed APK can be opened directly on an Android 8.0+ phone.

Keep the private signing backup for future updates. Reuse the same key and
application ID, and increase `versionCode` and `versionName` for every app
update. The settings screen and APK filenames read the version from Gradle.

## Build the Android APK on Windows

1. Install [Android Studio](https://developer.android.com/studio), including its
   bundled Java runtime.
2. Open its **SDK Manager**. Install **Android SDK Platform 35** and
   **Android SDK Build-Tools 35.0.0**. Complete any license prompts yourself.
3. Extract this ZIP to a normal writable folder, for example
   `D:\Vestige-Stock`. Do not build inside `Program Files`.
4. Double-click **BUILD-APK.cmd** in the extracted folder.
5. The helper locates Android Studio/your SDK, downloads Gradle 8.11.1 from its
   official server, checks its published SHA-256, and builds/lints the app.
6. If the build succeeds, the installable file is
   **Vestige-Stock-<versionName>-debug.apk** in the project folder (currently
   **Vestige-Stock-1.6.0-debug.apk**). Copy it to your phone
   and open it. Android may ask you to allow installation from the app used to
   open the APK.

The first build needs internet for dependencies. The app itself uses local
assets, native barcode decoding, and on-device data storage.

For a custom SDK path, run from PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\BUILD-APK.ps1 -SdkPath "D:\Android\Sdk"
```

The execution-policy setting applies only to that process; the script does not
change the machine policy or require Administrator access.

After the helper succeeds, the standard Gradle wrapper is generated and you can
open the project in Android Studio. Alternatively, install Gradle 8.11.1 and run
`gradle :app:assembleDebug :app:lintDebug` from the project folder.

## Preloaded catalogue

The Products screen includes 233 product records with positive MRP and DP refreshed from the
[official Vestige India catalogue API](https://www.myvestige.com/allProducts) on
10 October 2026, across 11 categories. The offline snapshot includes current
name, size, tax-inclusive MRP, DP, distributor price, PV, BV, GST, HSN and
product category. Values are a dated reference; verify current batch MRP and
purchase DP against the physical pack and invoice.

The catalogue is bundled offline. It does not overwrite existing products,
stock, purchase history or invoices. Catalogue entries appear under **Preloaded - awaiting setup** until a real pack
barcode is linked. Scanning that barcode and its matching `VSCAT:` QR prefills
the published catalogue details. Existing store products, stock, purchase
history and invoices are retained during updates.

The supplied catalogue PDF uses `VSCAT:` setup QR codes. These are app reference
identifiers, not manufacturer barcodes. Scan the physical pack first, then its
matching catalogue QR. Billing and stock identification remain scan-first.
Existing registered products can be linked from their scanned details screen
without changing their saved prices or stock. Backups preserve catalogue links.

The Products tab also supports searching by name, barcode, pack, category or
catalogue code; filtering by category and stock status; and exporting the
filtered inventory as a CSV. The CSV includes saved on-hand quantities and
unlinked catalogue rows at zero stock. This export is a report, not a restorable
backup.

Manufacturer barcode mappings and NC are not publicly available. They are not
guessed or generated. Review the published DP/GST against your purchase invoice.
Run `python catalogue/refresh-official-catalogue.py` to refresh the official
snapshot, offline app bundle and dated listing PDF. See `catalogue/README.md`
for provenance and details.

## Selling price plans

DP is interpreted as **excluding GST**. Enter the actual GST percentage for each
product. The offline catalogue includes current published DP and GST values; verify
them against your invoice and the actual product pack.

The default selling price is:

```
Cost including GST = DP × (1 + GST% / 100)
Selling price      = cost including GST × 1.10
```

For DP ₹100.00 and GST 18%, the app calculates ₹118.00 cost including GST and
**₹129.80 selling price**. This is a 10% markup on cost. The example GST rate is
illustrative only.

Choose a plan from **Billing > Selling plan** or **More > Selling price plan**:
**DP + GST** (no uplift), **10% markup** using `cost including GST × 1.10`, or
**true 10% margin** using `(DP + GST) ÷ 0.90`. For DP ₹100 and GST 18%, those
plans produce ₹118.00, ₹129.80 and ₹131.11, respectively.

All three plans produce a GST-inclusive final selling price. Checkout does not
add GST a second time. Prices are rounded to the nearest paise using integer
arithmetic with half-up rounding. GST on DP and the resulting unit selling price
are rounded at their respective steps; invoice totals sum saved unit amounts.

The app blocks billing if the calculated price exceeds the selected batch MRP.
It never silently changes your margin or substitutes MRP as the selling price.

Product DP/GST edits affect future prices. Actual purchase DP remains attached
to received stock for cost/profit history. Each invoice stores its own prices,
costs, quantities, customer and store information. Old invoices never recalculate
when a product or store setting changes.

## Importing stock quickly

From **Receive stock > CSV template**, create a CSV with columns
`barcode,quantity,batch,expiry,dp,mrp,gst`. Barcode and quantity identify each
registered product receipt row; batch is required. DP, MRP and GST may be left
blank to use the saved product values. Select **Import stock CSV** to review the
parsed receipt. The app validates the whole file before adding any rows; invalid
rows, unknown/inactive product barcodes, malformed quantities, bad dates, and
oversized files do not partially change the receipt. Review and confirm the
resulting receipt to add stock.

To import the published catalogue with no stock, select **Products > Import
zero-stock catalogue CSV** and choose
`Vestige-Product-Catalogue-Import-2026-10-10.csv`. Review the preview before
confirming. Products start without physical barcodes and cannot be scanned for
stock or billing until you select **Link physical pack barcode** and scan the
real pack. This adds products without replacing transactions or existing data;
it is not a full backup. Full store backups are JSON.

## First use

1. Open **More > Store details** and enter your store name/contact information.
2. Choose **Add product**, open the camera, and scan a real pack barcode. Choose
   **Scan catalogue QR** and scan the matching setup QR from the supplied PDF
   on another screen or a printed page. Review the name/pack, DP, MRP, GST, PV,
   BV and HSN. Saving leaves stock at zero. Unlisted products can still be
   registered from their scanned pack barcode.
3. Open **Receive stock**. Scan the product and enter quantity, actual purchase
   DP, printed batch MRP, batch number and expiry, or import a reviewed CSV.
4. Scan any other incoming products and **Confirm receipt**. Mark existing stock
   as an **opening balance** so it does not inflate purchases in reports.
5. Use **Check price** on Home to scan and display selling price/MRP.
6. Open **Billing**, scan products, review quantities, and complete the bill
   after collecting payment. Use **Save PDF invoice** to choose a destination.
7. Open **Activity** to re-export old bills or review receipts.

The app includes 233 current official Vestige India reference products at zero
stock. Physical pack barcodes are never assumed. Existing store data is retained;
the reference catalogue never creates purchases or sales. Registration and numeric fields use normal controls.
Product identification in billing and receiving always uses scanning; the Products
tab search only helps browse and filter saved or preloaded records.

## Scanning and batches

- Camera scanning is native Android, using the bundled ZXing decoder. Camera
  permission is requested when needed. One launch accepts one code, so a pack
  held in front of the camera does not repeatedly increment quantity.
- Reopen the camera to deliberately scan another unit. USB/Bluetooth keyboard
  scanners work in the scan panel; configure the scanner to terminate with Enter.
- Barcode values remain text, preserving leading zeros.
- Multiple active batches of one product require scanning the correct internal
  batch barcode. The app does not guess which physical batch was sold.
- Save internal QR batch-label PDFs from a receipt or a scanned product's batch
  details, then print/attach the labels. Product names in the list do not act as
  a manual billing picker.
- Expired batches cannot be sold. Required expiry must be supplied at receiving.

## What is implemented

- Home dashboard: sales, purchases, gross profit, stock value and alerts.
- Today/month/all-time dashboard filters and a seven-day sales chart.
- Progressive loading for long product and activity lists; the weekly chart
  aggregates each saved sale once and exposes full weekday labels.
- Barcode-based registration, editing and price checking.
- Purchases with multiple scanned receipt lines, batch MRP, expiry and cost.
- Opening stock, saleable inventory, write-offs and quarantine.
- Saved billing drafts, quantities, Cash/UPI/Card payment-method records.
- Atomic invoice/stock completion and duplicate-completion protection.
- Native multipage invoice PDFs and internal QR batch-label PDFs.
- Bill and purchase history; PDF retries use original saved bills.
- Scanned customer returns linked to original invoices with quantity limits.
- Store settings, price history/audit records, JSON backup and reviewed restore.
- Android Back handling, scrolling sheets, large primary controls, reduced-motion
  styling and escaped user text.

Payment methods are records only: there is no UPI/card payment-gateway integration.

The complete app workflow, including scanning, stock, billing, returns,
reporting and backup/restore, is shown in the [application flowchart](docs/APP-FLOW.md).

## Profit and inventory reporting

Gross profit uses revenue excluding included output GST minus the actual purchase
DP of the units sold, with linked returns reversed. Purchases still on the shelf
are not treated as a cost of goods already sold. The dashboard shows purchase
totals including GST and stock valuation at purchase DP, labeled separately.

Expenses, inventory write-down expenses, tax remittance, credits and a full
accounting ledger are not included. Gross profit is not net profit.

## Data and recovery

On Android, the entire coherent store state is written in one SQLite transaction
with a revision check. The business core produces a new state before committing,
so failed validations cannot partially update stock. The single-snapshot layout
is deliberately scoped to a small, single-device store (maximum 24 MB snapshot),
not a shared database service or large multi-store system.

Draft lines are saved as they are added or changed. An unsubmitted registration
or receipt-item form can be re-entered after an interruption. Successful bills
and receipts survive app restarts. PDF export is a separate read from the saved
invoice; export failures cannot undo or duplicate a sale.

Export a backup regularly using **More > Export backup**. A restore previews the
backup, validates stock/financial consistency, and asks for `RESTORE` before
replacing current data. Backups are plain JSON and include customer/store data;
keep them in a location you trust. There is no automatic cloud backup or sync.
Uninstalling the app deletes its local data.

## Current limits and validation status

Version 1.1.0 compiled successfully and Android lint passed in
[GitHub Actions run 35075365513](https://github.com/patelnaitik062/vestige-stock/actions/runs/35075365513).
The signed release APK uses the original owner's certificate and version code 2,
so it can update version 1.0.0 without uninstalling. Android's apksigner verified
its v2/v3 signatures, and all packaged UI assets match the built source.

**49 automated checks passed:** 32 inventory/pricing tests, 6 catalogue tests,
7 packaged UI tests, and 4 Android integration tests on an Android 15 emulator.
The new Android test follows physical-pack scan result -> catalogue QR result ->
confirmed product form -> SQLite save, checks zero stock/no lots, and verifies
that the catalogue link survives Activity recreation. Existing scanner launch,
navigation, persistence and invoice/batch-label PDF checks also passed.

**Current source status:** version 1.4.0 (version code 5) adds zero-stock
catalogue CSV import alongside the 1.3.0 catalogue, pricing plans and stock
receipt import. This revision has not yet been run through the Node tests or an
Android build. The older 1.1.0 APK in the project is not this update. Install
Node.js to run the automated tests and Android Studio with SDK Platform 35 /
Build Tools 35.0.0 to build the current installable APK using `BUILD-APK.cmd`.

The 1.1.0 companion catalogue PDF included 253 setup codes and source links;
the refreshed 1.3.0 listing contains the latest 233 price-complete records.
See `docs/VALIDATION-1.1.0.txt` for details; `docs/VALIDATION.txt` retains the
previous 1.0.0 release record.

Physical camera decoding on real product packs, visual layout on the owner's
phone, Bluetooth/USB scanners, and Android document-picker exports still need
on-device verification. The emulator tests ran the debug variant from the same
source; the delivered release variant disables WebView debugging. No real
inventory or demonstration stock is preloaded.

- Version 1 assumes one operator. Separate admin/cashier accounts, multi-device
  synchronization, arbitrary catalogue-file imports, supplier returns, purchase reversals, product
  photos, credit sales and operating-expense accounting are not implemented.
- The PDF is a sales receipt. A jurisdiction-specific statutory GST tax-invoice
  workflow (HSN/SAC, place of supply, CGST/SGST/IGST allocation, etc.) has not been
  implemented. Enter actual product rates; review receipt requirements for your
  business before using it as a tax invoice.
- The delivered file is a signed release APK for direct installation. It has
  not been submitted to Google Play. Keep the same application ID and signing
  key for future updates, and back up before installing updates.

See `docs/DEVICE-CHECKLIST.md` for the remaining checks.

## Project structure

```
app/src/main/assets/core.js       Integer money and inventory business logic
app/src/main/assets/app.js        Screens, forms, navigation and scan workflows
app/src/main/assets/style.css     Responsive visual design and motion
app/src/main/assets/index.html    Packaged local UI entry point
app/src/main/java/.../MainActivity.java   Android host, scanning and file actions
app/src/main/java/.../StateStore.java     SQLite atomic persistence
app/src/main/java/.../InvoicePdf.java     Native invoice and batch-label PDFs
app/src/main/java/.../ScannerActivity.java  Camera scan activity
tests/core.test.cjs               Domain tests
tests/ui-smoke.test.cjs           UI event tests with a mocked Android bridge
BUILD-APK.cmd / BUILD-APK.ps1      Windows build helper
scripts/preview.cjs               Optional local desktop UI preview
```

The Android shell uses locally packaged HTML/CSS/JavaScript rather than Compose.
It provides native camera scanning, SQLite persistence and Android PDF/file APIs.
It does not load a remote website. The desktop preview uses IndexedDB and is for
UI development; camera/PDF actions need the Android host.

## Developer commands

With Node installed:

```sh
node --test tests/*.test.cjs
node scripts/preview.cjs
```

The preview prints its local URL. Use Android for camera and PDF tests. The
development preview exposes `PreviewTools` only on localhost; it is absent at
the Android app's asset origin.

## Primary references

- [Android local-content loading](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [ZXing Android Embedded scanner](https://github.com/journeyapps/zxing-android-embedded)
- [Android PDF document API](https://developer.android.com/reference/android/graphics/pdf/PdfDocument)
- [Android Gradle Plugin 8.9 compatibility](https://developer.android.com/build/releases/agp-8-9-0-release-notes)
- [Android Studio](https://developer.android.com/studio)
