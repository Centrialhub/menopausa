const { createHash, timingSafeEqual } = require('node:crypto');

const MAX_BYTES = 256 * 1024;
class InvalidPayload extends Error {}
const hash = value => createHash('sha256').update(value).digest('hex');
const identifier = value => {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new InvalidPayload();
  return value.trim();
};
function cents(value) {
  if (!['string', 'number'].includes(typeof value) || !/^\d+(\.\d{1,2})?$/.test(String(value))) throw new InvalidPayload();
  const [units, fraction = ''] = String(value).split('.');
  const amount = Number(units) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new InvalidPayload();
  return amount;
}
function normalize(data) {
  if (!Array.isArray(data) || data.length < 1 || data.length > 100) throw new InvalidPayload();
  const items = data.map(item => {
    if (!item || typeof item !== 'object' || item.status !== 'paid') throw new InvalidPayload();
    if (!['main', 'orderbump'].includes(item.offer_type)) throw new InvalidPayload();
    const id = identifier(item.id);
    const refId = item.refId == null ? null : identifier(item.refId);
    const paidAt = typeof item.paidAt === 'string' && /^\d{4}-\d\d-\d\dT/.test(item.paidAt) && Number.isFinite(Date.parse(item.paidAt)) ? new Date(item.paidAt).toISOString() : null;
    if (!paidAt) throw new InvalidPayload();
    if (item.currency != null && item.currency !== 'BRL') throw new InvalidPayload();
    const parent = item.parent_order == null ? null : identifier(item.parent_order);
    if ((item.offer_type === 'main' && parent) || (item.offer_type === 'orderbump' && !parent)) throw new InvalidPayload();
    // Only explicit fields are retained, never the raw webhook/customer object.
    const attribution = {};
    for (const field of ['gclid', 'gbraid', 'wbraid']) {
      const value = item[field];
      if (typeof value === 'string' && /^[A-Za-z0-9._~-]{1,512}$/.test(value)) attribution[field] = value;
    }
    return { id, refId, type: item.offer_type, parent, amount_cents: cents(item.amount), paid_at: paidAt, attribution };
  });
  const ids = new Set();
  for (const item of items) { if (ids.has(item.id)) throw new InvalidPayload(); ids.add(item.id); }
  const mains = items.filter(item => item.type === 'main');
  if (!mains.length) throw new InvalidPayload();
  const aliases = new Map();
  for (const item of mains) {
    for (const alias of new Set([item.id, item.refId].filter(Boolean))) {
      if (aliases.has(alias)) throw new InvalidPayload();
      aliases.set(alias, item.id);
    }
  }
  const groups = new Map(mains.map(item => [item.id, [item]]));
  for (const item of items.filter(item => item.type === 'orderbump')) {
    const parentId = aliases.get(item.parent);
    if (!parentId) throw new InvalidPayload();
    groups.get(parentId).push(item);
  }
  return [...groups].map(([orderId, group]) => {
    const total = group.reduce((sum, item) => sum + item.amount_cents, 0);
    if (!Number.isSafeInteger(total)) throw new InvalidPayload();
    const main = group.find(item => item.type === 'main');
    const record = {
      schema_version: 1, event: 'purchase_approved', order_id: orderId,
      currency: 'BRL', amount_cents: total, paid_at: main.paid_at,
      attribution_status: Object.keys(main.attribution).length ? 'unverified' : 'missing',
      attribution: main.attribution,
      items: group.map(({ attribution, ...item }) => item).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      google_ads_status: 'not_sent'
    };
    const serialized = JSON.stringify(record);
    return { key: `cakto:approved:v1:${hash(orderId)}`, fingerprint: hash(serialized), record };
  });
}
// Compare all records before writing any. Persistent, atomic, with no expiration.
// Same order + changed total/items => conflict, never a second purchase or silent overwrite.
const DEDUP_LUA = `
for i,key in ipairs(KEYS) do
  local old = redis.call('GET', key)
  if old then
    local decoded = cjson.decode(old)
    local incoming = cjson.decode(ARGV[i])
    if decoded.fingerprint ~= incoming.fingerprint then return {-1,0} end
  end
end
local inserted = 0
for i,key in ipairs(KEYS) do
  if redis.call('SET', key, ARGV[i], 'NX') then inserted = inserted + 1 end
end
return {inserted, #KEYS - inserted}
`;
async function persist(groups, env, fetchImpl) {
  const url = new URL(env.UPSTASH_REDIS_REST_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('storage_config');
  const response = await fetchImpl(url, {
    method: 'POST', headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['EVAL', DEDUP_LUA, groups.length, ...groups.map(g => g.key), ...groups.map(g => JSON.stringify({ fingerprint: g.fingerprint, ...g.record }))]),
    signal: AbortSignal.timeout(5000), redirect: 'error'
  });
  if (!response.ok) throw new Error('storage_unavailable');
  const body = await response.json();
  if (body.error || !Array.isArray(body.result) || body.result.length !== 2 || !body.result.every(Number.isInteger)) throw new Error('storage_response');
  const [inserted, duplicates] = body.result;
  if (inserted === -1) return { conflict: true };
  if (inserted < 0 || duplicates < 0 || inserted + duplicates !== groups.length) throw new Error('storage_response');
  return { inserted, duplicates };
}
async function readBody(req) {
  const headerSize = Number(req.headers?.['content-length']);
  if (headerSize > MAX_BYTES) throw Object.assign(new Error(), { status: 413 });
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > MAX_BYTES) throw Object.assign(new Error(), { status: 413 });
    return JSON.parse(raw);
  }
  let raw = ''; let bytes = 0;
  for await (const chunk of req) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > MAX_BYTES) throw Object.assign(new Error(), { status: 413 });
    raw += chunk.toString();
  }
  return JSON.parse(raw);
}
function createHandler({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, data) => res.status(status).json(data);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'method_not_allowed' }); }
    if (!env.CAKTO_WEBHOOK_SECRET) return send(503, { error: 'webhook_not_configured' });
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers?.['content-type'] || '')) return send(415, { error: 'json_required' });
    let body;
    try { body = await readBody(req); } catch (error) { return send(error.status || 400, { error: error.status === 413 ? 'payload_too_large' : 'invalid_json' }); }
    const supplied = typeof body?.secret === 'string' ? body.secret : '';
    if (!timingSafeEqual(Buffer.from(hash(supplied)), Buffer.from(hash(env.CAKTO_WEBHOOK_SECRET)))) return send(401, { error: 'unauthorized' });
    if (body.event !== 'purchase_approved') return send(200, { status: 'ignored' });
    let groups;
    try { groups = normalize(body.data); } catch { return send(422, { error: 'invalid_paid_purchase' }); }
    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return send(503, { error: 'persistent_storage_not_configured' });
    try {
      const result = await persist(groups, env, fetchImpl);
      if (result.conflict) return send(409, { error: 'order_snapshot_conflict' });
      return send(200, { status: 'received', ...result, attribution_missing: groups.filter(g => g.record.attribution_status === 'missing').length, google_ads_sent: false });
    } catch { return send(503, { error: 'persistent_storage_unavailable' }); }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.normalize = normalize;
module.exports.DEDUP_LUA = DEDUP_LUA;
