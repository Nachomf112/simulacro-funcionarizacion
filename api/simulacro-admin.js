// api/simulacro-admin.js
// Panel de administración — patrón Upstash correcto (igual que Fit AI)

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_TOKEN = process.env.SIMULACRO_ADMIN_TOKEN || 'ciemat-admin-2026';

async function redisCmd(...args) {
  const res = await fetch(`${UPSTASH_URL}/${args.map(a => encodeURIComponent(a)).join('/')}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

async function redisSet(key, value) {
  return redisCmd('set', key, JSON.stringify(value));
}

async function redisGet(key) {
  const result = await redisCmd('get', key);
  if (!result) return null;
  try { return JSON.parse(result); } catch { return result; }
}

async function redisDel(key) {
  return redisCmd('del', key);
}

async function redisKeys(pattern) {
  const result = await redisCmd('keys', pattern);
  return Array.isArray(result) ? result : [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'No autorizado' });

  const { action } = req.method === 'GET' ? req.query : (req.body || {});

  // LISTAR CÓDIGOS
  if (req.method === 'GET' && action === 'list-codes') {
    const keys = await redisKeys('simulacro:code:*');
    const codes = [];
    for (const key of keys) {
      const data = await redisGet(key);
      if (!data) continue;
      const codigo = key.replace('simulacro:code:', '');
      const stats = await redisGet(`simulacro:stats:${codigo}`) || {};
      codes.push({ codigo, ...data, stats: { totalSimulacros: stats.totalSimulacros||0, media: stats.media||0, mejor: stats.mejor||0, aprobados: stats.aprobados||0 } });
    }
    return res.status(200).json({ codes });
  }

  // CREAR CÓDIGO
  if (req.method === 'POST' && action === 'create-code') {
    const { codigo, equipo, nombre } = req.body;
    if (!codigo || !equipo) return res.status(400).json({ error: 'Faltan datos' });
    const key = `simulacro:code:${codigo.toUpperCase()}`;
    const existe = await redisGet(key);
    if (existe) return res.status(409).json({ error: 'Código ya existe' });
    await redisSet(key, { equipo, nombre: nombre||codigo.toUpperCase(), activo: true, creadoEl: new Date().toISOString(), dispositivos: [] });
    return res.status(200).json({ ok: true, codigo: codigo.toUpperCase() });
  }

  // TOGGLE CÓDIGO
  if (req.method === 'POST' && action === 'toggle-code') {
    const { codigo } = req.body;
    const key = `simulacro:code:${codigo.toUpperCase()}`;
    const data = await redisGet(key);
    if (!data) return res.status(404).json({ error: 'Código no encontrado' });
    data.activo = !data.activo;
    await redisSet(key, data);
    return res.status(200).json({ ok: true, activo: data.activo });
  }

  // ELIMINAR CÓDIGO
  if (req.method === 'DELETE' && action === 'delete-code') {
    const { codigo } = req.body;
    const codigoUp = codigo.toUpperCase();
    await redisDel(`simulacro:code:${codigoUp}`);
    await redisDel(`simulacro:stats:${codigoUp}`);
    await redisDel(`simulacro:history:${codigoUp}`);
    return res.status(200).json({ ok: true });
  }

  // STATS GLOBALES
  if (req.method === 'GET' && action === 'global-stats') {
    const keys = await redisKeys('simulacro:code:*');
    let totalUsuarios=0, totalActivos=0, totalSimulacros=0, totalAprobados=0, sumMedia=0;
    for (const key of keys) {
      const data = await redisGet(key);
      if (!data) continue;
      totalUsuarios++;
      if (data.activo) totalActivos++;
      const codigo = key.replace('simulacro:code:', '');
      const stats = await redisGet(`simulacro:stats:${codigo}`) || {};
      totalSimulacros += stats.totalSimulacros||0;
      totalAprobados += stats.aprobados||0;
      sumMedia += stats.media||0;
    }
    return res.status(200).json({ totalUsuarios, totalActivos, totalSimulacros, totalAprobados, mediaGlobal: totalUsuarios>0 ? Math.round(sumMedia/totalUsuarios) : 0 });
  }

  return res.status(400).json({ error: 'Acción no reconocida' });
}
