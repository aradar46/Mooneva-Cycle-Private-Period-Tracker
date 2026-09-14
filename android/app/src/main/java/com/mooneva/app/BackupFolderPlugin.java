package com.mooneva.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

/**
 * Writes automatic backups into a folder the user picks once, using the Storage
 * Access Framework.
 *
 * SAF is the only way to reach a user-chosen folder on a modern Android: the app
 * targets SDK 36, where WRITE_EXTERNAL_STORAGE is not granted at all. It also
 * needs no manifest permission of any kind, which keeps the F-Droid build clean.
 *
 * The tree URI returned by pickFolder() is persisted by the JS layer in app
 * settings; takePersistableUriPermission is what keeps it usable across reboots.
 */
@CapacitorPlugin(name = "BackupFolder")
public class BackupFolderPlugin extends Plugin {

    private static final String MIME_BACKUP = "application/octet-stream";

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        startActivityForResult(call, intent, "onFolderPicked");
    }

    @ActivityCallback
    private void onFolderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }

        Uri treeUri = result.getData().getData();
        if (treeUri == null) {
            call.reject("No folder was returned by the picker");
            return;
        }

        try {
            // Without this the grant dies at the next reboot.
            getContext()
                .getContentResolver()
                .takePersistableUriPermission(
                    treeUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                );
        } catch (SecurityException e) {
            call.reject("Could not keep permission for that folder", e);
            return;
        }

        DocumentFile folder = DocumentFile.fromTreeUri(getContext(), treeUri);
        JSObject picked = new JSObject();
        picked.put("cancelled", false);
        picked.put("target", treeUri.toString());
        picked.put("label", folder != null && folder.getName() != null ? folder.getName() : "");
        call.resolve(picked);
    }

    /** True when the persisted grant is still held and the folder still exists. */
    @PluginMethod
    public void hasAccess(PluginCall call) {
        String target = call.getString("target");
        JSObject result = new JSObject();

        if (target == null) {
            result.put("granted", false);
            call.resolve(result);
            return;
        }

        DocumentFile folder = resolveFolder(target);
        result.put("granted", folder != null && folder.canWrite());
        call.resolve(result);
    }

    @PluginMethod
    public void writeFile(PluginCall call) {
        String target = call.getString("target");
        String name = call.getString("name");
        String data = call.getString("data");

        if (target == null || name == null || data == null) {
            call.reject("target, name and data are required");
            return;
        }

        DocumentFile folder = resolveFolder(target);
        if (folder == null || !folder.canWrite()) {
            call.reject("The backup folder is no longer available");
            return;
        }

        try {
            // Reuse an existing document rather than delete-then-create: deleting
            // first would destroy the previous backup if createFile then failed.
            // Opening with "wt" truncates, so the contents are replaced either way.
            DocumentFile file = folder.findFile(name);
            if (file == null) {
                file = folder.createFile(MIME_BACKUP, name);
            }
            if (file == null) {
                call.reject("Could not create the backup file");
                return;
            }

            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            try (OutputStream out = getContext().getContentResolver().openOutputStream(file.getUri(), "wt")) {
                if (out == null) {
                    call.reject("Could not open the backup file for writing");
                    return;
                }
                out.write(bytes);
                out.flush();
            }

            JSObject written = new JSObject();
            written.put("name", name);
            call.resolve(written);
        } catch (Exception e) {
            call.reject("Failed to write the backup", e);
        }
    }

    @PluginMethod
    public void listFiles(PluginCall call) {
        String target = call.getString("target");
        if (target == null) {
            call.reject("target is required");
            return;
        }

        DocumentFile folder = resolveFolder(target);
        if (folder == null) {
            call.reject("The backup folder is no longer available");
            return;
        }

        JSArray names = new JSArray();
        for (DocumentFile file : folder.listFiles()) {
            String name = file.getName();
            if (file.isFile() && name != null) names.put(name);
        }

        JSObject result = new JSObject();
        result.put("names", names);
        call.resolve(result);
    }

    @PluginMethod
    public void deleteFile(PluginCall call) {
        String target = call.getString("target");
        String name = call.getString("name");

        if (target == null || name == null) {
            call.reject("target and name are required");
            return;
        }

        DocumentFile folder = resolveFolder(target);
        if (folder == null) {
            call.reject("The backup folder is no longer available");
            return;
        }

        DocumentFile file = folder.findFile(name);
        // An already-absent file is the state the caller wanted.
        JSObject result = new JSObject();
        result.put("deleted", file == null || file.delete());
        call.resolve(result);
    }

    /** Releases the persisted grant when the user turns auto-backup off. */
    @PluginMethod
    public void releaseFolder(PluginCall call) {
        String target = call.getString("target");
        if (target != null) {
            try {
                getContext()
                    .getContentResolver()
                    .releasePersistableUriPermission(
                        Uri.parse(target),
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    );
            } catch (Exception ignored) {
                // Already gone, or never held. Either way there is nothing to release.
            }
        }
        call.resolve();
    }

    /**
     * No-op on Android: the OS gives a backgrounded process a grace period on its
     * own, and the run is short. Implemented so the shared JS caller does not have
     * to branch on platform.
     */
    @PluginMethod
    public void beginBackgroundTask(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void endBackgroundTask(PluginCall call) {
        call.resolve();
    }

    private DocumentFile resolveFolder(String target) {
        try {
            DocumentFile folder = DocumentFile.fromTreeUri(getContext(), Uri.parse(target));
            return folder != null && folder.exists() ? folder : null;
        } catch (Exception e) {
            return null;
        }
    }
}
