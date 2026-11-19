package com.almailgroup.mascores;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

/** Add-only saving without access to existing photos. */
@CapacitorPlugin(name = "PhotoLibrary")
public class PhotoLibraryPlugin extends Plugin {
  @PluginMethod public void save(PluginCall call) {
    String base64 = call.getString("base64");
    if (base64 == null || base64.isEmpty()) { call.reject("No image supplied"); return; }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) { call.reject("Gallery saving requires Android 10 or newer"); return; }
    getBridge().execute(() -> {
      Uri uri = null;
      try {
        byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, "MaScores-" + System.currentTimeMillis() + ".png");
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/MaScores");
        values.put(MediaStore.Images.Media.IS_PENDING, 1);
        uri = getContext().getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IllegalStateException("Could not create photo");
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri)) {
          if (stream == null) throw new IllegalStateException("Could not open photo");
          stream.write(bytes); stream.flush();
        }
        ContentValues ready = new ContentValues(); ready.put(MediaStore.Images.Media.IS_PENDING, 0);
        getContext().getContentResolver().update(uri, ready, null, null);
        call.resolve();
      } catch (Exception error) {
        if (uri != null) getContext().getContentResolver().delete(uri, null, null);
        call.reject("Could not save photo", error);
      }
    });
  }
}
