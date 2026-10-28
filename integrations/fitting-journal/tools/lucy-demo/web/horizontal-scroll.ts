/** Native touch scrolling, plus mouse dragging and wheel support on desktop. */
export function horizontalScroll(element: HTMLElement) {
  let pointer: number | null = null, start = 0, initial = 0, dragged = false;
  element.addEventListener('dragstart', event => event.preventDefault());
  element.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    pointer = event.pointerId; start = event.clientX; initial = element.scrollLeft; dragged = false;
  });
  element.addEventListener('pointermove', event => {
    if (pointer !== event.pointerId) return;
    if (!dragged && Math.abs(event.clientX - start) < 5) return;
    dragged = true; element.setPointerCapture(event.pointerId);
    element.scrollLeft = initial + start - event.clientX;
    event.preventDefault();
  });
  const end = () => { pointer = null; };
  element.addEventListener('pointerup', end);
  element.addEventListener('pointercancel', end);
  element.addEventListener('lostpointercapture', end);
  element.addEventListener('pointerleave', () => { if (!dragged) end(); });
  element.addEventListener('click', event => {
    if (dragged) { event.preventDefault(); event.stopImmediatePropagation(); dragged = false; }
  }, true);
  element.addEventListener('wheel', event => {
    const previous = element.scrollLeft;
    element.scrollLeft += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (element.scrollLeft !== previous) event.preventDefault();
  }, { passive: false });
}
