/** @typedef {import('@testing-library/user-event').default} UserEvent */

const userEvent = require('@testing-library/user-event/dist/cjs/index.js').default;

const pointerFix = { pointerEventsCheck: 0 };

const withOptsAt = (original, index) => (...args) => {
  const next = [...args];
  if (typeof next[index] === 'object' && next[index] !== null) {
    next[index] = { ...pointerFix, ...next[index] };
  } else {
    next.splice(index, 0, pointerFix);
  }
  return original(...next);
};

const patched = {
  ...userEvent,
  setup: (options) => userEvent.setup({ ...pointerFix, ...options }),
  click: withOptsAt(userEvent.click.bind(userEvent), 1),
  dblClick: withOptsAt(userEvent.dblClick.bind(userEvent), 1),
  tripleClick: withOptsAt(userEvent.tripleClick.bind(userEvent), 1),
  hover: withOptsAt(userEvent.hover.bind(userEvent), 1),
  unhover: withOptsAt(userEvent.unhover.bind(userEvent), 1),
  type: withOptsAt(userEvent.type.bind(userEvent), 2),
  clear: withOptsAt(userEvent.clear.bind(userEvent), 1),
  selectOptions: withOptsAt(userEvent.selectOptions.bind(userEvent), 2),
  deselectOptions: withOptsAt(userEvent.deselectOptions.bind(userEvent), 2),
  upload: withOptsAt(userEvent.upload.bind(userEvent), 2),
  keyboard: withOptsAt(userEvent.keyboard.bind(userEvent), 1),
  tab: withOptsAt(userEvent.tab.bind(userEvent), 0),
  pointer: withOptsAt(userEvent.pointer.bind(userEvent), 1),
};

module.exports = patched;
module.exports.default = patched;
