package com.naitik.vestigestock;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONObject;

/** Single-device state snapshot, committed atomically with optimistic revision checks. */
final class StateStore extends SQLiteOpenHelper {
    private static final int MAX_BYTES = 24 * 1024 * 1024;

    StateStore(Context context) { super(context, "vestige-stock.db", null, 1); setWriteAheadLoggingEnabled(true); }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE app_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, json TEXT NOT NULL)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        throw new IllegalStateException("A database migration is required. Existing data has been preserved.");
    }

    synchronized String read() {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT json FROM app_state WHERE id=1", null)) {
            return c.moveToFirst() ? c.getString(0) : null;
        }
    }

    synchronized void save(String payload, long expected) throws Exception {
        if (payload.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > MAX_BYTES)
            throw new IllegalArgumentException("Store data is too large for this version. Export a backup before upgrading.");
        JSONObject state = new JSONObject(payload);
        if (state.getInt("schema") != 1 || state.getLong("revision") != expected + 1)
            throw new IllegalArgumentException("Invalid data version.");
        String[] required = {"products", "lots", "purchases", "sales", "returns", "movements", "audit"};
        for (String field : required) state.getJSONArray(field);
        state.getJSONObject("settings"); state.getJSONObject("saleDraft"); state.getJSONObject("purchaseDraft");
        SQLiteDatabase db = getWritableDatabase(); db.beginTransaction();
        try {
            long revision = -1;
            try (Cursor c = db.rawQuery("SELECT revision FROM app_state WHERE id=1", null)) {
                if (c.moveToFirst()) revision = c.getLong(0);
            }
            if (revision != expected) throw new IllegalStateException("The store changed in another session. Reopen the app before retrying.");
            ContentValues values = new ContentValues(); values.put("id", 1); values.put("revision", expected + 1); values.put("json", payload);
            if (db.insertWithOnConflict("app_state", null, values, SQLiteDatabase.CONFLICT_REPLACE) < 0)
                throw new IllegalStateException("Could not write store data. No changes were committed.");
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }
}
