// Checkout oficial. Atualize esta constante se o endereço do produto mudar.
const CHECKOUT_CAKTO_URL = "https://pay.cakto.com.br/nwyvmfs_1200486";

document.querySelectorAll('[data-checkout]').forEach(link => {
  link.href = CHECKOUT_CAKTO_URL;
  link.rel = 'external noopener';
});
document.getElementById('year').textContent = new Date().getFullYear();
const sticky = document.querySelector('.sticky-buy');
const hero = document.querySelector('.hero');
const observer = new IntersectionObserver(([entry]) => {
  sticky.hidden = entry.isIntersecting || window.scrollY < 200;
}, { threshold: 0 });
observer.observe(hero);
const dialog = document.getElementById('legal-dialog');
const content = {
  privacy: { title: 'Política de privacidade', body: '<p>Esta página não possui formulário ou cadastro. Utilizamos o Meta Pixel e a tag do Google Ads para medir visitas à página e a eficácia das campanhas de publicidade. Essas tecnologias podem utilizar cookies e enviar à Meta e ao Google informações técnicas de navegação, como endereço IP, navegador e URL visitada.</p><p>Ao selecionar um botão de compra, você será direcionada à Cakto. Os dados necessários à transação e à entrega do produto são tratados na plataforma de pagamento, conforme suas políticas de privacidade e condições de uso.</p><p>As imagens são servidas junto com esta página. As fontes são carregadas de Google Fonts. Esse serviço recebe dados técnicos da conexão, como endereço IP, para entregar os arquivos.</p><p>Saiba mais sobre o tratamento de dados pela Meta em <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">sua Política de Privacidade</a>. Saiba também como o Google usa dados em <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">sites que utilizam seus serviços</a>. Você pode gerenciar cookies e bloqueios de rastreamento nas configurações do navegador. Para solicitações sobre dados de uma compra, utilize o suporte indicado no comprovante ou na plataforma Cakto.</p>' },
  terms: { title: 'Termos de uso', body: '<p>Menopausa Real 40+ é um e-book digital em PDF, por R$ 29,90, com acesso vitalício. A liberação ocorre após a confirmação do pagamento pela Cakto; os prazos variam conforme o meio de pagamento.</p><p>O conteúdo é educativo e informativo. Não oferece diagnóstico, prescrição ou aconselhamento individual e não substitui consulta ou acompanhamento profissional. Dúvidas sobre sintomas devem ser avaliadas por um profissional de saúde.</p><p>O material é destinado ao uso pessoal. Sua compra não autoriza reprodução, revenda ou distribuição sem autorização do titular dos direitos.</p><p>As condições da transação, o atendimento e os procedimentos de cancelamento e reembolso devem ser consultados no checkout e no comprovante da compra, respeitando os direitos previstos na legislação aplicável, inclusive o direito de arrependimento quando cabível.</p>' },
  contact: { title: 'Contato e suporte', body: '<p>Para dúvidas sobre pagamento, acesso ao PDF ou sua compra, consulte os canais de suporte informados no comprovante enviado pela Cakto ou nos detalhes do pedido na plataforma.</p><p>Tenha o comprovante à mão ao procurar atendimento. Não envie senhas ou dados completos do cartão.</p><p>Para orientações sobre sua saúde, procure um profissional habilitado. O suporte do produto não realiza atendimento médico.</p>' }
};
document.querySelectorAll('[data-dialog]').forEach(button => button.addEventListener('click', () => {
  const item = content[button.dataset.dialog];
  document.getElementById('dialog-title').textContent = item.title;
  document.getElementById('dialog-body').innerHTML = item.body;
  dialog.setAttribute('aria-labelledby', 'dialog-title');
  dialog.showModal();
}));
document.getElementById('close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }
});

// Lightweight progressive reveals; all content stays visible without JavaScript.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.section-heading, .symptoms article, .split > div, .page, .changes > div, .offer-copy, .offer-card, .audience > div, .audience-list li, .faq-layout > div, .final .wrap').forEach((element, index) => {
    element.classList.add('reveal-ready');
    element.style.setProperty('--delay', `${(index % 4) * 55}ms`);
    revealObserver.observe(element);
  });
}
const progress = document.querySelector('.reading-progress');
let scrollTicking = false;
function updateProgress() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${maxScroll > 0 ? window.scrollY / maxScroll : 0})`;
  scrollTicking = false;
}
window.addEventListener('scroll', () => {
  if (!scrollTicking) { window.requestAnimationFrame(updateProgress); scrollTicking = true; }
}, { passive: true });
window.addEventListener('resize', updateProgress);
updateProgress();
