# `tab-title-redux` package

Sets the tab title of a temporary buffer (one not yet saved to disk) to match its first line contents.


<p>
  <img width="704" alt="pulsar-hover screenshot" src="https://raw.githubusercontent.com/savetheclocktower/tab-title-redux/main/docs/screenshot.png" />
</p>

Inspired by similar packages like [tab-title](https://web.pulsar-edit.dev/packages/tab-title) and [un-untitled](https://web.pulsar-edit.dev/packages/un-untitled); these packages were in turn inspired by a similar behavior in Sublime Text.

## Configuration

* **Default Title**: A fallback title in the event of a blank line or buffer. Defaults to `untitled`, just like Pulsar.
* **Maximum Title Length**: The maximum length of a title before it’s truncated. (Tabs themselves will nearly always truncate before this point, but the tab title is repeated in the window title, and this guards against having too much text in the window title.) Defaults to `100`.
* **Search For First Row**: When checked, will find the first non-blank row of the buffer and use that to determine the tab title. When unchecked, will search only row 1 of the buffer for text, falling back to the default title if row 1 is blank.

## How does it work?

First, a definition: a _temporary buffer_ is a buffer that does not yet have a location on disk. When you create a new editor via the **Application: New File** command, you have created a temporary buffer, and it stays temporary until you save it to disk.

Instead of making each such temporary buffer have the same `untitled` name, we make it so that they have names that mirror the first line of text.

This package has no commands, no menus, and no keybindings. When activated, it applies a patch to a text editor’s logic for what to call itself. When deactivated, it reverts the patch. It does no direct DOM manipulation.

This package does no direct DOM manipulation. Instead, it spies on `Pane` items and overwrites any `getTitle` and `getLongTitle` functions to substitute custom logic for determining the window title when the buffer is temporary. This logic reverts to the default if the buffer is saved or if this package is deactivated.

Pulsar is not used to the editor’s title changing more often than the editor’s path on disk changes, so we insert extra logic to update tab titles on every keystroke that changes the first line of text.
