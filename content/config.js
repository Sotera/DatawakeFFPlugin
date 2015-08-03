Components.utils.import('chrome://greasemonkey-modules/content/constants.js');
Components.utils.import('chrome://greasemonkey-modules/content/miscapis.js');
Components.utils.import('chrome://greasemonkey-modules/content/prefmanager.js');
Components.utils.import('chrome://greasemonkey-modules/content/script.js');
Components.utils.import('chrome://greasemonkey-modules/content/third-party/MatchPattern.js');
Components.utils.import('chrome://greasemonkey-modules/content/util.js');

function Config() {
  this._saveTimer = null;
  this._scripts = null;
  this._configFile = GM_util.scriptDir();
  this._configFile.append("config.xml");
  this._globalExcludes = JSON.parse(GM_prefRoot.getValue("globalExcludes"));
  this._observers = [];
}

Config.prototype.GM_GUID = "{e4a8a97b-f2ed-450b-b12d-ee082ba24781}";

Config.prototype.initialize = function() {
  this._updateVersion();
  this._load();
};

Config.prototype.addObserver = function(observer, script) {
  var observers = script ? script._observers : this._observers;
  observers.push(observer);
};

Config.prototype.removeObserver = function(observer, script) {
  var observers = script ? script._observers : this._observers;
  var index = observers.indexOf(observer);
  if (index == -1) throw new Error("Observer not found");
  observers.splice(index, 1);
},

Config.prototype._notifyObservers = function(script, event, data) {
  var observers = this._observers.concat(script._observers);
  for (var i = 0, observer; observer = observers[i]; i++) {
    observer.notifyEvent(script, event, data);
  }
};

Config.prototype._changed = function(script, event, data, dontSave) {
  if (!dontSave) {
    this._save();
  }

  this._notifyObservers(script, event, data);
};

Config.prototype.installIsUpdate = function(script) {
  return this._find(script) > -1;
};

Config.prototype._find = function(aScript) {
  for (var i = 0, script; script = this._scripts[i]; i++) {
    if (script.id == aScript.id) {
      return i;
    }
  }

  return -1;
};

Config.prototype._load = function() {
  var domParser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
      .createInstance(Components.interfaces.nsIDOMParser);

  var configContents = "<UserScriptConfig/>";
  if (this._configFile.exists()) {
    configContents = GM_util.getContents(this._configFile);
  }
  var doc = domParser.parseFromString(configContents, "text/xml");
  var nodes = doc.evaluate("/UserScriptConfig/Script", doc, null,
      7 /* XPathResult.ORDERED_NODE_SNAPSHOT_TYPE */,
      null);

  this._scripts = [];
  for (var i=0, node=null; node=nodes.snapshotItem(i); i++) {
    try {
      var script = new Script(node);
    } catch (e) {
      // If parsing the script node failed, fail gracefully by skipping it.
      GM_util.logError(e, false, e.fileName, e.lineNumber);
      continue;
    }
    if (script.allFilesExist()) {
      this._scripts.push(script);
    } else {
      // TODO: Add a user prompt to restore the missing script here?
      // Perhaps sometime after update works, and we know where to
      // download the script from?
      node.parentNode.removeChild(node);
      this._changed(script, "missing-removed", null);
    }
  }
};

Config.prototype._save = function(saveNow) {
  // If we have not explicitly been told to save now, then defer execution
  // via a timer, to avoid locking up the UI.
  if (!saveNow) {
    // Reduce work in the case of many changes near to each other in time.
    if (this._saveTimer) {
      this._saveTimer.cancel(this._saveTimer);
    }

    this._saveTimer = Components.classes["@mozilla.org/timer;1"]
        .createInstance(Components.interfaces.nsITimer);

    // dereference 'this' for the closure
    var _save = GM_util.hitch(this, "_save");

    this._saveTimer.initWithCallback(
        {'notify': function() { _save(true); }}, 250,
        Components.interfaces.nsITimer.TYPE_ONE_SHOT);
    return;
  }

  var doc = Components.classes["@mozilla.org/xmlextras/domparser;1"]
      .createInstance(Components.interfaces.nsIDOMParser)
      .parseFromString("<UserScriptConfig></UserScriptConfig>", "text/xml");

  for (var i = 0, scriptObj; scriptObj = this._scripts[i]; i++) {
    doc.firstChild.appendChild(doc.createTextNode("\n\t"));
    doc.firstChild.appendChild(scriptObj.toConfigNode(doc));
  }

  doc.firstChild.appendChild(doc.createTextNode("\n"));

  var domSerializer = Components
      .classes["@mozilla.org/xmlextras/xmlserializer;1"]
      .createInstance(Components.interfaces.nsIDOMSerializer);
  GM_util.writeToFile(domSerializer.serializeToString(doc), this._configFile);
};

Config.prototype.install = function(script, oldScript, tempDir) {
  var existingIndex = this._find(oldScript || script);
  if (!oldScript) oldScript = this.scripts[existingIndex];

  if (oldScript) {
    // Save the old script's state.
    script._enabled = oldScript.enabled;
    script.userExcludes = oldScript.userExcludes;
    script.userMatches = oldScript.userMatches;
    script.userIncludes = oldScript.userIncludes;

    // Uninstall the old script.
    this.uninstall(oldScript, true);
  }

  script._dependhash = GM_util.sha1(script._rawMeta);
  script._installTime = new Date().getTime();

  this._scripts.push(script);

  if (existingIndex > -1) {
    this.move(script, existingIndex - this._scripts.length + 1);
  }

  if (oldScript) {
    this._changed(script, 'modified', oldScript.id);
  } else {
    this._changed(script, 'install', existingIndex);
  }
};

