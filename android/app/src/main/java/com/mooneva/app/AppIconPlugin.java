package com.mooneva.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.content.ComponentName;
import android.content.pm.PackageManager;

@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {
    @PluginMethod
    public void setIcon(PluginCall call) {
        String name = call.getString("name");
        if (name == null) {
            call.reject("Must provide an icon name");
            return;
        }

        PackageManager pm = getContext().getPackageManager();
        String pkg = getContext().getPackageName();

        // Define components
        ComponentName defaultAlias = new ComponentName(pkg, pkg + ".LauncherDefault");
        ComponentName todoAlias = new ComponentName(pkg, pkg + ".LauncherTodo");

        // Logic: Enable requested, disable others
        if ("Todo".equals(name)) {
            pm.setComponentEnabledSetting(todoAlias,
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP);
            pm.setComponentEnabledSetting(defaultAlias,
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP);
        } else {
            pm.setComponentEnabledSetting(defaultAlias,
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP);
            pm.setComponentEnabledSetting(todoAlias,
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP);
        }

        call.resolve();
    }
}
