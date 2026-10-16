# Cakto → Vercel: recebimento de compras aprovadas

## Esta etapa

`POST https://menopausa40.vercel.app/api/cakto-webhook`

Somente `purchase_approved`, com todos os itens em `status: paid`. Não há chamada ao Google Ads, evento de compra no navegador ou mudança na Cakto/landing. A tag Google e o Meta Pixel permanecem iguais.

O contrato implementado é o fornecido na tarefa. A documentação pública da Cakto não pôde ser consultada nesta execução (proxy respondeu 403). A compatibilidade com um payload real, especialmente `parent_order`, `paidAt`, formato monetário e atribuição, precisa ser verificada antes de declarar operação em produção.

## Configurar na Vercel

Cadastrar em Environment Variables, no escopo **Production** (e Preview apenas se necessário), e fazer novo deploy:

- `CAKTO_WEBHOOK_SECRET`: segredo próprio, aleatório e longo, idêntico ao configurado na Cakto. Nunca usar segredo de um exemplo ou enviar valores em chat/Git.
- `UPSTASH_REDIS_REST_URL`: endpoint HTTPS de uma instância Redis persistente compatível com a API REST Upstash.
- `UPSTASH_REDIS_REST_TOKEN`: token com permissão de escrita e EVAL nessa instância. Não usar token read-only.

As variáveis não são públicas e não devem receber prefixo `NEXT_PUBLIC_`/`VITE_`. `.env.example` contém somente nomes vazios. Nenhum serviço Redis foi criado ou contratado nesta tarefa. Pode-se conectar uma instância existente ou adicionar Upstash pela integração da Vercel, verificando nomes e plano. A durabilidade exige armazenamento persistente, sem descarte/eviction dos registros, e política de backup apropriada.

Redis é necessário para satisfazer a deduplicação entre instâncias/restarts da Function. Sem ele, memória local ou arquivos temporários não são confiáveis. Não é necessário Supabase, banco relacional ou SDK. A Function usa apenas Node e HTTPS via `fetch`.

Na Cakto, cadastrar a URL acima, evento **purchase_approved**, disparo **Agrupado**, e o mesmo segredo. Confirmar a política de reenvio da plataforma: resposta 503 NÃO significa registro aceito. Não disparar webhooks de teste da Cakto no armazenamento de produção; usar Preview com segredo/Redis separados. Para validar produção, acompanhar uma transação genuína autorizada, sem gerar métricas fictícias.

## Validação e soma

- Corpo JSON `{secret,event,data}` com `data` array, de 1 a 100 itens, limite de aplicação de 256 KiB.
- `id`: string não vazia; `refId`: string quando presente; `paidAt`: string ISO com data/hora válida.
- `amount`: reais em número ou string decimal com ponto, até duas casas. `29.90 + 9.90` vira `3980` centavos, sem soma monetária de ponto flutuante. Não há inferência de centavos, vírgulas ou unidades; confirmar isso no payload real. Valores ausentes, zero, negativos ou ambíguos são rejeitados.
- Moeda BRL, conforme o produto. Moeda explícita diferente é rejeitada.
- Cada compra precisa ter um `main` sem pai. Cada `orderbump` deve referenciar o `id` ou `refId` inequívoco do principal em `parent_order` (string). Payload apenas com bump é rejeitado; não é possível inferir o valor total sem o principal.
- Vários principais no mesmo lote são separados. Cada bump soma somente no seu principal. Todos os itens precisam estar pagos. Outros `offer_type` são rejeitados até que seu contrato seja analisado.

## Deduplicação persistente

Uma chave `cakto:approved:v1:<SHA256 do id principal>` por compra. Uma única operação Lua `EVAL` compara fingerprints e grava com `SET NX` no Redis. Não há TTL. O fingerprint usa o registro normalizado, ordenado por item, independente da ordem de chegada no array. Não se grava o corpo bruto, segredo, nome, telefone, documento, e-mail ou dados de cartão.

O registro guarda identificadores de pedidos, itens/valores em centavos, data de pagamento, moeda, candidatos explícitos de atribuição e `google_ads_status: not_sent`. Não há logs de payloads, identificadores de anúncios ou credenciais; respostas contêm apenas status e contagens. Os identificadores persistidos, mesmo sem nome/e-mail, devem ter acesso restrito e uma política de retenção adequada.

