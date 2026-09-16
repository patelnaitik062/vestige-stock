package com.naitik.vestigestock;

import android.Manifest;
import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Executes on Android; test data exists only in the disposable emulator. */
@RunWith(AndroidJUnit4.class)
public class AndroidIntegrationTest {
    private WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView)view;
        if (view instanceof ViewGroup) {
            ViewGroup group=(ViewGroup)view;
            for(int i=0;i<group.getChildCount();i++) {
                WebView found=findWeb(group.getChildAt(i));
                if(found!=null)return found;
            }
        }
        return null;
    }
    private String js(ActivityScenario<MainActivity> scenario,String expression)throws Exception {
        CountDownLatch latch=new CountDownLatch(1);
        AtomicReference<String> result=new AtomicReference<>();
        scenario.onActivity(activity->{
            WebView web=findWeb(activity.getWindow().getDecorView());
            assertNotNull(web);
            web.evaluateJavascript(expression,value->{result.set(value);latch.countDown();});
        });
        assertTrue("WebView callback timed out",latch.await(10,TimeUnit.SECONDS));
        return result.get();
    }
    private void awaitTrue(ActivityScenario<MainActivity> scenario,String expression)throws Exception {
        long deadline=SystemClock.elapsedRealtime()+30000;
        do {
            if("true".equals(js(scenario,expression)))return;
            SystemClock.sleep(150);
        }while(SystemClock.elapsedRealtime()<deadline);
        fail("Android WebView condition failed: "+expression);
    }
    @Test public void navigationSettingsPersistenceAndScannerLaunch()throws Exception {
        Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
        instrumentation.getUiAutomation().grantRuntimePermission("com.naitik.vestigestock",Manifest.permission.CAMERA);
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            awaitTrue(scenario,"!!document.querySelector('[data-mode=price]')");
            for(String page:new String[]{"products","billing","activity","more","home"}) {
                js(scenario,"document.querySelector('.bottomnav [data-page="+page+"]').click()");
                awaitTrue(scenario,"document.querySelector('.bottomnav [aria-current=page]').dataset.page==='"+page+"' && !!document.querySelector('h1')");
            }
            js(scenario,"document.querySelector('.bottomnav [data-page=more]').click();document.querySelector('[data-action=store-settings]').click();document.querySelector('[name=storeName]').value='Android integration shop';document.querySelector('#settings-form').requestSubmit()");
            awaitTrue(scenario,"JSON.parse(Android.loadState()).state.settings.storeName==='Android integration shop'");
            scenario.recreate();
            awaitTrue(scenario,"document.body.innerText.includes('Android integration shop') && !!document.querySelector('[data-mode=price]')");
            assertEquals("true",js(scenario,"(()=>{const s=JSON.parse(Android.loadState()).state;return JSON.parse(Android.saveState(JSON.stringify(s),s.revision-1)).ok===false})()"));
            Instrumentation.ActivityMonitor monitor=instrumentation.addMonitor(ScannerActivity.class.getName(),null,false);
            try {
                js(scenario,"document.querySelector('[data-mode=price]').click();document.querySelector('[data-action=camera]').click()");
                Activity scanner=instrumentation.waitForMonitorWithTimeout(monitor,15000);
                assertNotNull("Native barcode scanner did not open",scanner);
                instrumentation.runOnMainSync(scanner::finish);
            } finally { instrumentation.removeMonitor(monitor); }
        }
    }
    private int checkPdf(File file)throws Exception {
        assertTrue("PDF was not written",file.length()>1000);
        try(ParcelFileDescriptor descriptor=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);
            PdfRenderer renderer=new PdfRenderer(descriptor)) {
            for(int i=0;i<renderer.getPageCount();i++) {
                try(PdfRenderer.Page page=renderer.openPage(i)) {
                    Bitmap bitmap=Bitmap.createBitmap(page.getWidth(),page.getHeight(),Bitmap.Config.ARGB_8888);
                    bitmap.eraseColor(Color.WHITE);
                    page.render(bitmap,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                    boolean ink=false;
                    for(int y=0;y<bitmap.getHeight()&&!ink;y+=3)
                        for(int x=0;x<bitmap.getWidth();x+=3)if(bitmap.getPixel(x,y)!=Color.WHITE){ink=true;break;}
                    bitmap.recycle();
                    assertTrue("Blank PDF page",ink);
                }
            }
            return renderer.getPageCount();
        }
    }
    @Test public void catalogueLinksPhysicalBarcodeAtZeroStock()throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            awaitTrue(scenario,"!!document.querySelector('[data-mode=price]')");
            js(scenario,"document.querySelector('.bottomnav [data-page=products]').click()");
            awaitTrue(scenario,"document.body.innerText.includes('253 official product listings') && document.body.innerText.includes('0 in stock')");
            Bitmap screenshot=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
            assertNotNull(screenshot);
            try(FileOutputStream out=new FileOutputStream(new File(context.getFilesDir(),"catalogue-products.png"))){screenshot.compress(Bitmap.CompressFormat.PNG,100,out);}
            screenshot.recycle();
            js(scenario,"window.onNativeEvent({type:'scan',code:'TEST-CATALOG-AMLA',context:JSON.stringify({mode:'edit'})})");
            awaitTrue(scenario,"!!document.querySelector('[data-action=catalog-link]')");
            js(scenario,"document.querySelector('[data-action=catalog-link]').click()");
            awaitTrue(scenario,"document.querySelector('[role=dialog]').getAttribute('aria-label')==='Scan catalogue QR'");
            js(scenario,"window.onNativeEvent({type:'scan',code:'VSCAT:Y20025',context:JSON.stringify({mode:'catalog-link',barcode:'TEST-CATALOG-AMLA'})})");
            awaitTrue(scenario,"!!document.querySelector('#product-form')");
            assertEquals("true",js(scenario,"document.querySelector('[name=dp]').value==='' && document.querySelector('[name=gst]').value==='' && document.querySelector('[name=name]').value==='Vestige Amla 60 Capsules'"));
            js(scenario,"document.querySelector('[name=dp]').value='100';document.querySelector('[name=gst]').value='18';document.querySelector('#product-form').requestSubmit()");
            awaitTrue(scenario,"JSON.parse(Android.loadState()).state.products.some(p=>p.barcode==='TEST-CATALOG-AMLA'&&p.catalogCode==='Y20025')");
            assertEquals("true",js(scenario,"(()=>{const s=JSON.parse(Android.loadState()).state,p=s.products.find(p=>p.barcode==='TEST-CATALOG-AMLA');return p.dp===10000&&p.gstBps===1800&&StockCore.stock(s,p.id)===0&&!s.lots.some(l=>l.productId===p.id)&&!VestigeCatalog.pending(s).some(c=>c.code==='Y20025')})()"));
            scenario.recreate();
            awaitTrue(scenario,"!!document.querySelector('[data-mode=price]')");
            assertEquals("true",js(scenario,"JSON.parse(Android.loadState()).state.products.some(p=>p.barcode==='TEST-CATALOG-AMLA'&&p.catalogCode==='Y20025')"));
        }
    }
    @Test public void multipageInvoiceRendersOnAndroid()throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        JSONArray lines=new JSONArray();
        for(int i=0;i<60;i++)lines.put(new JSONObject().put("name","Barcode test product "+i).put("pack","100 ml").put("batch","B001").put("qty",1)
            .put("quote",new JSONObject().put("gstBps",1800).put("mrp",16000).put("selling",12980)));
        JSONObject invoice=new JSONObject().put("store",new JSONObject().put("storeName","Test Store").put("address","Sample address"))
            .put("number","TEST-0001").put("time",System.currentTimeMillis()).put("customer","PDF integration test").put("payment","Cash")
            .put("lines",lines).put("net",660000).put("tax",118800).put("total",778800);
        File file=new File(context.getCacheDir(),"integration-invoice.pdf");
        try(FileOutputStream out=new FileOutputStream(file)){InvoicePdf.write(invoice,out);}
        assertTrue("Expected multiple invoice pages",checkPdf(file)>1);
    }
    @Test public void internalBarcodeLabelRendersOnAndroid()throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        File file=new File(context.getCacheDir(),"integration-label.pdf");
        try(FileOutputStream out=new FileOutputStream(file)) {
            InvoicePdf.label(new JSONObject().put("name","Label test product"),new JSONObject().put("batch","B001").put("code","VST:TEST-BATCH-001").put("expiry","2027-12-31"),out);
        }
        assertEquals(1,checkPdf(file));
    }
}
