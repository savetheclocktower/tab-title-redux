const { CompositeDisposable, TextEditor } = require('atom');

// Generate unique property names for our monkey-patch properties.
const $$didPatchTabTitleRedux = Symbol('didPatchTabTitleRedux');
const $$originalGetTitle = Symbol('originalGetTitle');
const $$originalGetLongTitle = Symbol('originalGetLongTitle');

let isActivated = false;

function patchPaneItem (item, that) {
  if (item[$$didPatchTabTitleRedux]) return;
  item[$$didPatchTabTitleRedux] = true;

  item[$$originalGetTitle] = item.getTitle;
  item[$$originalGetLongTitle] = item.getLongTitle;

  item.getTitle = () => {
    if (!that.isTemporary(item) || !isActivated) {
      return item[$$originalGetTitle]?.();
    }
    return that.getTitle(item);
  };

  item.getLongTitle = () => {
    if (!that.isTemporary(item) || !isActivated) {
      return item[$$originalGetLongTitle]?.() ??
        item[$$originalGetTitle]?.();
    }
    return that.getTitle(item);
  };
  updateTitle(item);
}

function unpatchPaneItem (item) {
  if (!item[$$didPatchTabTitleRedux]) return;
  delete item[$$didPatchTabTitleRedux];
  item.getTitle = item[$$originalGetTitle];
  item.getLongTitle = item[$$originalGetLongTitle];
  delete item[$$originalGetTitle];
  delete item[$$originalGetLongTitle];
  updateTitle(item);
}

function updateTitle (item) {
  item.emitter?.emit('did-change-title', item.getTitle());
}

class EditorStore {
  static CACHE = new WeakMap();

  static getOrCreateForEditor(textEditor, instance) {
    if (this.CACHE.has(textEditor)) {
      return this.CACHE.get(textEditor);
    }
    let store = new EditorStore(textEditor, instance);
    this.CACHE.set(textEditor, store);
    return store;
  }

  constructor (editor, instance) {
    this.editor = editor;
    this.instance = instance;
    this.lastTitle = instance.getTitle(editor);
    let dispatch = this.dispatch.bind(this);

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      // When the editor changes its path, it might be a switch from a
      // temporary buffer to a saved buffer — in which case the tab title
      // should be updated to reflect the path rather than the buffer text.
      editor.onDidChangePath(dispatch),

      // When the buffer changes, we should update our tab and window title.
      editor.onDidChange(dispatch),
      editor.onDidDestroy(this.dispose.bind(this))
    );
  }

  dispatch () {
    let title = this.instance.getTitle(this.editor);
    // If the title hasn't changed, we don't have to prod the editor to update
    // the title.
    if (title === this.lastTitle) return;
    if (!this.instance.isTemporary(this.editor)) return;
    this.lastTitle = title;

    // Trigger the `did-change-title` event on the `TextEditor`. The tab view
    // hooks into this and updates the tab title automatically.
    updateTitle(this.editor);
  }

  dispose () {
    EditorStore.CACHE.delete(this.editor);
    this.subscriptions.dispose();
  }
}


class TabTitleRedux {
  subscriptions = null;

  activate () {
    this.defaultTitle = atom.config.get('tab-title-redux.defaultTitle');
    this.maximumTitleLength = atom.config.get('tab-title-redux.maximumTitleLength');
    this.searchForFirstRow = atom.config.get('tab-title-redux.searchForFirstRow');

    this.subscriptions = new CompositeDisposable();
    isActivated = true;

    this.subscriptions.add(
      // Add subscriptions for each editor so we can trigger a title update on
      // edits or saves.
      atom.workspace.observeTextEditors((editor) => {
        EditorStore.getOrCreateForEditor(editor, this);
        // Every `TextEditor` is a pane item and implements the pane item
        // contract.
        patchPaneItem(editor, this);
      }),

      // Update tab titles immediately when the config value changes.
      atom.config.onDidChange('tab-title-redux.defaultTitle', ({ newValue }) => {
        this.defaultTitle = newValue;
        for (let item of atom.workspace.getPaneItems()) {
          if (!(item instanceof TextEditor)) continue;
          updateTitle(item);
        }
      }),

      atom.config.onDidChange('tab-title-redux.maximumTitleLength', ({ newValue }) => {
        this.maximumTitleLength = newValue;
        for (let item of atom.workspace.getPaneItems()) {
          if (!(item instanceof TextEditor)) continue;
          updateTitle(item);
        }
      }),

      atom.config.onDidChange('tab-title-redux.searchForFirstRow', ({ newValue }) => {
        this.searchForFirstRow = newValue;
        for (let item of atom.workspace.getPaneItems()) {
          if (!(item instanceof TextEditor)) continue;
          updateTitle(item);
        }
      })
    );

    let active = atom.workspace.getActiveTextEditor();
    if (active) {
      updateTitle(active);
      // We could instead call `updateWindowTitle` here, but there's a bug in
      // `Workspace` in which it does not subscribe to title changes on the
      // initially active pane. The subscriber is added within the event
      // handler below.
      //
      // So we'll work around that bug by calling this event handler. It has no
      // detrimental side effects (from what I can tell) and it allows text
      // changes to trigger immediate changes in the window title in all cases.
      atom.workspace.didChangeActivePaneItem(active);
    }
  }

  deactivate () {
    isActivated = false;
    this.subscriptions.dispose();
    for (let paneItem of atom.workspace.getPaneItems()) {
      unpatchPaneItem(paneItem, this);
    }
  }

  isTemporary (item) {
    return !!(item.buffer && !item.buffer.file);
  }

  getTitleRow (item) {
    if (!this.searchForFirstRow || /\S/.test(item.buffer.lineForRow(0))) {
      return 0;
    }
    let row = -1;
    item.scan(/\S/, {}, ({ stop, range }) => {
      row = range.start.row;
      stop();
    });
    return row;
  }

  getTitle (item) {
    let bufferRow = this.getTitleRow(item);
    if (bufferRow === -1) return this.defaultTitle;
    let title = item.buffer.lineForRow(bufferRow).trim();
    if (!title) {
      return this.defaultTitle;
    }
    let max = this.maximumTitleLength;
    return title.length > max ? `${title.substring(0, max - 1)}…` : title;
  }
}

module.exports = new TabTitleRedux();
