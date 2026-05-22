package com.mooneva.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

/**
 * Capacitor plugin to sync cycle data to all Android widgets.
 *
 * Called from the web app whenever cycle data changes.
 * Writes to SharedPreferences and triggers updates for all
 * registered widget providers (CycleBar, CycleRing, WeekGlance).
 */
@CapacitorPlugin(name = "WidgetSync")
public class WidgetSyncPlugin extends Plugin {

    private static final Class<?>[] WIDGET_PROVIDERS = {
            CycleBarWidgetProvider.class
    };

    @PluginMethod
    public void updateWidgetData(PluginCall call) {
        int cycleDay = call.getInt("cycleDay", 1);
        int cycleLength = call.getInt("cycleLength", 28);
        int daysUntilPeriod = call.getInt("daysUntilPeriod", 14);
        int daysUntilOvulation = call.getInt("daysUntilOvulation", 14);
        String currentPhase = call.getString("currentPhase", "follicular");
        boolean discreteMode = call.getBoolean("discreteMode", false);

        Context context = getContext();
        if (context == null) {
            call.reject("Context not available");
            return;
        }

        // Save to SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences(
                CycleBarWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putInt(CycleBarWidgetProvider.KEY_CYCLE_DAY, cycleDay);
        editor.putInt(CycleBarWidgetProvider.KEY_CYCLE_LENGTH, cycleLength);
        editor.putInt(CycleBarWidgetProvider.KEY_DAYS_UNTIL_PERIOD, daysUntilPeriod);
        editor.putInt(CycleBarWidgetProvider.KEY_DAYS_UNTIL_OVULATION, daysUntilOvulation);
        editor.putString(CycleBarWidgetProvider.KEY_CURRENT_PHASE, currentPhase);
        editor.putBoolean(CycleBarWidgetProvider.KEY_DISCRETE_MODE, discreteMode);
        editor.apply();

        // Trigger update for ALL widget providers
        int totalWidgets = 0;
        AppWidgetManager widgetManager = AppWidgetManager.getInstance(context);

        for (Class<?> providerClass : WIDGET_PROVIDERS) {
            int[] widgetIds = widgetManager.getAppWidgetIds(
                    new ComponentName(context, providerClass));
            if (widgetIds.length > 0) {
                totalWidgets += widgetIds.length;
                Intent intent = new Intent(context, providerClass);
                intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, widgetIds);
                context.sendBroadcast(intent);
            }
        }

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("widgetsUpdated", totalWidgets);
        call.resolve(result);
    }

    @PluginMethod
    public void getWidgetStatus(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context not available");
            return;
        }

        AppWidgetManager widgetManager = AppWidgetManager.getInstance(context);
        int totalWidgets = 0;

        for (Class<?> providerClass : WIDGET_PROVIDERS) {
            int[] widgetIds = widgetManager.getAppWidgetIds(
                    new ComponentName(context, providerClass));
            totalWidgets += widgetIds.length;
        }

        JSObject result = new JSObject();
        result.put("widgetCount", totalWidgets);
        result.put("hasWidgets", totalWidgets > 0);
        call.resolve(result);
    }
}