Config.prototype.uninstall = function(script, forUpdate) {
  if ('undefined' == typeof(forUpdate)) forUpdate = false;

  var idx = this._find(script);
  this._scripts.splice(idx, 1);
  script.uninstall(forUpdate);
};

/**
 * Moves an installed user script to a new position in the array of installed scripts.
 *
 * @param script The script to be moved.
 * @param destination Can be either (a) a numeric offset for the script to be
 *                    moved by, or (b) another installed script to which
 *                    position the script will be moved.
 */
Config.prototype.move = function(script, destination) {
  var from = this._scripts.indexOf(script);
  var to = -1;

  // Make sure the user script is installed
  if (from == -1) return;

  if (typeof destination == "number") { // if destination is an offset
    to = from + destination;
    to = Math.max(0, to);
    to = Math.min(this._scripts.length - 1, to);
  } else { // if destination is a script object
    to = this._scripts.indexOf(destination);
  }

  if (to == -1) return;

  var tmp = this._scripts.splice(from, 1)[0];
  this._scripts.splice(to, 0, tmp);
  this._changed(script, "move", to);
},

Config.prototype.__defineGetter__('globalExcludes',
function Config_getGlobalExcludes() { return this._globalExcludes.concat(); }
);

Config.prototype.__defineSetter__('globalExcludes',
function Config_setGlobalExcludes(val) {
  this._globalExcludes = val.concat();
  GM_prefRoot.setValue("globalExcludes", JSON.stringify(this._globalExcludes));
});

Config.prototype.__defineGetter__('scripts',
function Config_getScripts() { return this._scripts.concat(); }
);

Config.prototype.getMatchingScripts = function(testFunc) {
  return this._scripts.filter(testFunc);
};

Config.prototype.updateModifiedScripts = function(
    aWhen, aUrl, aWindowId, aBrowser
) {
  // Find any updated scripts or scripts with delayed injection
  var scripts = this.getMatchingScripts(
      function (script) {
        return script.runAt == aWhen
            && (script.isModified() || 0 != script.pendingExec.length);
      });
  if (0 == scripts.length) return;

  for (var i = 0, script; script = scripts[i]; i++) {
    if (0 == script.pendingExec.length) {
      var scope = {};
      Components.utils.import('chrome://greasemonkey-modules/content/parseScript.js', scope);
      var parsedScript = scope.parse(
          script.textContent, GM_util.uriFromUrl(script.downloadURL));
      // TODO: Show PopupNotifications about parse error(s)?
      script.updateFromNewScript(parsedScript, aUrl, aWindowId, aBrowser);
    } else {
      // We are already downloading dependencies for this script
      // so add its window to the list
      script.pendingExec.push({
        'browser': aBrowser,
        'url': aUrl,
        'windowId': aWindowId
      });
    }
  }

  this._save();
};

Config.prototype.getScriptById = function(scriptId) {
  for (var i = 0, script = null; script = this.scripts[i]; i++) {
    if (scriptId == script.id) {
      return script;
    }
  }
};

/**
 * Checks whether the version has changed since the last run and performs
 * any necessary upgrades.
 */
Config.prototype._updateVersion = function() {
  Components.utils.import("resource://gre/modules/AddonManager.jsm");
  AddonManager.getAddonByID(this.GM_GUID, GM_util.hitch(this, function(addon) {
    var oldVersion = GM_prefRoot.getValue("version");
    var newVersion = addon.version;

    // Update the stored current version so we don't do this work again.
    GM_prefRoot.setValue("version", newVersion);

    if ("0.0" == oldVersion) {
      // This is the first launch.  Show the welcome screen.
      var chromeWin = GM_util.getBrowserWindow();
      // If we found it, use it to open a welcome tab.
      if (chromeWin && chromeWin.gBrowser) {
        var url = 'http://www.greasespot.net/p/welcome.html'
            + '?utm_source=xpi&utm_medium=xpi&utm_campaign=welcome'
            + '&utm_content=' + newVersion;
        // the setTimeout makes sure we do not execute too early -- sometimes
        // the window isn't quite ready to add a tab yet
        chromeWin.setTimeout(chromeWin.GM_BrowserUI.openTab, 100, url);
      }
    }

    if ('3.2' == newVersion && oldVersion != newVersion) {
      var tmp_dir = Components
          .classes['@mozilla.org/file/directory_service;1']
          .getService(Components.interfaces.nsIProperties)
          .get('TmpD', Components.interfaces.nsIFile);
      // #2069 Clean up stray temp directories.
      for (var i = 1; ; i++) {
        var file = tmp_dir.clone();
        file.append('gm-temp' + i);
        if (file.exists()) {
          dump('Removing temp dir: ' + file.path + '\n');
          file.remove(true);
        } else {
          break;
        }
      }
    }
  }));
};
