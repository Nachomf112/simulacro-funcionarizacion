// api/simulacro-register.js
// Registro de nuevos usuarios — genera código y notifica a Make

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const MAKE_WEBHOOK = process.env.SIMULACRO_MAKE_WEBHOOK || 'https://hook.eu2.make.com/7lbi1i7yo5eqp5x7euw2c6ik4vo21m6c';

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
async function redisKeys(pattern) {
  const r = await redisCmd('keys', pattern);
  return Array.isArray(r) ? r : [];
}

function generateCode(nombre) {
  const prefix = nombre.split(' ')[0].toUpperCase().replace(/[^A-Z]/g,'').slice(0,5);
  const suffix = Math.random().toString(36).toUpperCase().slice(2,6);
  return `${prefix}-${suffix}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { nombre, email, equipo } = req.body || {};
  if (!nombre || !email) return res.status(400).json({ error: 'Nombre y email son obligatorios' });

  // Comprobar si el email ya tiene código
  const keys = await redisKeys('simulacro:code:*');
  for (const key of keys) {
    const data = await redisGet(key);
    if (data?.email === email.toLowerCase().trim()) {
      return res.status(409).json({ error: 'Este email ya tiene un código registrado. Revisa tu bandeja de entrada.' });
    }
  }

  // ── LÍMITE DE USUARIOS ──
  const MAX_USUARIOS = 10;
  if (keys.length >= MAX_USUARIOS) {
    return res.status(403).json({ error: `El simulacro está en modo privado y se ha alcanzado el límite de ${MAX_USUARIOS} usuarios. Para solicitar acceso contacta con Nacho Menárguez en info@menarguez-ia.com` });
  }

  // Generar código único
  let codigo = generateCode(nombre);
  let attempts = 0;
  while (await redisGet(`simulacro:code:${codigo}`) && attempts < 10) {
    codigo = generateCode(nombre);
    attempts++;
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'desconocida';
  const now = new Date().toISOString();

  const codeData = {
    nombre: nombre.trim(),
    email: email.toLowerCase().trim(),
    equipo: equipo?.trim() || 'General',
    activo: true,
    creadoEl: now,
    ip_registro: ip,
    dispositivos: [],
    ultimoAcceso: null
  };

  await redisSet(`simulacro:code:${codigo}`, codeData);

  // Notificar a Make
  try {
    await fetch(MAKE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: codeData.nombre,
        email: codeData.email,
        equipo: codeData.equipo,
        codigo,
        fecha: new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' }),
        hora: new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }),
        url_acceso: 'https://simulacro.menarguez-ia.com'
      })
    });
  } catch (e) { console.error('Make error:', e); }

  return res.status(200).json({ ok: true, codigo, nombre: codeData.nombre });
}
