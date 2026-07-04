/* Shell embed mode — site opens over Earth on astranov.eu */
(function () {
  const p = new URLSearchParams(location.search);
  if (p.get('shell') !== '1' && p.get('embed') !== '1') return;
  document.documentElement.classList.add('as-embed-shell');
  const style = document.createElement('style');
  style.textContent = `
    html.as-embed-shell .topbar { padding:4px 8px; min-height:36px; }
    html.as-embed-shell body { background:transparent; }
  `;
  document.head.appendChild(style);
})();