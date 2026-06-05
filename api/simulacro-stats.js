// api/simulacro-stats.js
// Guardar y leer estadísticas de simulacros por usuario
// Patrón idéntico a save-profile-fit.js de Fit AI

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisSet(key, value) {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([["SET", key, JSON.stringify(value)]])
  });
  return res.json();
}

async function redisGet(key) {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([["GET", key]])
  });
  const data = await res.json();
  const result = data?.[0]?.result;
  if (!result) return null;
  try { return JSON.parse(result); } catch { return null; }
}

async function redisZadd(key, score, member) {
  const res = await fetch(`${UPSTASH_URL}/zadd/${encodeURIComponent(key)}/${score}/${encodeURIComponent(member)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { codigo } = req.method === 'GET' ? req.query : (req.body || {});
  if (!codigo) return res.status(400).json({ error: 'Falta código' });

  const codigoUp = codigo.toUpperCase();
  const statsKey = `simulacro:stats:${codigoUp}`;
  const histKey = `simulacro:history:${codigoUp}`;

  // GET → leer estadísticas e historial
  if (req.method === 'GET') {
    const stats = await redisGet(statsKey) || {};
    const history = await redisGet(histKey) || [];
    return res.status(200).json({ stats, history });
  }

  // POST → guardar nuevo simulacro
  if (req.method === 'POST') {
    const { resultado } = req.body || {};
    if (!resultado) return res.status(400).json({ error: 'Falta resultado' });

    // Actualizar historial (máx 50)
    const history = await redisGet(histKey) || [];
    history.unshift({ ...resultado, fecha: new Date().toISOString() });
    if (history.length > 50) history.pop();
    await redisSet(histKey, history);

    // Actualizar estadísticas globales
    const stats = await redisGet(statsKey) || {
      totalSimulacros: 0, aprobados: 0, media: 0, mejor: 0, temas: {}
    };

    stats.totalSimulacros = (stats.totalSimulacros || 0) + 1;
    if (resultado.passed) stats.aprobados = (stats.aprobados || 0) + 1;
    stats.mejor = Math.max(stats.mejor || 0, resultado.pct || 0);

    // Recalcular media
    const totalPct = history.reduce((a, h) => a + (h.pct || 0), 0);
    stats.media = Math.round(totalPct / history.length);

    // Estadísticas por tema
    if (resultado.temaMap) {
      Object.entries(resultado.temaMap).forEach(([t, v]) => {
        if (!stats.temas[t]) stats.temas[t] = { c: 0, tot: 0 };
        stats.temas[t].c += v.c || 0;
        stats.temas[t].tot += v.tot || 0;
      });
    }

    stats.ultimoSimulacro = new Date().toISOString();
    await redisSet(statsKey, stats);

    // Actualizar ranking global (sorted set por media)
    await redisZadd('simulacro:ranking', stats.media, codigoUp);

    return res.status(200).json({ ok: true, stats });
  }

  if (req.method === 'DELETE') {
    const { codigo: cod } = req.body || {};
    if (!cod) return res.status(400).json({ error: 'Falta código' });
    const k1 = `simulacro:history:${cod.toUpperCase()}`;
    const k2 = `simulacro:stats:${cod.toUpperCase()}`;
    await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([["DEL", k1], ["DEL", k2]])
    });
    return res.status(200).json({ ok: true, deleted: [k1, k2] });
  }
  return res.status(405).json({ error: 'Método no permitido' });
}
