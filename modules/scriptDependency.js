var EXPORTED_SYMBOLS = ['ScriptDependency'];

Components.utils.import('chrome://greasemonkey-modules/content/util.js');

/** Base implementation for Icon, Require, Resource. */
function ScriptDependency(aScript) {
  this._charset = null;
  this._dataURI = null;
  this._downloadURL = null;
  this._filename = null;
  this._mimetype = null;
  this._name = null;
  this._script = aScript || null;
  this._tempFile = null;

  this.type = 'UnknownDependency';
}

ScriptDependency.prototype = {
  setCharset: function(aCharset) {
    this._charset = aCharset;
  },

  setFilename: function(aFile) {
    aFile.QueryInterface(Components.interfaces.nsIFile);
    this._filename = aFile.leafName;
  },

  setMimetype: function(aMimetype) {
    this._mimetype = aMimetype;
  },

  toString: function() {
    return '[' + this.type + '; ' + this.filename + ']';
  },
};

ScriptDependency.prototype.__defineGetter__('downloadURL',
function ScriptDependency_getDownloadURL() {
  return '' + (this._downloadURL || '');
});

ScriptDependency.prototype.__defineGetter__('file',
function ScriptDependency_getFile() {
  var file = this._script.baseDirFile;
  file.append(this._filename);
  return file;
});

ScriptDependency.prototype.__defineGetter__('filename',
function ScriptDependency_getFilename() {
  return '' + (this._filename || this._dataURI || '');
});

ScriptDependency.prototype.__defineGetter__('mimetype',
function ScriptDependency_getMimetype() {
  var mimetype = this._mimetype;
  if (this._charset && this._charset.length > 0) {
    mimetype += ';charset=' + this._charset;
  }
  return mimetype;
});

ScriptDependency.prototype.__defineGetter__('name',
function ScriptDependency_getName() { return '' + this._name; });

ScriptDependency.prototype.__defineGetter__('textContent',
function ScriptDependency_getTextContent() {
  return GM_util.getContents(this.file);
});
