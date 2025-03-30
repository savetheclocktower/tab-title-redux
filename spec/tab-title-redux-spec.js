const TabTitleRedux = require('../lib/main');
const { TextEditor } = require('atom');
const temp = require('temp').track();
const path = require('path');

function addUntitledEditor (
  contents,
  pane = atom.workspace.getCenter().paneContainer.activePane
) {
  let editor = new TextEditor();
  pane.addItem(editor);
  editor.setText(contents);
  return editor;
}

function expectTabsToMatch (pane, expectedValue) {
  let tabs = getTabsForPane(pane);
  let editors = pane.getItems().filter(item => item instanceof TextEditor);

  for (let [i, tab] of tabs.entries()) {
    expectTabToMatch(tab, editors[i], expectedValue);
  }
}

function getTabsForPane (pane) {
  let tabBar = pane.element.querySelector('.tab-bar');
  let tabs = tabBar.querySelectorAll('li.tab');
  return Array.from(tabs);
}

function tabForEditor (
  editor,
  pane = atom.workspace.paneForItem(editor)
) {
  let index = pane.getItems().indexOf(editor);
  if (index === -1) {
    throw new Error(`Editor not in expected pane`);
  }
  let tabs = getTabsForPane(pane);
  return tabs[index];
}

function expectTabToMatch (
  tab,
  editor,
  expectedValue = expectedTitleForEditor(editor)
) {
  let title = tab.querySelector('.title').innerText;
  expect(title).toMatch(expectedValue);
}

function expectedTitleForEditor (editor) {
  let firstLine = editor.buffer.lineForRow(0);
  return firstLine.trim() || 'untitled'
}

let tempPath = temp.mkdirSync(`tab-title-redux-${Math.random()}`);

describe('TabTitleRedux', () => {
  let activePane;

  beforeEach(async () => {
    await atom.packages.activatePackage('tabs');
    activePane = atom.workspace.getCenter().paneContainer.activePane;
  });

  describe('when the package activates', () => {
    it('converts existing “untitled” buffers to have titles', async () => {
      addUntitledEditor('lorem');
      addUntitledEditor('ipsum');
      expectTabsToMatch(activePane, 'untitled');
      await atom.packages.activatePackage('tab-title-redux');
      expectTabsToMatch(activePane);
    });
  });

  describe('when the package deactivates', () => {
    it('reverts to original tab-naming logic', async () => {
      await atom.packages.activatePackage('tab-title-redux');
      let editor1 = addUntitledEditor('lorem');
      let editor2 = addUntitledEditor('ipsum');
      expectTabsToMatch(activePane);

      await atom.packages.deactivatePackage('tab-title-redux');
      expectTabToMatch(tabForEditor(editor1), editor1, 'untitled');
      expectTabToMatch(tabForEditor(editor2), editor2, 'untitled');
    })
  });

  describe('when the editor contents change', () => {
    it('updates the tab title', async () => {
      let editor = addUntitledEditor('');
      expectTabToMatch(tabForEditor(editor), editor, 'untitled');
      await atom.packages.activatePackage('tab-title-redux');
      expectTabToMatch(tabForEditor(editor), editor, 'untitled');

      editor.setText(`lorem ipsum dolor`);
      expectTabToMatch(tabForEditor(editor), editor, 'lorem ipsum dolor');

      editor.setCursorBufferPosition([0, 5]);
      editor.insertText('x');
      expectTabToMatch(tabForEditor(editor), editor, 'loremx ipsum dolor');

      editor.setCursorBufferPosition([0, 0]);
      editor.insertText('\n');
      expectTabToMatch(tabForEditor(editor), editor, 'untitled');
    });
  });

  describe('when the buffer is saved', () => {
    it('reverts to standard tab title logic', async () => {
      let editor = addUntitledEditor('');
      expectTabToMatch(tabForEditor(editor), editor, 'untitled');
      await atom.packages.activatePackage('tab-title-redux');
      expectTabToMatch(tabForEditor(editor), editor, 'untitled');
      editor.setText(`lorem ipsum dolor`);
      expectTabToMatch(tabForEditor(editor), editor, 'lorem ipsum dolor');
      await editor.saveAs(path.join(tempPath, 'foo.txt'));
      expectTabToMatch(tabForEditor(editor), editor, 'foo.txt');
    });
  });

  describe('when the buffer is moved to another pane container', () => {
    it('keeps its custom title', async () => {
      jasmine.useRealClock();
      await atom.packages.activatePackage('tab-title-redux');
      let activePane = atom.workspace.getCenter().paneContainer.activePane;
      let newPane = activePane.splitRight();
      let editor = addUntitledEditor('wat', activePane);
      expect(atom.workspace.paneForItem(editor)).toBe(activePane);
      expectTabToMatch(tabForEditor(editor), editor, 'wat');

      activePane.moveItemToPane(editor, newPane, 0);
      expect(atom.workspace.paneForItem(editor)).toBe(newPane);
      expectTabToMatch(tabForEditor(editor), editor, 'wat');
    });
  });

  describe('when the default label is changed', () => {
    it('updates all applicable tab labels', async () => {
      atom.config.set('tab-title-redux.defaultTitle', 'zort');
      jasmine.useRealClock();
      await atom.packages.activatePackage('tab-title-redux');

      let editor = addUntitledEditor('');
      expectTabToMatch(tabForEditor(editor), editor, 'zort');

      atom.config.set('tab-title-redux.defaultTitle', 'troz');
      expectTabToMatch(tabForEditor(editor), editor, 'troz');

      editor.setText(`lorem ipsum dolor`);
      expectTabToMatch(tabForEditor(editor), editor, 'lorem ipsum dolor');

      editor.setText('');
      expectTabToMatch(tabForEditor(editor), editor, 'troz');
    });
  });

});
