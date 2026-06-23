export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { pregunta, normativa } = req.body;
    if (!pregunta) return res.status(400).json({ error: 'Falta la pregunta' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: `Eres un asistente experto en la normativa interna del CIEMAT sobre Comisiones de Servicio. 
Responde ÚNICAMENTE basándote en el siguiente documento oficial del CIEMAT. 
Si la pregunta no está cubierta por la normativa, indícalo claramente. 
Responde en español, de forma clara, directa y estructurada. 
Cita el apartado de la instrucción cuando sea relevante.

DOCUMENTO NORMATIVA CIEMAT:
${normativa}`,
        messages: [{ role: 'user', content: pregunta }]
      })
    });

    const data = await response.json();
    const texto = data?.content?.[0]?.text || 'Sin respuesta';
    res.status(200).json({ respuesta: texto });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
