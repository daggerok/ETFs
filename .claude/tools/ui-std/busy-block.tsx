// ---- busy overlay: spinner over the table while heavy work blocks the page (same block in every app) ----

let busyCount = 0;

function setBusy(on: boolean, label = ''): void {
  busyCount = Math.max(0, busyCount + (on ? 1 : -1));
  const overlay: any = document.getElementById('busy-overlay');
  const text: any = document.getElementById('busy-label');
  if (on && label && text) text.textContent = label;
  if (overlay) overlay.hidden = busyCount === 0;
}

/** Shows the spinner (CSS delays it ~150 ms, so quick work never flashes it), lets it paint, then runs the blocking work. */
function withBusy(label: string, work: () => void): void {
  setBusy(true, label);
  requestAnimationFrame(() => setTimeout(() => {
    try {
      work();
      const scroller: any = document.getElementById('table-scroll');
      if (scroller) void scroller.offsetHeight; // layout of the new rows happens now, under the spinner
    } finally {
      requestAnimationFrame(() => setTimeout(() => setBusy(false), 0));
    }
  }, 0));
}

/** A user action that re-renders the whole table: the spinner shows while it runs (only if it takes longer than a blink). */
function renderBusy(keepRows = true, after?: () => void): void {
  withBusy('Updating the table…', () => {
    render(keepRows);
    if (after) after();
  });
}
