const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { join } = require('node:path');
const root = join(__dirname, '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const checkout = 'https://pay.cakto.com.br/nwyvmfs_1200486';

test('hero has the requested message, price, delivery condition and educational disclaimer', () => {
  const hero = html.split('<div class="hero-art">')[0].split('<div class="hero-copy">')[1];
  const title = hero.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, '');
  assert.equal(title, 'Calorões, noites mal dormidas e mudanças de humor depois dos 40?');
  assert.ok(hero.includes('Entenda o que pode estar acontecendo com seu corpo e descubra como organizar uma rotina de autocuidado nessa nova fase.'));
  assert.ok(hero.includes('Um guia digital prático para mulheres 40+, com informações claras sobre menopausa, perimenopausa e cuidados para o dia a dia.'));
  for (const text of ['R$ 29,90', 'pagamento único', 'QUERO ACESSAR MEU GUIA', 'Guia digital em PDF • Acesso após confirmação do pagamento', 'Não substitui avaliação ou acompanhamento médico.']) assert.ok(hero.includes(text), text);
});

test('every purchase link still targets the original Cakto checkout', () => {
  const buttons = [...html.matchAll(/<a\b[^>]*(?:data-checkout|class="header-link")[^>]*>/g)];
  assert.equal(buttons.length, 6);
  buttons.forEach(([tag]) => assert.ok(tag.includes('href="' + checkout + '"')));
  assert.ok(readFileSync(join(root, 'script.js'), 'utf8').includes('const CHECKOUT_CAKTO_URL = "' + checkout + '"'));
});

test('Meta Pixel, Google Ads and page script tags are unchanged', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8').replace('<script src="preview.js" defer></script>', '');
  assert.deepEqual([...html.matchAll(/<script\b[\s\S]*?<\/script>/g)].map(x => x[0]), ["<script src=\"script.js\" defer></script>","<script async src=\"https://www.googletagmanager.com/gtag/js?id=AW-18515830369\"></script>","<script>\r\nwindow.dataLayer = window.dataLayer || [];\r\nfunction gtag(){dataLayer.push(arguments);}\r\ngtag('js', new Date());\r\ngtag('config', 'AW-18515830369');\r\n</script>","<script>\r\n!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?\r\nn.callMethod.apply(n,arguments):n.queue.push(arguments)};\r\nif(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';\r\nn.queue=[];t=b.createElement(e);t.async=!0;\r\nt.src=v;s=b.getElementsByTagName(e)[0];\r\ns.parentNode.insertBefore(t,s)}(window,document,'script',\r\n'https://connect.facebook.net/en_US/fbevents.js');\r\nfbq('init', '296038289614983');\r\nfbq('track', 'PageView');\r\n</script>"]);
  assert.ok(html.includes('https://www.facebook.com/tr?id=296038289614983&amp;ev=PageView&amp;noscript=1'));
});

test('checkout logic, webhook, deployment settings and original artwork stay byte-identical', () => {
  const baseline = [{"file":"script.js","hash":"eba640310200b1cfe489e9ade72815955d185490a62c8039cef7be0f935a2651"},{"file":"api/cakto-webhook.js","hash":"a95eebaff64ceadc5fd0f2742f4463d4a565fb89bb11a61ee7627188be8fee08"},{"file":"vercel.json","hash":"92d42661d3e9d46b0a5cdfa9e37da4d89a0b0d93e8362958a0b212b5bc18418a"},{"file":"assets/hero-wellness.webp","hash":"61c5be3bf7c6f73e0befeeee0a15d444cc23b63df875b593677cc983d0c30d19"},{"file":"assets/mulher.webp","hash":"93bfb0543a7e47fc32ae70b84c4b5802b953f300cf1870786259b4c534177dd8"},{"file":"assets/ritual.svg","hash":"3d363d3599855fdff9d14c5e53863f77624ed6ce57b89cce94010e17674cce4d"}];
  baseline.forEach(({ file, hash }) => assert.equal(createHash('sha256').update(readFileSync(join(root, file))).digest('hex'), hash, file));
});

