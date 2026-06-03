// api/simulacro-ranking.js
// Ranking global de usuarios por nota media

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisGet(key) {
  const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function redisZrevrange(key, start, stop) {
  const res = await fetch(`${UPSTASH_URL}/zrevrange/${encodeURIComponent(key)}/${start}/${stop}/withscores`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const data = await res.json();
  return data.result || [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  // Obtener top 20 del ranking
  const raw = await redisZrevrange('simulacro:ranking', 0, 19);

  const ranking = [];
  for (let i = 0; i < raw.length; i += 2) {
    const codigo = raw[i];
    const media = parseFloat(raw[i + 1]);
    // Obtener datos del código para mostrar nombre/equipo
    const codeData = await redisGet(`simulacro:code:${codigo}`);
    const stats = await redisGet(`simulacro:stats:${codigo}`);
    ranking.push({
      posicion: ranking.length + 1,
      codigo,
      nombre: codeData?.nombre || codigo,
      equipo: codeData?.equipo || '-',
      media,
      totalSimulacros: stats?.totalSimulacros || 0,
      aprobados: stats?.aprobados || 0,
      mejor: stats?.mejor || 0
    });
  }

  return res.status(200).json({ ranking });
}
