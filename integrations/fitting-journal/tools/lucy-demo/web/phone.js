function fitPhone() {
  const scale = Math.min(
    (globalThis.innerWidth - 40) / 414,
    (globalThis.innerHeight - 40) / 892,
    1.15,
  );
  globalThis.document.documentElement.style.setProperty(
    '--phone-scale',
    String(Math.max(0.2, scale)),
  );
}
globalThis.addEventListener('resize', fitPhone);
fitPhone();
