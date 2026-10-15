# Menopausa Real 40+

Landing page estática, responsiva e sem dependências de build. Checkout oficial configurado em `CHECKOUT_CAKTO_URL`, no arquivo `script.js`.

## Desenvolvimento local

```sh
python3 -m http.server 3000 --bind 0.0.0.0
```

## Publicação: GitHub → Vercel

1. Na Vercel, selecione **Add New → Project** e importe `Centrialhub/menopausa`.
2. Framework: **Other**. Root Directory: raiz do repositório. Branch de produção: `main`.
3. O arquivo `vercel.json` configura publicação estática sem comando de build, com saída na raiz (`.`). Não são necessárias variáveis de ambiente.
4. Clique em **Deploy**. Novos pushes na branch `main` geram deploys de produção automaticamente após a integração ser conectada.
5. Após a publicação, confira imagens, FAQ, links legais e botões que levam a `https://pay.cakto.com.br/nwyvmfs_1200486`.

Também é possível publicar pela CLI autenticada: `vercel --prod`.

## Conteúdo

Publique `index.html`, `styles.css`, `script.js` e a pasta `assets`. A página usa Google Fonts, duas imagens geradas por IA e uma ilustração SVG original. As imagens são locais. Não há checkout interno, formulários ou área de membros. O Meta Pixel `296038289614983` está instalado no HTML e registra `PageView`. Eventos de pagamento e compra precisam ser configurados na Cakto; esta página não registra compras confirmadas.

As páginas na seção de preview são composições ilustrativas, identificadas como tal. O PDF é entregue pela plataforma de venda e não faz parte deste repositório. Confira os canais de suporte e as condições comerciais com o responsável pelo produto.

## Experiência visual

Identidade com rosa vibrante, fundos escuros e rosados, tipografia forte e mockup em CSS. Animações de entrada usam IntersectionObserver; movimentos são desativados quando a preferência `prefers-reduced-motion` está ativa. Todos os CTAs têm link direto no HTML e funcionam sem JavaScript.

## Google Ads

Tag base `AW-18515830369` instalada com gtag.js assíncrono. Nenhuma conversão de compra é disparada pela landing page. Uma ação de conversão específica requer seu rótulo e configuração no ponto correto do fluxo de compra.
