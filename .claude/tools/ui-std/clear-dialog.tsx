/** Which items were ticked the last time OK was pressed; an item never seen before is ticked. */
function loadClearChoices(): Record<string, boolean> {
  try {
    const saved = JSON.parse(localStorage.getItem(CLEAR_CHOICES_KEY) || '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

/**
 * The Clear button: a dialog in the style of the app lists what can be reset (all ticked the first time, afterwards as
 * it was left at the last OK). Enter is OK, Esc or a click outside is Cancel, Cancel changes and remembers nothing.
 */
function clearSelectionAndSearch(): void {
  if (document.getElementById('clear-dialog')) return;
  const saved = loadClearChoices();
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const backdrop = document.createElement('div');
  backdrop.id = 'clear-dialog';
  backdrop.className = 'clear-backdrop';
  backdrop.innerHTML = `
    <div class="clear-modal" role="dialog" aria-modal="true" aria-labelledby="clear-title">
      <h2 id="clear-title" class="clear-title">Clear</h2>
      <p class="clear-hint">Choose what to reset to the first-visit view. Your choice is remembered for the next time.</p>
      <div class="clear-tools">
        <button type="button" class="dd-act" data-clear-all>All</button>
        <button type="button" class="dd-act" data-clear-none>None</button>
      </div>
      <div class="clear-list">
        ${RESET_ITEMS.map(item => `<label class="clear-row"><input type="checkbox" data-clear-id="${item.id}" class="w-4 h-4 accent-blue-600" ${saved[item.id] === false ? '' : 'checked'} /><span>${escapeHtml(item.label)}</span></label>`).join('')}
      </div>
      <div class="clear-actions">
        <button type="button" class="clear-btn" data-clear-cancel>Cancel<kbd>Esc</kbd></button>
        <button type="button" class="clear-btn clear-btn-ok" data-clear-ok>OK<kbd>Enter</kbd></button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  const boxes = Array.from(backdrop.querySelectorAll<HTMLInputElement>('input[data-clear-id]'));
  const okBtn = backdrop.querySelector<HTMLButtonElement>('[data-clear-ok]');
  const allBtn = backdrop.querySelector<HTMLButtonElement>('[data-clear-all]');
  const noneBtn = backdrop.querySelector<HTMLButtonElement>('[data-clear-none]');
  const cancelBtn = backdrop.querySelector<HTMLButtonElement>('[data-clear-cancel]');
  if (!okBtn || !allBtn || !noneBtn || !cancelBtn) return;
  const syncOk = (): void => { okBtn.disabled = !boxes.some(box => box.checked); };
  const close = (): void => {
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    if (opener && typeof opener.focus === 'function') opener.focus();
  };
  const ok = (): void => {
    if (okBtn.disabled) return;
    const choices: Record<string, boolean> = {};
    boxes.forEach(box => { choices[box.dataset.clearId || ''] = box.checked; });
    try { localStorage.setItem(CLEAR_CHOICES_KEY, JSON.stringify(choices)); } catch { /* private mode: the choice is simply not remembered */ }
    close();
    applyClear(new Set(Object.keys(choices).filter(id => choices[id])));
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Enter') {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target && target.closest('[data-clear-cancel], [data-clear-all], [data-clear-none]')) return; // Enter on a focused button presses that button
      event.preventDefault();
      event.stopPropagation();
      ok();
    } else if (event.key === 'Tab') {
      const focusable = Array.from(backdrop.querySelectorAll<HTMLElement>('input, button:not(:disabled)'));
      const index = document.activeElement instanceof HTMLElement ? focusable.indexOf(document.activeElement) : -1;
      const next = event.shiftKey ? (index <= 0 ? focusable.length - 1 : index - 1) : (index === focusable.length - 1 ? 0 : index + 1);
      event.preventDefault();
      focusable[next].focus();
    }
  };
  document.addEventListener('keydown', onKey, true);
  backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) close(); });
  backdrop.addEventListener('change', syncOk);
  allBtn.addEventListener('click', () => { boxes.forEach(box => { box.checked = true; }); syncOk(); });
  noneBtn.addEventListener('click', () => { boxes.forEach(box => { box.checked = false; }); syncOk(); });
  cancelBtn.addEventListener('click', close);
  okBtn.addEventListener('click', ok);
  syncOk();
  okBtn.focus();
}
