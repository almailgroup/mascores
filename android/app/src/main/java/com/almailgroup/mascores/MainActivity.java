package com.almailgroup.mascores;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Draw edge-to-edge on every Android version so the safe-area handling
        // applies uniformly (Android 15+ enforces edge-to-edge anyway). The
        // SystemBars plugin injects the real bar heights into the page.
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
