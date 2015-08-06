var EXPORTED_SYMBOLS = ['datawakeNotify'];

Components.utils.import('resource://services-common/utils.js');
Components.utils.import('chrome://greasemonkey-modules/content/miscapis.js');
Components.utils.import('chrome://greasemonkey-modules/content/parseScript.js');
Components.utils.import('chrome://greasemonkey-modules/content/prefmanager.js');
Components.utils.import("chrome://greasemonkey-modules/content/storageBack.js");
Components.utils.import('chrome://greasemonkey-modules/content/util.js');

var gPrefMan = new GM_PrefManager();
var gStringBundle = Components
    .classes["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService)
    .createBundle("chrome://greasemonkey/locale/greasemonkey.properties");

var toolbarVisible = false;

function datawakeNotify(show) {
    var win = GM_util.getBrowserWindow();
    var browser = win.gBrowser;
    var notificationBox = browser.getNotificationBox();
    if (show && !toolbarVisible) {
        notificationBox.appendNotification(
            gStringBundle.GetStringFromName('stats-prompt.msg'),
            "greasemonkey-stats-opt-in",
            "chrome://greasemonkey/skin/waveicon16.png",
            notificationBox.PRIORITY_INFO_MEDIUM,
            []
            /*        [{
             'label': gStringBundle.GetStringFromName('stats-prompt.readmore'),
             'accessKey': gStringBundle.GetStringFromName('stats-prompt.readmore.accesskey'),
             'popup': null,
             'callback': function () {
             browser.loadOneTab(
             'http://www.greasespot.net/2012/11/anonymous-statistic-gathering.html',
             {'inBackground': false});
             }
             }, {
             'label': gStringBundle.GetStringFromName('stats-prompt.optin'),
             'accessKey': gStringBundle.GetStringFromName('stats-prompt.optin.accesskey'),
             'popup': null,
             'callback': function () {
             gPrefMan.setValue('stats.optedin', true);
             check();
             }
             }]*/
        );
    }else if(!show && toolbarVisible){
    }
}
