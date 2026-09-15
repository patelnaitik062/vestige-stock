package com.naitik.vestigestock;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import com.google.zxing.BarcodeFormat;
import com.journeyapps.barcodescanner.BarcodeEncoder;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

final class InvoicePdf {
    private final PdfDocument document = new PdfDocument();
    private PdfDocument.Page page;
    private Canvas canvas;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private int pageNumber = 0;
    private float y;
    private final JSONObject invoice;
    private static final int GREEN = Color.rgb(22, 63, 50);
    private static final int MUTED = Color.rgb(105, 122, 111);

    private InvoicePdf(JSONObject invoice) { this.invoice = invoice; }
    static String money(long cents) {
        NumberFormat f = NumberFormat.getCurrencyInstance(new Locale("en", "IN"));
        return f.format(BigDecimal.valueOf(cents, 2));
    }
    private void text(String value, float x, float baseline, float size, boolean bold, int color) {
        paint.setTextSize(size); paint.setColor(color); paint.setTypeface(bold ? Typeface.create("sans-serif", Typeface.BOLD) : Typeface.create("sans-serif", Typeface.NORMAL));
        canvas.drawText(value, x, baseline, paint);
    }
    private void right(String value, float end, float baseline, float size, boolean bold) {
        paint.setTextSize(size); paint.setTypeface(Typeface.create("sans-serif", bold ? Typeface.BOLD : Typeface.NORMAL));
        text(value, end - paint.measureText(value), baseline, size, bold, GREEN);
    }
    private List<String> wrap(String value, float width, float size) {
        paint.setTextSize(size); paint.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        List<String> lines = new ArrayList<>();
        for (String paragraph : value.replace('\n',' ').split("\\n", -1)) {
            String rest = paragraph;
            while (!rest.isEmpty()) {
                int count = paint.breakText(rest, true, width, null);
                if (count <= 0) count = 1;
                if (count < rest.length()) { int space = rest.lastIndexOf(' ', count); if (space > count / 2) count = space; }
                lines.add(rest.substring(0, count).trim()); rest = rest.substring(count).trim();
            }
        }
        if (lines.isEmpty()) lines.add(""); return lines;
    }
    private void rule(float at) { paint.setColor(Color.rgb(222,230,220)); paint.setStrokeWidth(1); canvas.drawLine(36,at,559,at,paint); }
    private void newPage() throws Exception {
        if (page != null) finishPage();
        page = document.startPage(new PdfDocument.PageInfo.Builder(595,842,++pageNumber).create()); canvas=page.getCanvas(); y=42;
        JSONObject store = invoice.getJSONObject("store");
        for(String line:wrap(store.optString("storeName","My Vestige Store"),355,18)){text(line,36,y,18,true,GREEN);y+=22;}
        right("SALES RECEIPT",559,42,10,true);
        for(String line:wrap(store.optString("address"),355,9)){if(!line.isEmpty()){text(line,36,y,9,false,MUTED);y+=13;}}
        String contact=store.optString("phone"); if(!contact.isEmpty()){text(contact,36,y,9,false,MUTED);y+=13;}
        String gstin=store.optString("gstin"); if(!gstin.isEmpty()){text("GSTIN: "+gstin,36,y,9,false,MUTED);y+=13;}
        y+=10;rule(y);y+=20;
        text(invoice.getString("number"),36,y,12,true,GREEN);
        right(new SimpleDateFormat("dd MMM yyyy, hh:mm a",Locale.ENGLISH).format(new Date(invoice.getLong("time"))),559,y,9,false);
        y+=17;
        for(String line:wrap("Customer: "+invoice.optString("customer","").replaceAll("^$","Walk-in customer"),420,9)){text(line,36,y,9,false,MUTED);y+=12;}
        y+=13;paint.setColor(Color.rgb(239,244,235));canvas.drawRect(36,y-13,559,y+12,paint);
        text("PRODUCT / BATCH",44,y+3,8,true,GREEN);right("MRP",320,y+3,8,true);right("SELLING",404,y+3,8,true);right("QTY",443,y+3,8,true);right("AMOUNT",551,y+3,8,true);y+=35;
    }
    private void finishPage(){rule(795);text("Original sale • GST included in selling prices",36,812,8,false,MUTED);right("Page "+pageNumber,559,812,8,false);document.finishPage(page);page=null;}
    private void render(OutputStream out) throws Exception {
        try {
            newPage();JSONArray lines=invoice.getJSONArray("lines");
            for(int i=0;i<lines.length();i++){
                JSONObject l=lines.getJSONObject(i),q=l.getJSONObject("quote");List<String> name=wrap(l.getString("name"),210,10);
                List<String> detail=wrap(l.optString("pack")+" · Batch "+l.optString("batch"),210,8);
                float height=name.size()*13+detail.size()*11+25;
                if(y+height>740)newPage();float top=y;
                for(String line:name){text(line,44,y,10,true,GREEN);y+=13;}
                for(String line:detail){text(line,44,y,8,false,MUTED);y+=11;}
                text("GST "+BigDecimal.valueOf(q.getLong("gstBps"),2).stripTrailingZeros().toPlainString()+"%",44,y,8,false,MUTED);
                right(money(q.getLong("mrp")),320,top,9,false);right(money(q.getLong("selling")),404,top,9,false);
                right(String.valueOf(l.getInt("qty")),443,top,9,false);right(money(q.getLong("selling")*l.getInt("qty")),551,top,9,true);
                y=top+height;rule(y-8);
            }
            if(y+150>765)newPage();y+=14;
            text("Value before included GST",305,y,9,false,MUTED);right(money(invoice.getLong("net")),551,y,10,false);y+=23;
            text("Included GST",305,y,9,false,MUTED);right(money(invoice.getLong("tax")),551,y,10,false);y+=28;
            text("TOTAL PAID",305,y,11,true,GREEN);right(money(invoice.getLong("total")),551,y,17,true);y+=28;
            text("Payment: "+invoice.getString("payment"),36,y,10,true,GREEN);y+=22;
            text("Thank you for shopping with us.",36,y,10,false,MUTED);y+=16;
            text("Subsequent returns are recorded separately from this original receipt.",36,y,8,false,MUTED);
            finishPage();document.writeTo(out);
        }finally{if(page!=null)document.finishPage(page);document.close();}
    }
    static void write(JSONObject invoice,OutputStream out)throws Exception{new InvoicePdf(invoice).render(out);}

