package com.almailgroup.mascores;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Switch from the splash launch theme BEFORE EdgeToEdge touches the
        // window: EdgeToEdge creates the decor view, and creating it while the
        // launch theme is active leaves a white splash-image bar under the
        // status bar on Android.
        setTheme(R.style.AppTheme_NoActionBar);
        // Draw edge-to-edge on every Android version so the safe-area handling
        // applies uniformly (Android 15+ enforces edge-to-edge anyway). The
        // SystemBars plugin injects the real bar heights into the page.
        EdgeToEdge.enable(this);
        registerPlugin(PhotoLibraryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
