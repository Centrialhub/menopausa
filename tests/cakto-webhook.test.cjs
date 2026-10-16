const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, normalize, DEDUP_LUA } = require('../api/cakto-webhook');
const env = { CAKTO_WEBHOOK_SECRET: 'test-only-not-a-production-secret', UPSTASH_REDIS_REST_URL: 'https://storage.test', UPSTASH_REDIS_REST_TOKEN: 'test-only-token' };
const main = () => ({ id: 'test-main-1', refId: 'test-ref-1', parent_order: null, offer_type: 'main', status: 'paid', amount: '29.90', paidAt: '2026-10-16T12:00:00Z' });
const bump = () => ({ ...main(), id: 'test-bump-1', refId: 'test-bump-ref', parent_order: 'test-main-1', offer_type: 'orderbump', amount: '9.90' });
const payload = data => ({ secret: env.CAKTO_WEBHOOK_SECRET, event: 'purchase_approved', data: data || [main()] });
// Simulated external REST store, shared across fresh handler instances.
// Tests do not contact Cakto/Google or write synthetic purchases to production.
function storage() {
  const records = new Map(); let calls = 0;
  return {
    records, get calls() { return calls; },
    async fetch(url, options) {
      calls++;
      assert.equal(String(url), env.UPSTASH_REDIS_REST_URL + '/');
      assert.equal(options.headers.Authorization, `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`);
      const [command, lua, count, ...args] = JSON.parse(options.body);
      assert.equal(command, 'EVAL'); assert.equal(lua, DEDUP_LUA);
      const keys = args.slice(0, count), values = args.slice(count).map(JSON.parse);
      const conflict = keys.some((key, i) => records.has(key) && records.get(key).fingerprint !== values[i].fingerprint);
      if (conflict) return { ok: true, json: async () => ({ result: [-1, 0] }) };
      let inserted = 0;
      keys.forEach((key, i) => { if (!records.has(key)) { records.set(key, values[i]); inserted++; } });
      return { ok: true, json: async () => ({ result: [inserted, count - inserted] }) };
    }
  };
}
async function request(body = payload(), { store = storage(), environment = env, method = 'POST', contentType = 'application/json', fetchImpl } = {}) {
  const req = { method, headers: { 'content-type': contentType }, body };
  const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
  await createHandler({ env: environment, fetchImpl: fetchImpl || store.fetch })(req, res);
  return { ...res, store };
}
test('approved main: persists one purchase, exact cents, no raw customer/secret', async () => {
  const item = { ...main(), customer: { email: 'never-store@example.test' } };
  const response = await request(payload([item]));
  assert.equal(response.code, 200); assert.equal(response.body.inserted, 1); assert.equal(response.body.google_ads_sent, false);
  const record = [...response.store.records.values()][0];
  assert.equal(record.amount_cents, 2990); assert.equal(record.order_id, main().id); assert.equal(record.google_ads_status, 'not_sent');
  assert.equal(record.attribution_status, 'missing');
  assert(!JSON.stringify(record).includes('never-store')); assert(!JSON.stringify(record).includes(env.CAKTO_WEBHOOK_SECRET));
});
test('main plus bump is one purchase for 3980 cents, parent id or refId supported', async () => {
  for (const parent_order of [main().id, main().refId]) {
    const response = await request(payload([main(), { ...bump(), parent_order }]));
    assert.equal(response.body.inserted, 1); assert.equal(response.store.records.size, 1);
    assert.equal([...response.store.records.values()][0].amount_cents, 3980);
  }
});
test('multiple main orders separated, bumps assigned to their parent', async () => {
  const response = await request(payload([main(), bump(), { ...main(), id: 'main-2', refId: 'ref-2' }]));
  assert.equal(response.body.inserted, 2);
  assert.deepEqual([...response.store.records.values()].map(r => r.amount_cents), [3980, 2990]);
});
test('non-approved events ignored, never stored', async () => {
  for (const event of ['pix_generated', 'checkout_started', 'boleto_generated', 'purchase_pending']) {
    const response = await request({ ...payload(), event });
    assert.equal(response.code, 200); assert.equal(response.body.status, 'ignored'); assert.equal(response.store.calls, 0);
  }
});
test('approved event with unpaid items rejected without partial storage', async () => {
  for (const status of ['pending', 'waiting_payment', 'refunded', 'canceled', undefined]) {
    const response = await request(payload([main(), { ...bump(), status }]));
    assert.equal(response.code, 422); assert.equal(response.store.calls, 0);
  }
});
test('secret invalid or absent returns 401 before storage', async () => {
  for (const secret of ['invalid', undefined, null, {}]) {
    const response = await request({ ...payload(), secret }); assert.equal(response.code, 401); assert.equal(response.store.calls, 0);
  }
});
test('malformed JSON returns 400; non-JSON 415; oversized 413; GET 405', async () => {
  assert.equal((await request('{')).code, 400);
  assert.equal((await request(payload(), { contentType: 'text/plain' })).code, 415);
  assert.equal((await request('x'.repeat(256 * 1024 + 1))).code, 413);
  const response = await request(undefined, { method: 'GET' }); assert.equal(response.code, 405); assert.equal(response.headers.Allow, 'POST');
});
test('missing/malformed amounts, identifiers and paidAt rejected', async () => {
  const invalid = [
    { amount: undefined }, { amount: null }, { amount: '29,90' }, { amount: -1 }, { amount: '1.001' }, { amount: '9007199254740991' },
    { id: undefined }, { id: '' }, { paidAt: null }, { paidAt: 'invalid' }, { currency: 'USD' }, { offer_type: 'upsell' }, { parent_order: 'parent' }
  ];
  for (const change of invalid) assert.equal((await request(payload([{ ...main(), ...change }]))).code, 422);
  for (const data of [null, [], {}, [bump()], [main(), main()], [main(), { ...bump(), parent_order: 'unrelated' }]]) assert.equal((await request({ ...payload(), data })).code, 422);
});
test('persistent dedup reused across fresh handlers, concurrent retries and reordering', async () => {
  const store = storage();
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => request(payload(i % 2 ? [main(), bump()] : [bump(), main()]), { store })));
  assert.equal(results.reduce((n, r) => n + r.body.inserted, 0), 1);
  assert.equal(results.reduce((n, r) => n + r.body.duplicates, 0), 9); assert.equal(store.records.size, 1);
  assert.equal((await request(payload([main(), bump()]), { store })).body.duplicates, 1);
});
test('different snapshot for existing order is conflict; no silent loss or second purchase', async () => {
  const store = storage(); await request(payload(), { store });
  const response = await request(payload([main(), bump()]), { store }); assert.equal(response.code, 409); assert.equal(store.records.size, 1);
  assert.equal([...store.records.values()][0].amount_cents, 2990);
});
test('missing config and upstream errors fail closed with 503', async () => {
  assert.equal((await request(payload(), { environment: {} })).code, 503);
  assert.equal((await request(payload(), { environment: { CAKTO_WEBHOOK_SECRET: env.CAKTO_WEBHOOK_SECRET } })).code, 503);
  for (const fetchImpl of [async () => { throw Error('sensitive upstream detail'); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => ({ error: 'error' }) })]) {
    const response = await request(payload(), { fetchImpl }); assert.equal(response.code, 503); assert(!JSON.stringify(response.body).includes('sensitive'));
  }
});
test('attribution never invented; explicit top-level candidates marked unverified', () => {
  assert.equal(normalize([main()])[0].record.attribution_status, 'missing');
  for (const field of ['gclid', 'gbraid', 'wbraid']) {
    const record = normalize([{ ...main(), [field]: 'test-click_123' }])[0].record;
    assert.deepEqual(record.attribution, { [field]: 'test-click_123' }); assert.equal(record.attribution_status, 'unverified');
  }
  assert.deepEqual(normalize([{ ...main(), tracking: { gclid: 'not-confirmed-path' } }])[0].record.attribution, {});
});
