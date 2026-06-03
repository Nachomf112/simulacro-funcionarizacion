// api/simulacro-auth.js — Login con registro de acceso en log

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { codigo, fingerprint, ua } = req.body || {};
  if (!codigo || !fingerprint) return res.status(400).json({ error: 'Faltan datos' });

  const key = `simulacro:code:${codigo.toUpperCase()}`;
  const codeData = await redisGet(key);

  if (!codeData) return res.status(401).json({ error: 'Código no válido' });
  if (!codeData.activo) return res.status(403).json({ error: 'Código desactivado' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'desconocida';
  const now = new Date().toISOString();

  // Detectar dispositivo desde UA
  const userAgent = ua || req.headers['user-agent'] || '';
  const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
  const isTablet = /ipad|tablet/i.test(userAgent);
  const deviceType = isTablet ? 'tablet' : isMobile ? 'móvil' : 'escritorio';
  const os = /windows/i.test(userAgent) ? 'Windows 10/11' : /mac/i.test(userAgent) ? 'macOS' :
    /android/i.test(userAgent) ? 'Android' : /iphone|ipad/i.test(userAgent) ? 'iOS' : 'Otro';
  const browser = /chrome/i.test(userAgent) && !/edge/i.test(userAgent) ? 'Chrome' :
    /firefox/i.test(userAgent) ? 'Firefox' : /safari/i.test(userAgent) ? 'Safari' :
    /edge/i.test(userAgent) ? 'Edge' : 'Otro';

  // Registrar/actualizar dispositivo
  const dispositivos = codeData.dispositivos || [];
  const existe = dispositivos.find(d => d.fingerprint === fingerprint);
  const deviceInfo = { fingerprint, ip, deviceType, os, browser, primerAcceso: now, ultimoAcceso: now };

  if (!existe) {
    dispositivos.push(deviceInfo);
  } else {
    existe.ultimoAcceso = now;
    existe.ip = ip;
    existe.deviceType = deviceType;
    existe.os = os;
    existe.browser = browser;
  }

  codeData.dispositivos = dispositivos;
  codeData.ultimoAcceso = now;
  await redisSet(key, codeData);

  // Guardar log de acceso
  const logKey = `simulacro:log:${Date.now()}`;
  await redisSet(logKey, {
    tipo: 'acceso', nombre: codeData.nombre, email: codeData.email||'',
    codigo: codigo.toUpperCase(), ip, deviceType, os, browser,
    fecha: now.split('T')[0], hora: now.split('T')[1]?.slice(0,5) || ''
  });

  // Geolocalización async (sin bloquear)
  fetch(`https://ipapi.co/${ip}/json/`).then(r=>r.json()).then(geo=>{
    if (geo?.city) {
      redisGet(key).then(d => {
        if (d) {
          d.ubicacion = `${geo.city}, ${geo.country_name}`;
          redisSet(key, d);
        }
      });
    }
  }).catch(()=>{});

  return res.status(200).json({
    ok: true, equipo: codeData.equipo, nombre: codeData.nombre||codigo.toUpperCase(),
    codigo: codigo.toUpperCase(), email: codeData.email||''
  });
}