    static void label(JSONObject product,JSONObject lot,OutputStream out)throws Exception{
        PdfDocument doc=new PdfDocument();PdfDocument.Page p=doc.startPage(new PdfDocument.PageInfo.Builder(288,360,1).create());
        Canvas c=p.getCanvas();Paint brush=new Paint(Paint.ANTI_ALIAS_FLAG);brush.setColor(GREEN);brush.setTypeface(Typeface.create("sans-serif",Typeface.BOLD));brush.setTextSize(13);
        String name=product.getString("name");int length=brush.breakText(name,true,248,null);c.drawText(name.substring(0,length),20,30,brush);
        brush.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));brush.setTextSize(10);
        String batch="Batch: "+lot.getString("batch");c.drawText(batch.substring(0,brush.breakText(batch,true,248,null)),20,51,brush);
        Bitmap qr=new BarcodeEncoder().encodeBitmap(lot.getString("code"),BarcodeFormat.QR_CODE,200,200);c.drawBitmap(qr,44,68,brush);
        brush.setTextSize(9);c.drawText("Expiry: "+lot.optString("expiry","Not set"),20,292,brush);
        c.drawText("Scan this label to identify this exact stock batch.",20,310,brush);brush.setTextSize(7);
        String code=lot.getString("code");c.drawText(code.substring(0,Math.min(code.length(),42)),20,330,brush);if(code.length()>42)c.drawText(code.substring(42),20,341,brush);
        doc.finishPage(p);try{doc.writeTo(out);}finally{doc.close();qr.recycle();}
    }
}
