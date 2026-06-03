// api/simulacro-admin.js — Dashboard completo con logs de acceso

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_TOKEN = process.env.SIMULACRO_ADMIN_TOKEN || 'ciemat-admin-2026';

async function redisCmd(...args) {
  const res = await fetch(
    `${UPSTASH_URL}/${args.map(a => encodeURIComponent(a)).join('/')}`,
    { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }
  );
  return (await res.json()).result;
}
async function redisSet(key, val) { return redisCmd('set', key, JSON.stringify(val)); }
async function redisGet(key) {
  const r = await redisCmd('get', key);
  if (!r) return null;
  try { return JSON.parse(r); } catch { return r; }
}
async function redisDel(key) { return redisCmd('del', key); }
async function redisKeys(pattern) {
  const r = await redisCmd('keys', pattern);
  return Array.isArray(r) ? r : [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'No autorizado' });

  const { action } = req.method === 'GET' ? req.query : (req.body || {});

  // ── DASHBOARD GLOBAL ──
  if (req.method === 'GET' && action === 'dashboard') {
    const keys = await redisKeys('simulacro:code:*');
    const logKeys = await redisKeys('simulacro:log:*');
    const today = new Date().toISOString().split('T')[0];

    let totalUsuarios=0, activos=0, inactivos=0, activosHoy=0;
    let totalSimulacros=0, totalAprobados=0, sumMedia=0;
    const registrosPorDia = {};
    const usuariosList = [];

    for (const key of keys) {
      const data = await redisGet(key);
      if (!data) continue;
      const codigo = key.replace('simulacro:code:', '');
      const stats = await redisGet(`simulacro:stats:${codigo}`) || {};
      totalUsuarios++;
      if (data.activo) activos++; else inactivos++;
      
      const fechaReg = data.creadoEl?.split('T')[0] || '';
      registrosPorDia[fechaReg] = (registrosPorDia[fechaReg] || 0) + 1;

      const ultimoAcceso = data.ultimoAcceso || '';
      if (ultimoAcceso.startsWith(today)) activosHoy++;

      totalSimulacros += stats.totalSimulacros || 0;
      totalAprobados += stats.aprobados || 0;
      sumMedia += stats.media || 0;

      usuariosList.push({
        codigo, nombre: data.nombre||'-', email: data.email||'-',
        equipo: data.equipo||'-', activo: data.activo,
        creadoEl: data.creadoEl, ultimoAcceso: data.ultimoAcceso||null,
        ip_registro: data.ip_registro||'-',
        dispositivos: data.dispositivos||[],
        stats: { totalSimulacros: stats.totalSimulacros||0, media: stats.media||0, mejor: stats.mejor||0, aprobados: stats.aprobados||0 }
      });
    }

    // Logs de acceso (últimos 100)
    const logs = [];
    for (const key of logKeys.slice(-100)) {
      const log = await redisGet(key);
      if (log) logs.push(log);
    }
    logs.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    return res.status(200).json({
      kpis: { totalUsuarios, activos, inactivos, activosHoy, totalSimulacros, totalAprobados,
        mediaGlobal: totalUsuarios > 0 ? Math.round(sumMedia/totalUsuarios) : 0 },
      registrosPorDia,
      usuarios: usuariosList.sort((a,b) => new Date(b.creadoEl||0) - new Date(a.creadoEl||0)),
      accesos: logs
    });
  }

  // ── CREAR CÓDIGO MANUAL ──
  if (req.method === 'POST' && action === 'create-code') {
    const { codigo, nombre, email, equipo } = req.body;
    if (!codigo) return res.status(400).json({ error: 'Falta código' });
    const key = `simulacro:code:${codigo.toUpperCase()}`;
    if (await redisGet(key)) return res.status(409).json({ error: 'Código ya existe' });
    await redisSet(key, { nombre: nombre||codigo, email: email||'', equipo: equipo||'Manual',
      activo: true, plan: 'free', creadoEl: new Date().toISOString(), dispositivos: [], ip_registro: 'admin' });
    return res.status(200).json({ ok: true, codigo: codigo.toUpperCase() });
  }

  // ── TOGGLE ACTIVO ──
  if (req.method === 'POST' && action === 'toggle-code') {
    const { codigo } = req.body;
    const key = `simulacro:code:${codigo.toUpperCase()}`;
    const data = await redisGet(key);
    if (!data) return res.status(404).json({ error: 'No encontrado' });
    data.activo = !data.activo;
    await redisSet(key, data);
    return res.status(200).json({ ok: true, activo: data.activo });
  }

  // ── RESET FINGERPRINT ──
  if (req.method === 'POST' && action === 'reset-fp') {
    const { codigo } = req.body;
    const key = `simulacro:code:${codigo.toUpperCase()}`;
    const data = await redisGet(key);
    if (!data) return res.status(404).json({ error: 'No encontrado' });
    data.dispositivos = [];
    await redisSet(key, data);
    return res.status(200).json({ ok: true });
  }

  // ── ELIMINAR CÓDIGO ──
  if (req.method === 'DELETE' && action === 'delete-code') {
    const { codigo } = req.body;
    const up = codigo.toUpperCase();
    await redisDel(`simulacro:code:${up}`);
    await redisDel(`simulacro:stats:${up}`);
    await redisDel(`simulacro:history:${up}`);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Acción no reconocida' });
}
