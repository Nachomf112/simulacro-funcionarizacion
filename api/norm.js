export default async function handler(req, res) {
  // CORS — permitir cualquier origen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { pregunta, normativa } = req.body;

    if (!pregunta) {
      res.status(400).json({ error: 'Falta la pregunta' });
      return;
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: `Eres un asistente experto en la normativa interna del CIEMAT sobre Comisiones de Servicio. Responde ÚNICAMENTE basándote en el siguiente documento oficial. Si la pregunta no está cubierta, indícalo. Responde en español, claro y estructurado. Cita el apartado cuando sea relevante.\n\nNORMATIVA:\n${normativa}`,
        messages: [{ role: 'user', content: pregunta }]
      })
    });

    const data = await anthropicRes.json();
    const respuesta = data?.content?.[0]?.text || 'Sin respuesta';
    res.status(200).json({ respuesta });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
