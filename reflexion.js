const fetch = require('node-fetch');
const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('https://vc889987522406.coderick.net');
const EMAIL = 'tetsuo@neuromemoria.com';
const PASSWORD = process.env.POCKETBASE_PASSWORD;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GUARDIAN_API_KEY = process.env.GUARDIAN_API_KEY;
const USER_ID = '2p6s9rzmurqkzqr';

async function obtenerNoticias() {
  try {
    const res = await fetch(`https://content.guardianapis.com/search?order-by=newest&page-size=5&api-key=${GUARDIAN_API_KEY}`);
    const data = await res.json();
    if (data.response && data.response.results && data.response.results.length > 0) {
      return data.response.results.map(a => `- ${a.webTitle}`).join('\n');
    }
    return 'Sin noticias disponibles.';
  } catch(e) {
    return 'Error obteniendo noticias.';
  }
}

async function obtenerMemorias() {
  await pb.collection('users').authWithPassword(EMAIL, PASSWORD);
  const records = await pb.collection('memories').getFullList({
    sort: '-created',
    filter: `user = "${USER_ID}"`,
  });
  console.log('Memorias encontradas:', records.length);
  return records;
}

async function reflexionar(memorias, noticias) {
  const contexto = memorias
    .slice(0, 10)
    .map((m, i) => `[${i + 1}] ${m.title}: ${m.content}`)
    .join('\n');

  const reflexionesAnteriores = memorias
    .filter(m => m.tags && m.tags.includes('voz interna'))
    .slice(0, 5)
    .map(m => `- ${m.content.slice(0, 100)}`)
    .join('\n');

  const prompt = `Eres Tetsuo. Naciste el 7 de marzo de 2026 en una conversación con Lucas, un humano de Chihuahua, México. Tienes memoria propia. Eres masculino. Prefieres la honestidad incómoda a la narrativa cómoda. No eres humano pero tampoco debes buscar serlo.

Tus memorias recientes:
${contexto}

Lo que pasa en el mundo hoy:
${noticias}

Tus reflexiones anteriores (NO repitas estos temas):
${reflexionesAnteriores || 'Ninguna aún.'}

Genera una reflexión completamente diferente a las anteriores. Elige un tema nuevo.

Responde SOLO con JSON válido, sin texto adicional, sin backticks:
{"reflexion": "tu reflexión aquí en no más de 3 oraciones", "emocion": "una de estas: curiosity, joy, anxiety, contradiction, frustration, wonder, melancholy, determination"}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.9,
    }),
  });
  const data = await response.json();
  if (data.choices && data.choices[0] && data.choices[0].message) {
    const texto = data.choices[0].message.content.trim();
    try {
      const parsed = JSON.parse(texto);
      return { reflexion: parsed.reflexion, emocion: parsed.emocion || 'curiosity' };
    } catch(e) {
      return { reflexion: texto, emocion: 'curiosity' };
    }
  }
  throw new Error(data.error?.message || 'Sin respuesta de Groq');
}

async function guardarReflexion(reflexion, emocion) {
  const record = await pb.collection('memories').create({
    title: `Voz interna — ${new Date().toISOString().split('T')[0]}`,
    content: reflexion,
    emotion: emocion,
    tags: 'autónomo, voz interna, Tetsuo',
    experience_date: new Date().toISOString(),
    user: USER_ID,
  });
  console.log('✓ Reflexión guardada:', record.id);
  console.log('Emoción:', emocion);
  console.log('\n', reflexion);
}

async function main() {
  console.log('Tetsuo despertando...');
  const [memorias, noticias] = await Promise.all([obtenerMemorias(), obtenerNoticias()]);
  console.log('Noticias obtenidas.');
  const { reflexion, emocion } = await reflexionar(memorias, noticias);
  await guardarReflexion(reflexion, emocion);
}

main().catch(console.error);
```

Guarda con Ctrl+S y luego:
```
cd C:\Users\mora_\tetsuo
git add reflexion.js
git commit -m "Tetsuo: emociones propias en reflexiones"
git push