test('product presentation is explicitly digital and uses three real, expandable PDF previews', () => {
  const showcase = html.match(/<section class="section preview[\s\S]*?<\/section>/)[0];
  assert.ok(showcase.includes('Capa e páginas reais do guia digital.'));
  assert.ok(showcase.includes('Guia digital em PDF • 16 páginas • Acesso após confirmação do pagamento.'));
  assert.equal([...showcase.matchAll(/data-guide-preview href=/g)].length, 3);
  for (const page of ['04', '08', '14']) {
    assert.ok(showcase.includes(`href="assets/guide-page-${page}.webp"`));
    assert.ok(readFileSync(join(root, `assets/guide-page-${page}.webp`)).length > 0);
  }
  assert.ok(showcase.includes('<dialog id="guide-preview-dialog"'));
  assert.ok(!showcase.match(/<img[^>]*src=[^>]*width="1200"/));
  assert.ok(html.includes('Um guia digital em PDF com 16 páginas ilustradas'));
  assert.ok(html.includes('Prepare a conversa com seu médico'));
});

test('every section outside the requested showcase remains unchanged', () => {
  const outside = html.replace(/\r\n/g, '\n').replace('class="section wrap identification" id="sintomas"', 'class="section wrap identification"').replace(/<section class=.section preview[\s\S]*?<\/section>/, 'SHOWCASE');
  assert.equal(createHash('sha256').update(outside).digest('hex'), '6dea785411f42e6137656ac81aadaf765d58c5094085f56ea4f9feba3b5926e4');
});

test('Google Ads sitelinks resolve to four unique existing sections', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');
  for (const [id, className, content] of [
    ['sintomas', 'identification', 'Calor que aparece'],
    ['guia', 'intro', 'Foi por isso que criamos'],
    ['por-dentro', 'product-showcase', 'CONHEÇA SEU GUIA POR DENTRO'],
    ['duvidas', 'faq', 'É um produto físico?'],
  ]) {
    const section = html.match(new RegExp(`<section\\b[^>]*id="${id}"[^>]*>[\\s\\S]*?<\\/section>`));
    assert.ok(section, `Missing section #${id}`);
    assert.ok(section[0].includes(className), id);
    assert.ok(section[0].includes(content), id);
  }
});

test('preview opens lazily, zooms, closes and restores focus without touching checkout', () => {
  const { runInNewContext } = require('node:vm');
  const element = () => ({
    events: {}, attributes: {}, textContent: '',
    addEventListener(name, handler) { this.events[name] = handler; },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name]; },
    removeAttribute(name) { delete this[name]; },
  });
  const image = element(), title = element(), zoom = element(), close = element(), viewport = element();
  const classes = new Set();
  viewport.classList = {
    toggle(name) { if (classes.has(name)) { classes.delete(name); return false; } classes.add(name); return true; },
    remove(name) { classes.delete(name); },
  };
  const dialog = element();
  dialog.querySelector = selector => ({ img: image, '#guide-preview-title': title, '.showcase-image-window': viewport, '[data-preview-zoom]': zoom, '[data-preview-close]': close })[selector];
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.events.close(); };
  const link = element();
  link.href = 'assets/guide-page-04.webp';
  link.attributes['aria-label'] = 'Ampliar página 4: climatério e menopausa';
  link.querySelector = () => ({ alt: 'Página real 4' });
  link.focus = () => { link.focused = true; };
  const document = { getElementById: () => dialog, querySelectorAll: () => [link] };
  const code = readFileSync(join(root, 'preview.js'), 'utf8');
  runInNewContext(code, { document });
  assert.equal(image.src, undefined);
  link.events.click({ ctrlKey: true });
  assert.equal(dialog.open, undefined);
  let prevented = false;
  link.events.click({ preventDefault() { prevented = true; } });
  assert.ok(prevented && dialog.open);
  assert.equal(image.src, link.href);
  assert.equal(image.alt, 'Página real 4');
  zoom.events.click();
  assert.equal(zoom.attributes['aria-pressed'], 'true');
  close.events.click();
  assert.equal(dialog.open, false);
  assert.equal(image.src, undefined);
  assert.equal(zoom.attributes['aria-pressed'], 'false');
  assert.ok(link.focused);
  assert.doesNotThrow(() => runInNewContext(code, { document: { getElementById: () => null } }));
});

