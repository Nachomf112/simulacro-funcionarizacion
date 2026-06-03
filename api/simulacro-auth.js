// api/simulacro-auth.js
// Autenticación por código + fingerprint — patrón Upstash correcto

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { codigo, fingerprint } = req.body || {};
  if (!codigo || !fingerprint) return res.status(400).json({ error: 'Faltan datos' });

  const key = `simulacro:code:${codigo.toUpperCase()}`;
  const codeData = await redisGet(key);

  if (!codeData) return res.status(401).json({ error: 'Código no válido' });
  if (!codeData.activo) return res.status(403).json({ error: 'Código desactivado' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'desconocida';
  const dispositivos = codeData.dispositivos || [];
  const existe = dispositivos.find(d => d.fingerprint === fingerprint);

  if (!existe) {
    dispositivos.push({ fingerprint, ip, primerAcceso: new Date().toISOString(), ultimoAcceso: new Date().toISOString() });
  } else {
    existe.ultimoAcceso = new Date().toISOString();
    existe.ip = ip;
  }

  codeData.dispositivos = dispositivos;
  codeData.ultimoAcceso = new Date().toISOString();
  await redisSet(key, codeData);

  return res.status(200).json({ ok: true, equipo: codeData.equipo, nombre: codeData.nombre||codigo.toUpperCase(), codigo: codigo.toUpperCase() });
}
