package com.naitik.vestigestock;

import android.annotation.SuppressLint;
import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import com.journeyapps.barcodescanner.ScanContract;
import com.journeyapps.barcodescanner.ScanOptions;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends ComponentActivity {
    private static final String ORIGIN="appassets.androidplatform.net";
    private WebView web;
    private StateStore store;
    private SharedPreferences session;
    private boolean ready=false;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final java.util.concurrent.atomic.AtomicBoolean exportBusy=new java.util.concurrent.atomic.AtomicBoolean(false);

    private final ActivityResultLauncher<ScanOptions> scanner=registerForActivityResult(new ScanContract(),result->{
        if(result.getContents()!=null){
            try { JSONObject event=new JSONObject().put("type","scan").put("code",result.getContents()).put("context",prefs().getString("scanContext","{}"));emit(event); }
            catch(Exception e){message("Could not read barcode. Please scan again.");}
        }else message("Scan cancelled. No stock changed.");
    });
    private final ActivityResultLauncher<String> cameraPermission=registerForActivityResult(
        new ActivityResultContracts.RequestPermission(),granted->{
            if(granted) launchScanner();
            else message("Camera permission is required to scan. Allow it in Android app settings and try again.");
        });
    private ScanOptions pendingScan;
    private final ActivityResultLauncher<Intent> createDocument=registerForActivityResult(new ActivityResultContracts.StartActivityForResult(),result->{
        if(result.getResultCode()!=RESULT_OK||result.getData()==null||result.getData().getData()==null){exportBusy.set(false);message("Export cancelled. Your data is still saved.");return;}
        Uri destination=result.getData().getData();
        io.execute(()->{try(InputStream in=new FileInputStream(pendingFile());OutputStream out=getContentResolver().openOutputStream(destination,"wt")){
            if(out==null)throw new IllegalStateException("Cannot open the selected destination.");copy(in,out,32*1024*1024);out.flush();message("File saved successfully.");
        }catch(Exception e){message("Export failed. Open the saved bill or backup and try again.");}finally{exportBusy.set(false);}});
    });
    private final ActivityResultLauncher<Intent> openDocument=registerForActivityResult(new ActivityResultContracts.StartActivityForResult(),result->{
        if(result.getResultCode()!=RESULT_OK||result.getData()==null||result.getData().getData()==null)return;
        Uri source=result.getData().getData();io.execute(()->{try(InputStream in=getContentResolver().openInputStream(source);ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
            if(in==null)throw new IllegalStateException("Cannot open backup.");copy(in,bytes,24*1024*1024);
            emit(new JSONObject().put("type","restore").put("text",bytes.toString(StandardCharsets.UTF_8.name())));
        }catch(Exception e){message("Could not read backup. Choose a valid JSON backup under 24 MB.");}});
    });

    private SharedPreferences prefs(){if(session==null)session=getSharedPreferences("ui-session",MODE_PRIVATE);return session;}
    private File pendingFile(){return new File(getCacheDir(),"pending-export.bin");}
    private static void copy(InputStream in,OutputStream out,int maximum)throws Exception{byte[] b=new byte[16384];int n,total=0;while((n=in.read(b))!=-1){total+=n;if(total>maximum)throw new IllegalArgumentException("File too large.");out.write(b,0,n);}}
    private boolean local(Uri uri){return "https".equals(uri.getScheme())&&ORIGIN.equals(uri.getHost())&&uri.getPath()!=null&&uri.getPath().startsWith("/assets/");}

    @SuppressLint("SetJavaScriptEnabled")
    @Override protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);store=new StateStore(this);prefs();
        FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(246,248,245));web=new WebView(this);root.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(root);
        root.setOnApplyWindowInsetsListener((view,insets)->{
            if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(android.view.WindowInsets.Type.systemBars()|android.view.WindowInsets.Type.displayCutout()|android.view.WindowInsets.Type.ime());view.setPadding(bars.left,bars.top,bars.right,bars.bottom);}
            else view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;
        });root.requestApplyInsets();
        web.setBackgroundColor(Color.rgb(246,248,245));WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setSupportMultipleWindows(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClientCompat(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){
                if(local(request.getUrl())){WebResourceResponse response=loader.shouldInterceptRequest(request.getUrl());if(response!=null)return response;}
                return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",null,new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){return !local(request.getUrl());}
            @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap favicon){ready=false;}
        });
        web.addJavascriptInterface(new Bridge(),"Android");
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){@Override public void handleOnBackPressed(){if(ready)emitBack();else finish();}});
    }
    private void emitBack(){try{emit(new JSONObject().put("type","back"));}catch(Exception ignored){finish();}}
    private void emit(JSONObject event){runOnUiThread(()->{
        try {if(ready&&web!=null)web.evaluateJavascript("window.onNativeEvent("+event.toString()+")",null);
            else {JSONArray events=new JSONArray(prefs().getString("pendingEvents","[]"));events.put(event);prefs().edit().putString("pendingEvents",events.toString()).apply();}
        }catch(Exception ignored){Toast.makeText(this,"Please reopen the app.",Toast.LENGTH_SHORT).show();}
    });}
    private void message(String message){try{emit(new JSONObject().put("type","message").put("message",message));}catch(Exception ignored){}}
    private JSONObject find(JSONArray array,String id)throws Exception{for(int i=0;i<array.length();i++){JSONObject item=array.getJSONObject(i);if(id.equals(item.getString("id")))return item;}throw new IllegalArgumentException("Record not found.");}
    private boolean beginExport(){if(!exportBusy.compareAndSet(false,true)){message("Finish the current export first.");return false;}return true;}
    private void chooseDestination(String name,String mime){runOnUiThread(()->{Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE,name);createDocument.launch(intent);});}
    private void launchScanner(){if(pendingScan!=null){ScanOptions options=pendingScan;pendingScan=null;scanner.launch(options);}}

    private final class Bridge {
        @JavascriptInterface public String loadState(){try{String json=store.read();return new JSONObject().put("state",json==null?JSONObject.NULL:new JSONObject(json)).toString();}catch(Exception e){return "{\"error\":\"Could not read store data. Existing data has not been changed.\"}";}}
        @JavascriptInterface public String saveState(String json,long expected){try{store.save(json,expected);return "{\"ok\":true}";}catch(Exception e){try{return new JSONObject().put("ok",false).put("error",e.getMessage()).toString();}catch(Exception ignored){return "{\"ok\":false}";}}}
        @JavascriptInterface public void ready(){runOnUiThread(()->{ready=true;try{JSONArray events=new JSONArray(prefs().getString("pendingEvents","[]"));prefs().edit().remove("pendingEvents").apply();for(int i=0;i<events.length();i++)emit(events.getJSONObject(i));}catch(Exception ignored){}});}
        @JavascriptInterface public void scanBarcode(String context){runOnUiThread(()->{
            try{JSONObject parsed=new JSONObject(context);String mode=parsed.getString("mode");
                if(!java.util.Arrays.asList("price","edit","receive","bill","return","adjust","catalog-link").contains(mode))throw new IllegalArgumentException();
                prefs().edit().putString("scanContext",context).commit();
                String prompt="catalog-link".equals(mode)?"Scan the catalogue QR code":"Scan one product or internal batch label";
                pendingScan=new ScanOptions().setCaptureActivity(ScannerActivity.class).setOrientationLocked(false).setBeepEnabled(true).setBarcodeImageEnabled(false).setPrompt(prompt);
                if("catalog-link".equals(mode)) pendingScan.setDesiredBarcodeFormats("QR_CODE");
                else pendingScan.setDesiredBarcodeFormats(ScanOptions.ALL_CODE_TYPES);
                if(androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this,Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED) launchScanner();
                else cameraPermission.launch(Manifest.permission.CAMERA);
            }catch(Exception e){message("Could not open the camera. Allow camera access in Android app settings or use a hardware scanner.");}
        });}
        @JavascriptInterface public void exportInvoice(String id){if(!beginExport())return;io.execute(()->{try{JSONObject invoice=find(new JSONObject(store.read()).getJSONArray("sales"),id);try(OutputStream out=new FileOutputStream(pendingFile())){InvoicePdf.write(invoice,out);}chooseDestination(invoice.getString("number")+".pdf","application/pdf");}catch(Exception e){exportBusy.set(false);message("Could not generate PDF. Your completed bill is saved; retry from Activity.");}});}
        @JavascriptInterface public void exportLotLabel(String id){if(!beginExport())return;io.execute(()->{try{JSONObject state=new JSONObject(store.read()),lot=find(state.getJSONArray("lots"),id),product=find(state.getJSONArray("products"),lot.getString("productId"));try(OutputStream out=new FileOutputStream(pendingFile())){InvoicePdf.label(product,lot,out);}chooseDestination("Batch-"+id+".pdf","application/pdf");}catch(Exception e){exportBusy.set(false);message("Could not create the batch label. Please try again.");}});}
        @JavascriptInterface public void exportBackup(){if(!beginExport())return;io.execute(()->{try{String data=store.read();if(data==null)throw new IllegalStateException();try(OutputStream out=new FileOutputStream(pendingFile())){out.write(data.getBytes(StandardCharsets.UTF_8));}chooseDestination("Vestige-Backup-"+new java.text.SimpleDateFormat("yyyyMMdd-HHmmss",java.util.Locale.ENGLISH).format(new java.util.Date())+".json","application/json");}catch(Exception e){exportBusy.set(false);message("Backup export failed. Your store data is unchanged.");}});}
        @JavascriptInterface public void importBackup(){runOnUiThread(()->openDocument.launch(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json")));}
        @JavascriptInterface public void finishApp(){runOnUiThread(()->finish());}
    }
    @Override protected void onDestroy(){ready=false;if(web!=null){web.removeJavascriptInterface("Android");web.destroy();web=null;}io.shutdown();super.onDestroy();}
}
