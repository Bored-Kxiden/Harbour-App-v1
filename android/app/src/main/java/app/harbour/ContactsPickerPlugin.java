package app.harbour;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Hands over one contact the way the dialer already hands over one call: by
 * asking the phone's own Contacts app to do it, rather than holding a
 * permission of Harbour's own.
 *
 * ACTION_PICK against the phone-number content URI opens the system picker
 * and lets somebody choose one number on one contact. What comes back is a
 * URI the Contacts app has already granted this app temporary read access
 * to -- that grant is how the whole picture works without READ_CONTACTS, and
 * it is also why the picker only ever shows numbers, never the rest of the
 * address book: there is nothing here that could read further than what was
 * tapped. Declining to ask for READ_CONTACTS is not an oversight; a request
 * for the whole address book to add one person is the same shape of ask the
 * dialer already turned down, for the same reason.
 */
@CapacitorPlugin(name = "HarbourContacts")
public class ContactsPickerPlugin extends Plugin {

    @PluginMethod
    public void pickContact(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
        startActivityForResult(call, intent, "pickContactResult");
    }

    @ActivityCallback
    private void pickContactResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("No one was chosen.");
            return;
        }

        Uri contactUri = result.getData().getData();
        if (contactUri == null) {
            call.reject("That contact could not be read.");
            return;
        }

        String name = null;
        String phone = null;
        Cursor cursor = getContext().getContentResolver().query(contactUri, null, null, null, null);
        if (cursor != null) {
            try {
                if (cursor.moveToFirst()) {
                    int nameIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
                    int numberIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                    if (nameIdx >= 0) {
                        name = cursor.getString(nameIdx);
                    }
                    if (numberIdx >= 0) {
                        phone = cursor.getString(numberIdx);
                    }
                }
            } finally {
                cursor.close();
            }
        }

        if (name == null || name.trim().isEmpty()) {
            call.reject("That contact has no name.");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("name", name.trim());
        ret.put("phone", phone == null ? "" : phone.trim());
        call.resolve(ret);
    }
}
