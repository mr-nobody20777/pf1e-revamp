// Footnotes: a short note under the description of any item this module automates, on its item
// sheet and on its chat cards. Added at render time only, so item data (including PF1's own items)
// is never modified.

import { MODULE_ID, MODULE_TITLE } from "./const.mjs";

const footnotes = [];

/**
 * @param {(item: Item) => Array<string | Node> | null} fn Returns the footnote content (text and
 *   elements, e.g. from {@link footnoteButton}) for items this feature handles, else null.
 */
export function registerFootnote(fn) {
  footnotes.push(fn);
}

/** Small inline button for use inside a footnote. */
export function footnoteButton(label, tooltip, onClick) {
  const a = document.createElement("button");
  a.type = "button"; // never submits the item sheet's form
  a.className = `${MODULE_ID}-footnote-button`;
  a.textContent = label;
  a.dataset.tooltip = tooltip;
  a.style.cssText =
    "display: inline-block; width: auto; height: auto; line-height: 1.4; margin: 2px 0.25em; padding: 1px 8px; font-size: inherit; font-style: normal; font-weight: bold; border: 1px solid var(--color-border-dark-4, #777); border-radius: 4px; background: var(--color-bg-btn, rgba(0, 0, 0, 0.08)); cursor: pointer;";
  a.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return a;
}

function buildFootnote(item) {
  if (!item) return null;
  const lines = footnotes.map((fn) => fn(item)).filter(Boolean);
  if (!lines.length) return null;

  const note = document.createElement("div");
  note.className = `${MODULE_ID}-footnote`;
  note.style.cssText = "margin-top: 0.5em; padding-top: 0.25em; border-top: 1px solid var(--color-border-light-2, #999); font-size: var(--font-size-12, 12px); font-style: italic; opacity: 0.9;";
  for (const content of lines) {
    const p = document.createElement("p");
    const label = document.createElement("strong");
    label.textContent = `${MODULE_TITLE}: `;
    p.append(label, ...content);
    note.append(p);
  }
  return note;
}

Hooks.on("renderItemSheetPF", (app, html) => {
  const root = html[0] ?? html; // jQuery on classic sheets
  const tab = root.querySelector(".tab.description");
  const note = tab && buildFootnote(app.item);
  if (!note) return;

  const instructions = tab.querySelector(".instructions");
  if (instructions) instructions.before(note);
  else tab.append(note);
});

Hooks.on("renderChatMessagePF", (message, html) => {
  const description = html.querySelector(".card-content .item-description");
  const note = description && buildFootnote(message.itemSource);
  if (note) description.after(note);
});

/** Re-render the item's sheet and recent chat cards so footnotes show current state. */
export function refreshFootnotes(item) {
  if (item.sheet?.rendered) item.sheet.render();
  for (const message of game.messages.contents.slice(-50)) {
    if (message.system?.item?.id === item.id && message.itemSource === item) ui.chat.updateMessage(message);
  }
}
