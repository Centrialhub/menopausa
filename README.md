# Menopausa Real 40+

Landing page estática e responsiva, com uma Vercel Function Node.js para receber webhooks. O build apenas copia os arquivos públicos, sem dependências externas. Checkout oficial configurado em `CHECKOUT_CAKTO_URL`, no arquivo `script.js`.

## Desenvolvimento local

```sh
python3 -m http.server 3000 --bind 0.0.0.0
```

## Publicação: GitHub → Vercel

1. Na Vercel, selecione **Add New → Project** e importe `Centrialhub/menopausa`.
2. Framework: **Other**. Root Directory: raiz do repositório. Branch de produção: `main`.
3. O arquivo `vercel.json` configura `npm run build`, saída estática em `public` e mantém as Functions em `api`. O webhook exige as variáveis descritas em [docs/cakto-webhook.md](docs/cakto-webhook.md); a landing não exige variáveis.
4. Clique em **Deploy**. Novos pushes na branch `main` geram deploys de produção automaticamente após a integração ser conectada.
5. Após a publicação, confira imagens, FAQ, links legais e botões que levam a `https://pay.cakto.com.br/nwyvmfs_1200486`.

Também é possível publicar pela CLI autenticada: `vercel --prod`.

## Conteúdo

Publique `index.html`, `styles.css`, `script.js` e a pasta `assets`. A página usa Google Fonts, duas imagens geradas por IA e uma ilustração SVG original. As imagens são locais. Não há checkout interno, formulários ou área de membros. O Meta Pixel `296038289614983` está instalado no HTML e registra `PageView`. Eventos de pagamento e compra precisam ser configurados na Cakto; esta página não registra compras confirmadas.

As páginas na seção de preview são composições ilustrativas, identificadas como tal. O PDF é entregue pela plataforma de venda e não faz parte deste repositório. Confira os canais de suporte e as condições comerciais com o responsável pelo produto.

## Experiência visual

Identidade com rosa vibrante, fundos escuros e rosados, tipografia forte e mockup em CSS. Animações de entrada usam IntersectionObserver; movimentos são desativados quando a preferência `prefers-reduced-motion` está ativa. Todos os CTAs têm link direto no HTML e funcionam sem JavaScript.

## Google Ads

Tag base `AW-18515830369` instalada com gtag.js assíncrono. Nenhuma conversão de compra é disparada pela landing page. A integração existente da Cakto é responsável pelas conversões atuais. O novo webhook não envia conversões e não deve duplicar esse fluxo.

## Webhook Cakto (etapa de validação)

Endpoint: `POST /api/cakto-webhook`. Configuração, deduplicação persistente, atribuição e limitações: [docs/cakto-webhook.md](docs/cakto-webhook.md).

Validação local: `npm test` e `npm run build`. Use `vercel dev` para servir a Function localmente com variáveis de desenvolvimento. Não envie vendas sintéticas ao endpoint de produção.
