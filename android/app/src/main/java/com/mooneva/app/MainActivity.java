package com.mooneva.app;

import com.getcapacitor.BridgeActivity;
import com.mooneva.app.widget.WidgetSyncPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AppIconPlugin.class);
        registerPlugin(WidgetSyncPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