- Mesmo pedido e mesmo conteúdo: responde duplicado, sem nova gravação.
- Mesmo pedido com mudança de total, itens ou atribuição: **409**, sem sobrescrever ou criar segunda compra. Revisar o agrupamento e reconciliar o registro; não apagar automaticamente a chave para tentar novamente. Isso é importante se o principal chegar antes de um bump.
- Indisponibilidade/timeout: **503**, sem confirmação de recebimento. Se a gravação tiver ocorrido antes de perder a resposta, o reenvio encontra a chave e será duplicado.
- O registro é uma caixa de entrada de validação, **não** uma fila de conversões. A próxima etapa precisará de controle separado de envio, reenvio e reconciliação com Google Ads.

## Atribuição: pendência explícita

Inspeção do `script.js`: os CTAs usam a URL fixa da Cakto. Atualmente `gclid`, `gbraid` e `wbraid` da URL da landing **não são repassados explicitamente aos links**. Não há prova de preservação desses identificadores pela Cakto. UTMs não substituem identificadores de clique.

Para manter o checkout intacto, esta etapa não adiciona cookies, parâmetros, armazenamento no navegador ou mudanças nos links. Não inventamos identificadores nem deduzimos atribuição de dados de cliente.

A Function lê exclusivamente os campos diretos `gclid`, `gbraid` e `wbraid` de cada item quando explicitamente presentes e sintaticamente válidos. Somente o principal fornece a atribuição da compra; não se usa a do bump como suposição. O status é `unverified`, nunca atribuição validada. Quando ausentes, é `missing`. Objetos aninhados como `utm`/`tracking` e outros campos não são interpretados sem contrato confirmado.

Para concluir:

1. Verificar com a Cakto quais parâmetros/campos de tracking aceitam os identificadores, como persistem na sessão/pedido e em qual caminho chegam ao webhook. Não colocar clique em `secret` nem supor que um parâmetro arbitrário será devolvido.
2. Validar em ambiente separado uma navegação com marcador sintético de atribuição (sem enviar conversão) e o retorno do pedido; a validação de produção deve usar uma compra genuína. Inspecionar apenas campos necessários, sem copiar payload com dados pessoais para logs/repositório.
3. Se o passthrough for suportado, implementar captura/encaminhamento preservando parâmetros existentes, consentimento e links. Se não houver campo adequado, definir uma correlação persistente suportada pela plataforma. Isso exige um contrato explícito, não apenas instalar gtag.
4. Ajustar o mapeamento no servidor ao caminho verificado. Nunca enviar conversão sem atribuição suficiente para o método escolhido.

## Respostas

- `200 received`: armazenamento confirmou inserção/deduplicação; `google_ads_sent` é sempre `false`.
- `200 ignored`: evento diferente de `purchase_approved`, sem gravação.
- `400`: JSON inválido (o parser da Vercel também pode rejeitar antes da Function).
- `401`: segredo inválido/ausente.
- `405`: método diferente de POST, com `Allow: POST`.
- `409`: snapshot conflitante do mesmo pedido.
- `413`: corpo excede limite.
- `415`: Content-Type não é application/json.
- `422`: dados da compra ausentes, ambíguos ou não pagos.
- `503`: segredo/storage não configurado ou armazenamento indisponível.

## Testes e limites da validação

`npm test`: casos sintéticos locais para compra simples/agrupada, eventos ignorados, autenticação, JSON, campos, duplicação entre handlers, concorrência, conflitos e falhas do armazenamento. Redis REST é simulado; nenhum teste comunica uma compra à Cakto ou ao Google. A semântica real de EVAL/persistência deve ser validada na instância conectada de desenvolvimento antes de ativar produção.

`npm run build`: publica em `public/` somente os mesmos arquivos da landing e assets. O código do servidor, testes e documentação não entram na saída estática. A Vercel detecta `api/cakto-webhook.js` como Function Node 22. Não há biblioteca de terceiros. O deploy real e o recebimento de um webhook ainda precisam ser confirmados na Vercel.

## Antes de enviar ao Google Ads (etapa futura)

- Confirmar atribuição e payload reais, conexão Redis e reenvios reais da Cakto.
- Escolher o método correto de upload, ação de conversão e requisitos de consentimento/credenciais. A tag AW sozinha não autoriza upload servidor-servidor.
- Definir o identificador estável de transação (pedido principal) e controle persistente de estados de envio/respostas, usando valor consolidado e hora/moeda corretos.
- Verificar a integração externa já existente da Cakto com Google Ads. Manter **uma única fonte de envio para a mesma conversão** ou um mecanismo comprovado de deduplicação; não ativar este webhook para enviar em paralelo sem resolver isso.
- Não marcar clique no checkout, PIX gerado ou boleto emitido como compra. Não adicionar `Purchase` manual na landing.
