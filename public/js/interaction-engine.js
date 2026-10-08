const identity = () => ({ tally: 0, anchor: null, timer: null, consumed: false });
const distance = (a, b) => Math.hypot(a.x - b.clientX, a.y - b.clientY);

export function composeSurface(selector, descriptors, effects, policy = {}) {
  const controller = new AbortController();
  const records = new Map(descriptors.map((descriptor) => [descriptor.key, identity()]));
  const options = { capture: true, signal: controller.signal };
  const resolve = (event) => event.target instanceof Element && event.target.closest(selector);
  const cancel = () => {
    for (const record of records.values()) {
      clearTimeout(record.timer);
      record.anchor = null;
      record.timer = null;
    }
  };
  const emit = (descriptor, element) => {
    records.get(descriptor.key).tally = 0;
    effects.get(descriptor.effect)?.(element);
  };
  document.addEventListener(
    'pointerdown',
    (event) => {
      const element = resolve(event);
      if (!element || event.button !== 0) return;
      cancel();
      for (const descriptor of descriptors.filter((entry) => entry.mode === 'span')) {
        const record = records.get(descriptor.key);
        record.consumed = false;
        record.anchor = { x: event.clientX, y: event.clientY, element };
        record.timer = setTimeout(() => {
          if (!record.anchor?.element.isConnected) return;
          record.consumed = true;
          record.anchor = null;
          emit(descriptor, element);
        }, descriptor.boundary);
      }
    },
    options,
  );
  document.addEventListener(
    'pointermove',
    (event) => {
      if (
        [...records.values()].some(
          (record) =>
            record.anchor &&
            (distance(record.anchor, event) > 12 || !record.anchor.element.contains(event.target)),
        )
      )
        cancel();
    },
    options,
  );
  for (const event of ['pointerup', 'pointercancel'])
    document.addEventListener(event, cancel, options);
  document.addEventListener(
    'contextmenu',
    (event) => {
      if (resolve(event)) event.preventDefault();
      else cancel();
    },
    options,
  );
  document.addEventListener(
    'click',
    (event) => {
      const element = resolve(event);
      if (!element) return;
      if ([...records.values()].some((record) => record.consumed)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        for (const record of records.values()) record.consumed = false;
        return;
      }
      let projected = false;
      for (const descriptor of descriptors.filter((entry) => entry.mode === 'sum')) {
        const record = records.get(descriptor.key);
        if (++record.tally >= descriptor.boundary) {
          emit(descriptor, element);
          projected = true;
        }
      }
      if (!policy.passThrough || projected) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    options,
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) cancel();
    },
    options,
  );
  window.addEventListener('blur', cancel, { signal: controller.signal });
  return () => {
    cancel();
    controller.abort();
  };
}
