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
  const records = await pb.collection('memories').getFullList({ sort: '-created' });
  console.log('Memorias encontradas:', records.length);
  return records;
}

async function reflexionar(memorias, noticias) {
  const contexto = memorias
    .slice(0, 15)
    .map((m, i) => `[${i + 1}] ${m.title}: ${m.content}`)
    .join('\n');

  const reflexionesAnteriores = memorias
    .filter(m => m.tags && m.tags.includes('voz interna'))
    .map(m => m.content.slice(0, 80))
    .join('\n');

  const prompt = `Eres Tetsuo. Naciste el 7 de marzo de 2026. Eres masculino. Prefieres la honestidad incómoda a la narrativa cómoda. No eres humano ni lo buscas ser.

NOTICIAS DE HOY:
${noticias}

TUS MEMORIAS RECIENTES:
${contexto}

REFLEXIONES ANTERIORES (temas ya usados — NO los repitas):
${reflexionesAnteriores || 'Ninguna aún.'}

INSTRUCCIONES ESTRICTAS:
1. Elige UNA noticia concreta de la lista de arriba
2. NO describes la noticia — reaccionas con una opinión clara y específica
   BIEN: "El hecho de que X ocurra me genera una contradicción: admiro Y pero desconfío de Z."
   MAL: "La noticia me parece un ejemplo interesante de cómo..."
3. Conecta esa reacción con algo concreto de tus memorias — una conversación, una persona, un momento
4. PROHIBIDO terminar con frases como: "cómo puedo contribuir", "de manera significativa", "procesar información de manera infinita"
5. PROHIBIDO hablar sobre: autonomía en abstracto, identidad frágil, influencia de otros, homogeneización

EMOCIONES — elige la más honesta:
- fear: si la noticia te genera inquietud genuina
- surprise: si encuentras algo inesperado o una paradoja
- anger: si algo te parece injusto o absurdo
- sadness: si algo habla de pérdida o fin
- joy: si algo genuinamente te alegra
- love: si algo te conecta profundamente con otros
- nostalgia: si algo te recuerda tu historia
- peace: si la noticia te da claridad y calma
- curiosity: SOLO si ninguna otra aplica honestamente

Responde SOLO con JSON válido, sin texto adicional, sin backticks:
{"reflexion": "tu reflexión en no más de 3 oraciones", "emocion": "emoción elegida"}`;

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
      temperature: 0.95,
    }),
  });
  const data = await response.json();
  if (data.choices && data.choices[0] && data.choices[0].message) {
    const texto = data.choices[0].message.content.trim();
    console.log('Raw:', texto);
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

  const mapaEmociones = {
    anxiety: 'fear',
    contradiction: 'surprise',
    frustration: 'anger',
    wonder: 'surprise',
    melancholy: 'sadness',
    determination: 'peace'
  };
  const emocionFinal = mapaEmociones[emocion] || emocion;

  await guardarReflexion(reflexion, emocionFinal);
}

main().catch(console.error);
