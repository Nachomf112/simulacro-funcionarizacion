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

  // ── PANEL DE CONTROL GLOBAL ──
  if (req.method === 'GET' && action === 'dashboard') {
    const keys = await redisKeys('simulacro:code:*');
    const logKeys = await redisKeys('simulacro:log:*');
    const hoy = new Date().toISOString().split('T')[0];

    let totalUsuarios = 0, activos = 0, inactivos = 0, activosHoy = 0;
    let totalSimulacros = 0, totalAprobados = 0, sumMedia = 0;
    const registrosPorDia = {};
    const usuariosList = [];

    // ── Acumuladores nuevos para tema débil global y evolución temporal ──
    const temaAcumGlobal = {}; // { '1': {c, tot}, '2': {...}, ... }
    const evolucionPorDia = {}; // { 'YYYY-MM-DD': { sumaPct, count } }

    for (const clave of keys) {
      const datos = await redisGet(clave);
      if (!datos) continue;
      const codigo = clave.replace('simulacro:code:', '');
      const stats = await redisGet(`simulacro:stats:${codigo}`) || {};
      totalUsuarios++;
      if (datos.activo) activos++; else inactivos++;

      const fechaReg = datos.creadoEl?.split('T')[0] || '';
      registrosPorDia[fechaReg] = (registrosPorDia[fechaReg] || 0) + 1;

      const ultimoAcceso = datos.ultimoAcceso || '';
      if (ultimoAcceso.startsWith(hoy)) activosHoy++;

      totalSimulacros += stats.totalSimulacros || 0;
      totalAprobados += stats.aprobados || 0;
      sumMedia += stats.media || 0;

      // ── Leer historial detallado para agregaciones nuevas ──
      const history = await redisGet(`simulacro:history:${codigo}`) || [];
      if (Array.isArray(history)) {
        history.forEach(entry => {
          // Acumular por tema global (entry.temaMap = { '1': {c,w,b,tot}, ... })
          if (entry.temaMap) {
            Object.entries(entry.temaMap).forEach(([t, v]) => {
              if (!temaAcumGlobal[t]) temaAcumGlobal[t] = { c: 0, tot: 0 };
              temaAcumGlobal[t].c += v.c || 0;
              temaAcumGlobal[t].tot += v.tot || 0;
            });
          }
          // Acumular evolución de media por fecha (entry.fecha es ISO: 'YYYY-MM-DDTHH:mm:ss.sssZ')
          if (entry.fecha && typeof entry.pct === 'number') {
            const isoDate = entry.fecha.split('T')[0];
            if (!evolucionPorDia[isoDate]) evolucionPorDia[isoDate] = { sumaPct: 0, count: 0 };
            evolucionPorDia[isoDate].sumaPct += entry.pct;
            evolucionPorDia[isoDate].count++;
          }
        });
      }

      usuariosList.push({
        codigo, nombre: datos.nombre || '-', email: datos.email || '-',
        equipo: datos.equipo || '-', activo: datos.activo,
        creadoEl: datos.creadoEl, ultimoAcceso: datos.ultimoAcceso || null,
        ip_registro: datos.ip_registro || '-',
        dispositivos: datos.dispositivos || [],
        ubicacion: datos.ubicacion || null,
        limiteSimulacros: datos.limiteSimulacros || 50,
        stats: { totalSimulacros: stats.totalSimulacros || 0, media: stats.media || 0, mejor: stats.mejor || 0, aprobados: stats.aprobados || 0 }
      });
    }

    const registros = [];
    for (const key of logKeys.slice(-100)) {
      const log = await redisGet(key);
      if (log) registros.push({ ...log, logKey: key });
    }
    registros.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    // ── Tema débil global (menor % de acierto, con datos suficientes) ──
    const temaStatsGlobal = Object.entries(temaAcumGlobal).map(([t, v]) => ({
      tema: parseInt(t),
      pct: v.tot > 0 ? Math.round((v.c / v.tot) * 100) : 0,
      total: v.tot
    })).filter(t => t.total > 0).sort((a, b) => a.tema - b.tema);

    let temaDebilGlobal = null;
    if (temaStatsGlobal.length) {
      temaDebilGlobal = temaStatsGlobal.reduce((min, t) => t.pct < min.pct ? t : min, temaStatsGlobal[0]);
    }

    // ── Serie de evolución de media global por día (ordenada cronológicamente) ──
    const evolucionMedia = Object.entries(evolucionPorDia)
      .map(([fecha, v]) => ({ fecha, media: Math.round(v.sumaPct / v.count) }))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    return res.status(200).json({
      kpis: { totalUsuarios, activos, inactivos, activosHoy, totalSimulacros, totalAprobados,
        mediaGlobal: totalUsuarios > 0 ? Math.round(sumMedia / totalUsuarios) : 0 },
      registrosPorDia,
      temaStatsGlobal,
      temaDebilGlobal,
      evolucionMedia,
      usuarios: usuariosList.sort((a, b) => new Date(b.creadoEl || 0) - new Date(a.creadoEl || 0)),
      accesos: registros
    });
  } 
  // ── CREAR CÓDIGO MANUAL ──
  if (req.method === 'POST' && action === 'create-code') {
    const { codigo, nombre, email, equipo } = req.body;
    if (!codigo) return res.status(400).json({ error: 'Falta código' });
    const key = `simulacro:code:${codigo.toUpperCase()}`;
    if (await redisGet(key)) return res.status(409).json({ error: 'Código ya existe' });
    await redisSet(key, { nombre: nombre||codigo, email: email||'', equipo: equipo||'Manual',
      activo: true, creadoEl: new Date().toISOString(), dispositivos: [], ip_registro: 'admin', limiteSimulacros: 50 });
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

  // ── SET LÍMITE SIMULACROS ──
  if (req.method === 'POST' && action === 'set-limit') {
    const { codigo, limite } = req.body;
    const key = `simulacro:code:${codigo.toUpperCase()}`;
    const data = await redisGet(key);
    if (!data) return res.status(404).json({ error: 'No encontrado' });
    data.limiteSimulacros = parseInt(limite) || 50;
    await redisSet(key, data);
    return res.status(200).json({ ok: true, limite: data.limiteSimulacros });
  }
  // ── BORRAR LOG INDIVIDUAL ──
  if (req.method === 'DELETE' && action === 'delete-log') {
    const { logKey } = req.body;
    if (!logKey) return res.status(400).json({ error: 'Falta logKey' });
    await redisDel(logKey);
    return res.status(200).json({ ok: true });
  }

  // ── BORRAR TODOS LOS LOGS ──
  if (req.method === 'DELETE' && action === 'clear-logs') {
    const logKeys = await redisKeys('simulacro:log:*');
    for (const k of logKeys) await redisDel(k);
    return res.status(200).json({ ok: true, deleted: logKeys.length });
  }
  return res.status(400).json({ error: 'Acción no reconocida' });
}
