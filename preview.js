// Progressive enhancement scoped to the product showcase. Image links still
// open the real page when JavaScript or native dialog support is unavailable.
(() => {
  const dialog = document.getElementById('guide-preview-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const image = dialog.querySelector('img');
  const title = dialog.querySelector('#guide-preview-title');
  const viewport = dialog.querySelector('.showcase-image-window');
  const zoom = dialog.querySelector('[data-preview-zoom]');
  let trigger;
  document.querySelectorAll('#por-dentro [data-guide-preview]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      trigger = link;
      title.textContent = link.getAttribute('aria-label').replace('Ampliar ', '');
      image.alt = link.querySelector('img').alt;
      image.src = link.href;
      dialog.showModal();
      viewport.scrollTop = 0;
      viewport.scrollLeft = 0;
    });
  });
  zoom.addEventListener('click', () => {
    const enlarged = viewport.classList.toggle('is-zoomed');
    zoom.setAttribute('aria-pressed', String(enlarged));
    zoom.textContent = enlarged ? 'Ajustar à tela' : 'Ampliar texto';
  });
  dialog.querySelector('[data-preview-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    viewport.classList.remove('is-zoomed');
    zoom.setAttribute('aria-pressed', 'false');
    zoom.textContent = 'Ampliar texto';
    image.removeAttribute('src');
    trigger?.focus({ preventScroll: true });
  });
})();
