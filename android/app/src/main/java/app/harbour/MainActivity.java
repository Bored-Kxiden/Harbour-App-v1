package app.harbour;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* The one plugin that lives in this app rather than in node_modules --
           there is no separate package for one native method, so it is
           registered here instead of being auto-discovered the way the
           npm-installed plugins are. */
        registerPlugin(ContactsPickerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
