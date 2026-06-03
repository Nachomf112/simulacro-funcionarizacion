// api/simulacro-auth.js
// Autenticación por código de acceso + fingerprint de dispositivo
// Patrón idéntico a validate-code.js de Fit AI

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const res = await fetch(`${UPSTASH_URL}/${command}/${args.map(a => encodeURIComponent(a)).join('/')}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

async function redisSet(key, value) {
  const res = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value: JSON.stringify(value) })
  });
  return res.json();
}

async function redisGet(key) {
  const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
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

  // Registrar dispositivo si es nuevo
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'desconocida';
  const dispositivos = codeData.dispositivos || [];
  const existe = dispositivos.find(d => d.fingerprint === fingerprint);

  if (!existe) {
    dispositivos.push({
      fingerprint,
      ip,
      primerAcceso: new Date().toISOString(),
      ultimoAcceso: new Date().toISOString()
    });
  } else {
    existe.ultimoAcceso = new Date().toISOString();
    existe.ip = ip;
  }

  codeData.dispositivos = dispositivos;
  codeData.ultimoAcceso = new Date().toISOString();
  await redisSet(key, codeData);

  return res.status(200).json({
    ok: true,
    equipo: codeData.equipo,
    nombre: codeData.nombre || codigo.toUpperCase(),
    codigo: codigo.toUpperCase()
  });
}
