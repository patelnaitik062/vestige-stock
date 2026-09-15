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
application ID, and increase `versionCode` for each release.

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
   **Vestige-Stock-1.0.0-debug.apk** in the project folder. Copy it to your phone
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

## Your DP, GST and 10% rule

DP is interpreted as **excluding GST**. Enter the actual GST percentage for each
product; no Vestige catalog or GST rate is assumed or preloaded.

The default selling price is:

```
Cost including GST = DP × (1 + GST% / 100)
Selling price      = cost including GST × 1.10
```

For DP ₹100.00 and GST 18%, the app calculates ₹118.00 cost including GST and
**₹129.80 selling price**. This is a 10% markup on cost. The example GST rate is
illustrative only.

If you mean a true 10% profit margin, select **More > Pricing rule > True 10%
margin**. That uses `(DP + GST) ÷ 0.90`, producing ₹131.11 in the same example.
The setting always keeps 10%; the two options choose how it is applied.

Both options produce a GST-inclusive final selling price. Checkout does not add
GST a second time. Prices are rounded to the nearest paise using integer
arithmetic with half-up rounding. GST on DP and the resulting unit selling price
are rounded at their respective steps; invoice totals sum saved unit amounts.

The app blocks billing if the calculated price exceeds the selected batch MRP.
It never silently changes your margin or substitutes MRP as the selling price.

Product DP/GST edits affect future prices. Actual purchase DP remains attached
to received stock for cost/profit history. Each invoice stores its own prices,
costs, quantities, customer and store information. Old invoices never recalculate
when a product or store setting changes.

## First use

1. Open **More > Store details** and enter your store name/contact information.
2. Choose **Add product**, open the camera, and scan a real pack barcode. Enter
   name, pack size, DP before GST, MRP, GST percentage, and expiry preference.
3. Open **Receive stock**. Scan the product, enter quantity, actual purchase DP,
   printed batch MRP, batch number and expiry. Add it to the receipt.
4. Scan any other incoming products and **Confirm receipt**. Mark existing stock
   as an **opening balance** so it does not inflate purchases in reports.
5. Use **Check price** on Home to scan and display selling price/MRP.
6. Open **Billing**, scan products, review quantities, and complete the bill
   after collecting payment. Use **Save PDF invoice** to choose a destination.
7. Open **Activity** to re-export old bills or review receipts.

The app starts empty. It does not invent product names, barcodes, prices,
customers or sales. Registration and numeric fields use normal controls;
product identification always uses scanning, with no product-name search.

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

- **32 domain tests passed** in this environment: rounding, barcode identity,
  purchases, sales, cost snapshots, duplicate completion, stock limits, expiry,
  batch selection, returns, and backup reconciliation.
- **5 UI event/render smoke tests passed** using a mocked Android bridge (37
  automated tests total). These execute the packaged UI code without a browser;
  they do not verify rendered pixels, the physical camera or Android APIs.
- Both application JavaScript files passed Node syntax checks.
- All four Java files passed a Java parser check; Android classes/dependencies
  could not be resolved here, so this is not a successful Android compilation.
- Manifest and resource XML were parsed successfully.
- APK compilation and Android lint were **not run successfully** because the
  Android SDK/Gradle were unavailable and download servers were unreachable.
- The browser's URL policy blocked the local preview. Visual layout, actual
  navigation behavior, camera decoding, Android document saving and PDF output
  still require device/emulator verification. No screenshot is presented as a
  verified app rendering.
- Version 1 assumes one operator. Separate admin/cashier accounts, multi-device
  synchronization, catalog imports, supplier returns, purchase reversals, product
  photos, credit sales and operating-expense accounting are not implemented.
- The PDF is a sales receipt. A jurisdiction-specific statutory GST tax-invoice
  workflow (HSN/SAC, place of supply, CGST/SGST/IGST allocation, etc.) has not been
  implemented. Enter actual product rates; review receipt requirements for your
  business before using it as a tax invoice.
- The debug APK build is for installation/testing on your device. A signed
  release and store submission are separate steps. Keep the same application ID
  and signing key for future updates, and back up before installing updates.

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
node --test tests/core.test.cjs tests/ui-smoke.test.cjs
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
