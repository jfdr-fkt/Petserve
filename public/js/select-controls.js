import { escapeHTML as e } from './utils.js';

const controls = new WeakMap();
let active = null,
  sequence = 0,
  prefix = '',
  typedAt = 0,
  scheduled = false;

function sync(select) {
  const record = controls.get(select);
  if (!record) return;
  record.button.querySelector('.select-value').textContent =
    select.selectedOptions[0]?.label || 'Choose an option';
  record.button.disabled = select.disabled;
  record.button.setAttribute('aria-required', String(select.required));
  record.button.removeAttribute('aria-invalid');
}

export function dismissSelectMenu(focus = false) {
  if (!active) return;
  const { button, wrapper, menu } = active;
  active = null;
  prefix = '';
  menu.remove();
  wrapper.classList.remove('select-expanded');
  button.setAttribute('aria-expanded', 'false');
  button.removeAttribute('aria-activedescendant');
  if (focus && button.isConnected) button.focus({ preventScroll: true });
}

function position() {
  if (!active) return;
  const { button, menu } = active;
  if (!button.isConnected) {
    dismissSelectMenu();
    return;
  }
  const box = button.getBoundingClientRect();
  if (box.bottom < 0 || box.top > innerHeight) {
    dismissSelectMenu();
    return;
  }
  const below = innerHeight - box.bottom - 16,
    above = box.top - 16;
  const downward = below >= Math.min(220, above);
  const height = Math.min(300, Math.max(80, downward ? below : above));
  menu.style.width = `${Math.min(innerWidth - 24, Math.max(box.width, 200))}px`;
  menu.style.maxHeight = `${height}px`;
  const width = menu.getBoundingClientRect().width;
  menu.style.left = `${Math.max(12, Math.min(box.left, innerWidth - width - 12))}px`;
  menu.style.top = `${downward ? box.bottom + 8 : box.top - menu.getBoundingClientRect().height - 8}px`;
}

function highlight(index) {
  if (!active) return;
  active.index = index;
  for (const option of active.menu.children)
    option.classList.toggle('highlighted', Number(option.dataset.index) === index);
  const option = active.menu.querySelector(`[data-index="${index}"]`);
  if (option) {
    active.button.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  }
}

function choose(index) {
  if (!active || !active.select.options[index] || active.select.options[index].disabled) return;
  const select = active.select;
  const changed = select.selectedIndex !== index;
  select.selectedIndex = index;
  sync(select);
  dismissSelectMenu(true);
  if (changed) {
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function open(record) {
  if (record.select.disabled) return;
  dismissSelectMenu();
  const menu = document.createElement('div');
  menu.id = record.menuId;
  menu.className = 'select-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', record.label);
  menu.innerHTML = [...record.select.options]
    .map(
      (option, index) =>
        `<div role="option" id="${record.menuId}-${index}" data-index="${index}" aria-selected="${option.selected}" ${option.disabled ? 'aria-disabled="true"' : ''}><span>${e(option.label)}</span>${option.selected ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>' : ''}</div>`,
    )
    .join('');
  (record.select.closest('[role="dialog"]') || document.body).append(menu);
  active = { ...record, menu, index: record.select.selectedIndex };
  record.wrapper.classList.add('select-expanded');
  record.button.setAttribute('aria-expanded', 'true');
  record.button.focus({ preventScroll: true });
  position();
  highlight(
    record.select.selectedIndex >= 0 && !record.select.options[record.select.selectedIndex].disabled
      ? record.select.selectedIndex
      : [...record.select.options].findIndex((option) => !option.disabled),
  );
}

export function decorateSelects(scope) {
  for (const select of scope.querySelectorAll('select:not([multiple])')) {
    if (controls.has(select)) {
      sync(select);
      continue;
    }
    const wrapper = document.createElement('div'),
      button = document.createElement('button');
    const label = select.labels?.[0];
    const labelText =
      select.getAttribute('aria-label') || label?.textContent.trim() || 'Choose an option';
    const menuId = `select-menu-${++sequence}`;
    wrapper.className = 'select-control';
    button.type = 'button';
    button.className = 'select-trigger';
    button.setAttribute('role', 'combobox');
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', menuId);
    button.setAttribute('aria-label', labelText);
    button.innerHTML =
      '<span class="select-value"></span><svg class="select-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    select.before(wrapper);
    wrapper.append(select, button);
    select.classList.add('select-native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    const record = { select, wrapper, button, menuId, label: labelText };
    controls.set(select, record);
    controls.set(button, record);
    select.addEventListener('focus', () => button.focus({ preventScroll: true }));
    button.addEventListener('blur', () => {
      if (active?.button === button) dismissSelectMenu();
    });
    select.addEventListener('invalid', () => button.setAttribute('aria-invalid', 'true'));
    sync(select);
  }
}

document.addEventListener(
  'change',
  (event) => {
    if (event.target instanceof HTMLSelectElement) {
      sync(event.target);
      if (active?.select === event.target) dismissSelectMenu();
    }
  },
  true,
);
document.addEventListener(
  'pointerdown',
  (event) => {
    if (!active) return;
    if (active.menu.contains(event.target)) event.preventDefault();
    else if (!active.wrapper.contains(event.target)) dismissSelectMenu();
  },
  true,
);
document.addEventListener(
  'click',
  (event) => {
    const button = event.target.closest('.select-trigger');
    if (button && controls.has(button)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (active?.button === button) dismissSelectMenu();
      else open(controls.get(button));
    } else if (active?.menu.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const option = event.target.closest('[role="option"]');
      if (option) choose(Number(option.dataset.index));
    }
  },
  true,
);
document.addEventListener(
  'keydown',
  (event) => {
    const record = controls.get(event.target);
    if (!record || event.target !== record.button) return;
    const options = [...record.select.options]
      .map((option, index) => ({ option, index }))
      .filter(({ option }) => !option.disabled);
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Escape'];
    if (event.key === 'Escape' && !active) return;
    if (event.key === 'Tab') {
      dismissSelectMenu();
      return;
    }
    if (
      !keys.includes(event.key) &&
      (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey)
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === 'Escape') {
      dismissSelectMenu(true);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      if (active?.button === record.button) choose(active.index);
      else open(record);
      return;
    }
    if (!active || active.button !== record.button) open(record);
    if (!options.length) return;
    const current = options.findIndex(({ index }) => index === active.index);
    if (event.key === 'Home') highlight(options[0].index);
    else if (event.key === 'End') highlight(options.at(-1).index);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp')
      highlight(
        options[(current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length]
          .index,
      );
    else {
      prefix = Date.now() - typedAt > 700 ? event.key : prefix + event.key;
      typedAt = Date.now();
      const found = options.find(({ option }) =>
        option.label.toLowerCase().startsWith(prefix.toLowerCase()),
      );
      if (found) highlight(found.index);
    }
  },
  true,
);
const reposition = () => {
  if (!active || scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    position();
  });
};
window.addEventListener('resize', reposition);
document.addEventListener('scroll', reposition, true);
window.addEventListener('blur', () => dismissSelectMenu());
