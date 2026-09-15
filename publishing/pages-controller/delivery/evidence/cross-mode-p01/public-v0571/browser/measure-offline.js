(() => {
  const visible = element => {
    if (!element) return null;
    const r = element.getBoundingClientRect(), style = getComputedStyle(element);
    return { text: element.textContent?.trim(), hidden: element.hidden, display: style.display, visibility: style.visibility,
      rect: r.toJSON(), fullyInViewport: !element.hidden && r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
  };
  const status = document.getElementById('offline-status'), note = document.getElementById('offline-optional-note');
  return { time: new Date().toISOString(), href: location.href, timeOrigin: performance.timeOrigin,
    viewport: { width: innerWidth, height: innerHeight }, focus: document.activeElement?.id,
    settingsScrollTop: document.getElementById('settings-dialog')?.scrollTop,
    preferences: { face: document.getElementById('text-face')?.value, size: document.getElementById('text-size')?.value, reduced: document.getElementById('settings-reduced-effects')?.checked },
    status: { ...visible(status), state: status?.dataset.state, stage: status?.dataset.stage },
    label: visible(status?.querySelector('.operation-status-label')), count: visible(status?.querySelector('.operation-status-count')),
    meter: { ...visible(status?.querySelector('progress')), value: status?.querySelector('progress')?.value, max: status?.querySelector('progress')?.max },
    action: visible(document.getElementById('offline-button')), stop: visible(document.getElementById('offline-stop')),
    note: { ...visible(note), detailsOpen: note?.closest('details')?.open },
    signalAnimation: status?.querySelector('i') ? getComputedStyle(status.querySelector('i')).animationName : null,
    rawDetails: document.getElementById('offline-details')?.textContent };
})()
