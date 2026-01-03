const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// ==================== API KEY ====================
let DEEPSEEK_KEY = null;
let simulationStarted = false;

// Pantalla de configuración
app.get('/', (req, res) => {
    if (!DEEPSEEK_KEY) {
        res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Genesis - Configuración</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #fff;
        }
        .container {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 90%;
            text-align: center;
        }
        h1 { font-size: 2.5em; margin-bottom: 10px; }
        .subtitle { color: #aaa; margin-bottom: 30px; }
        .eden-icon { font-size: 4em; margin-bottom: 20px; }
        input[type="password"] {
            width: 100%; padding: 15px; border: none; border-radius: 10px;
            font-size: 1em; background: rgba(255,255,255,0.2); color: #fff; margin-bottom: 20px;
        }
        input::placeholder { color: rgba(255,255,255,0.5); }
        button {
            width: 100%; padding: 15px 30px; border: none; border-radius: 10px;
            font-size: 1.1em; cursor: pointer;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
        }
        .info { margin-top: 25px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 10px; }
        .info a { color: #667eea; }
        .features { text-align: left; margin-top: 15px; font-size: 0.9em; }
        .features li { margin: 6px 0; }
        .error { background: rgba(255,0,0,0.2); padding: 10px; border-radius: 5px; margin-bottom: 15px; display: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="eden-icon">🌍</div>
        <h1>GÉNESIS</h1>
        <p class="subtitle">Simulación Bíblica con IA - Mundo Completo</p>
        <div class="error" id="error"></div>
        <input type="password" id="apiKey" placeholder="Introduce tu DeepSeek API Key" />
        <button onclick="start()">Iniciar Simulación</button>
        <div class="info">
            <p><a href="https://platform.deepseek.com" target="_blank">Obtener API Key</a></p>
            <ul class="features">
                <li>🌳 Edén: paraíso perfecto</li>
                <li>🌍 Mundo exterior con biomas, ríos, recursos</li>
                <li>🧠 IA con razonamiento científico y emocional</li>
                <li>🏠 Construcción de refugios y herramientas</li>
                <li>🔬 Descubrimiento de leyes físicas</li>
            </ul>
        </div>
    </div>
    <script>
        function start() {
            const key = document.getElementById('apiKey').value.trim();
            const err = document.getElementById('error');
            if (!key || !key.startsWith('sk-')) { err.textContent = 'API key inválida'; err.style.display = 'block'; return; }
            fetch('/set-api-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key }) })
            .then(r => r.json()).then(d => { if (d.ok) location.href = '/genesis.html'; else { err.textContent = d.error; err.style.display = 'block'; } });
        }
        document.getElementById('apiKey').onkeypress = e => { if (e.key === 'Enter') start(); };
    </script>
</body>
</html>`);
    } else {
        res.sendFile(path.join(__dirname, 'genesis.html'));
    }
});

app.use(express.static(path.join(__dirname), { index: false }));

app.post('/set-api-key', (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey || !apiKey.startsWith('sk-')) return res.json({ ok: false, error: 'API key inválida' });
    DEEPSEEK_KEY = apiKey;
    if (!simulationStarted) {
        init();
        simulationStarted = true;
        setInterval(async () => { try { await simulate(); } catch (e) { console.error('Error:', e.message); } }, 3500);
    }
    console.log('✅ API Key configurada');
    res.json({ ok: true });
});

// ==================== DEEPSEEK API ====================
async function askAI(systemPrompt, userPrompt) {
    if (!DEEPSEEK_KEY) return null;
    try {
        const res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
            body: JSON.stringify({
                model: 'deepseek-chat',
                max_tokens: 250,
                temperature: 0.85,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        });
        const data = await res.json();
        if (data.error) { console.error('DeepSeek Error:', data.error); return null; }
        return data.choices?.[0]?.message?.content || null;
    } catch (e) { console.error('API fail:', e.message); return null; }
}

// ==================== MUNDO EXTERIOR - RECURSOS Y LUGARES ====================
const WORLD = {
    EDEN: { x1: 5000, x2: 7000, center: 6000 },
    TREE_X: 6000,
    WIDTH: 12000
};

// Biomas del mundo exterior
const BIOMES = [
    { name: 'Desierto Ardiente', x1: 0, x2: 1500, type: 'desert', water: 0.05, food: 0.1, danger: 0.3, temp: 45 },
    { name: 'Costa Occidental', x1: 1500, x2: 2500, type: 'coast', water: 0.9, food: 0.5, danger: 0.1, temp: 25 },
    { name: 'Bosque Oscuro', x1: 2500, x2: 4000, type: 'forest', water: 0.4, food: 0.7, danger: 0.2, temp: 18 },
    { name: 'Llanuras Fértiles', x1: 4000, x2: 5000, type: 'plains', water: 0.3, food: 0.6, danger: 0.1, temp: 22 },
    // EDÉN: 5000-7000
    { name: 'Colinas Rocosas', x1: 7000, x2: 8500, type: 'hills', water: 0.2, food: 0.3, danger: 0.15, temp: 15 },
    { name: 'Montañas Nevadas', x1: 8500, x2: 10000, type: 'mountains', water: 0.6, food: 0.2, danger: 0.4, temp: -5 },
    { name: 'Valle Oriental', x1: 10000, x2: 12000, type: 'valley', water: 0.5, food: 0.5, danger: 0.15, temp: 20 }
];

// Recursos en el mundo
let resources = [];

function generateResources() {
    resources = [];
    // Ríos
    resources.push({ id: 1, type: 'river', name: 'Río Pisón', x: 2000, water: 100, discovered: false });
    resources.push({ id: 2, type: 'river', name: 'Río Gihón', x: 4200, water: 100, discovered: false });
    resources.push({ id: 3, type: 'river', name: 'Río Hidekel', x: 8000, water: 100, discovered: false });
    resources.push({ id: 4, type: 'river', name: 'Río Éufrates', x: 10500, water: 100, discovered: false });

    // Fuentes de agua
    resources.push({ id: 5, type: 'spring', name: 'Manantial Oculto', x: 3200, water: 50, discovered: false });
    resources.push({ id: 6, type: 'oasis', name: 'Oasis del Desierto', x: 800, water: 30, discovered: false });
    resources.push({ id: 7, type: 'lake', name: 'Lago de las Montañas', x: 9200, water: 80, discovered: false });

    // Comida
    resources.push({ id: 10, type: 'fruit_trees', name: 'Bosque de Higueras', x: 3500, food: 60, discovered: false });
    resources.push({ id: 11, type: 'berry_bush', name: 'Arbustos de Bayas', x: 4500, food: 40, discovered: false });
    resources.push({ id: 12, type: 'hunting_ground', name: 'Territorio de Caza', x: 7500, food: 70, animals: ['ciervos', 'conejos', 'cabras'], discovered: false });
    resources.push({ id: 13, type: 'fishing', name: 'Zona de Pesca', x: 2100, food: 50, discovered: false });

    // Refugio
    resources.push({ id: 20, type: 'cave', name: 'Cueva Grande', x: 3800, shelter: true, capacity: 6, discovered: false });
    resources.push({ id: 21, type: 'cave', name: 'Cueva de la Montaña', x: 9000, shelter: true, capacity: 4, discovered: false });
    resources.push({ id: 22, type: 'rock_formation', name: 'Formación Rocosa', x: 7800, shelter: true, capacity: 3, discovered: false });

    // Materiales
    resources.push({ id: 30, type: 'stone_deposit', name: 'Cantera de Piedra', x: 8200, material: 'stone', discovered: false });
    resources.push({ id: 31, type: 'clay_deposit', name: 'Yacimiento de Arcilla', x: 4100, material: 'clay', discovered: false });
    resources.push({ id: 32, type: 'wood_forest', name: 'Bosque de Madera', x: 3000, material: 'wood', discovered: false });

    // Lugares especiales
    resources.push({ id: 40, type: 'viewpoint', name: 'Mirador del Valle', x: 7200, discovered: false });
    resources.push({ id: 41, type: 'ancient_ruins', name: 'Ruinas Misteriosas', x: 11000, discovered: false });
}

// Estado del mundo
let world = {
    day: 1,
    hour: 6, // 0-24
    phase: 'eden',
    sinCommitted: false,
    sinBy: null,
    sinDay: null,
    serpentAppeared: false,
    serpentDay: 25,
    weather: 'clear', // clear, rain, storm, cold
    temperature: 22
};

let animals = [
    { id: 1, species: 'ciervo', x: 5700, name: null },
    { id: 2, species: 'conejo', x: 5850, name: null },
    { id: 3, species: 'paloma', x: 6100, name: null },
    { id: 4, species: 'cordero', x: 6200, name: null },
    { id: 5, species: 'zorro', x: 6350, name: null }
];

let humans = new Map();
let convos = [];
let discoveries = []; // Descubrimientos científicos
let nextId = 1;

// ==================== CLASE HUMANO MEJORADA ====================
class Human {
    constructor(name, gender, age, parents = null) {
        this.id = nextId++;
        this.name = name;
        this.gender = gender;
        this.age = age;
        this.x = WORLD.EDEN.center;
        this.alive = true;

        // Necesidades físicas
        this.health = 100;
        this.hunger = 0;      // 0 = satisfecho, 100 = muriendo de hambre
        this.thirst = 0;      // 0 = hidratado, 100 = deshidratación
        this.energy = 100;    // 0 = agotado, 100 = descansado
        this.warmth = 100;    // 0 = hipotermia, 100 = bien

        // Estado mental
        this.happiness = 100;
        this.stress = 0;
        this.curiosity = 50 + Math.random() * 50;
        this.wisdom = 0;      // Se gana con experiencia

        // Relaciones
        this.parents = parents;
        this.partner = null;
        this.children = [];
        this.pregnant = false;
        this.pregTime = 0;
        this.lastBirth = -999;

        // Conocimiento
        this.knowledge = {
            fire: false,
            tools: false,
            farming: false,
            building: false,
            hunting: false,
            fishing: false,
            medicine: false,
            astronomy: false
        };
        this.discoveredResources = [];
        this.discoveredBiomes = [];

        // Inventario
        this.inventory = {
            food: 0,
            water: 0,
            wood: 0,
            stone: 0,
            tools: 0
        };

        // Habilidades
        this.skills = {
            hunting: 0,
            gathering: 0,
            crafting: 0,
            building: 0,
            farming: 0
        };

        // Estado
        this.thought = "...";
        this.action = null;
        this.gen = parents ? Math.max(parents.fGen || 1, parents.mGen || 1) + 1 : 1;
        this.temptation = 0;
        this.faith = 80 + Math.random() * 20;
        this.inEden = true;
        this.shelter = null; // ID del refugio

        // Observaciones científicas
        this.observations = [];
    }

    getBiome() {
        for (const b of BIOMES) {
            if (this.x >= b.x1 && this.x < b.x2) return b;
        }
        if (this.x >= WORLD.EDEN.x1 && this.x <= WORLD.EDEN.x2) {
            return { name: 'Jardín del Edén', type: 'eden', water: 1, food: 1, danger: 0, temp: 24 };
        }
        return BIOMES[0];
    }

    getNearbyResources() {
        return resources.filter(r => Math.abs(r.x - this.x) < 300);
    }

    json() {
        const biome = this.getBiome();
        return {
            id: this.id, name: this.name, gender: this.gender,
            x: Math.round(this.x), age: Math.floor(this.age),
            alive: this.alive, health: Math.round(this.health),
            hunger: Math.round(this.hunger), thirst: Math.round(this.thirst),
            energy: Math.round(this.energy), warmth: Math.round(this.warmth),
            happiness: Math.round(this.happiness), stress: Math.round(this.stress),
            partner: this.partner, childrenCount: this.children.length,
            pregnant: this.pregnant, thought: this.thought,
            generation: this.gen, inEden: this.inEden,
            temptation: Math.round(this.temptation), faith: Math.round(this.faith),
            biome: biome.name, knowledge: this.knowledge, skills: this.skills,
            inventory: this.inventory, wisdom: Math.round(this.wisdom),
            discoveredResources: this.discoveredResources.length
        };
    }
}

// ==================== INICIALIZAR ====================
function init() {
    humans.clear();
    convos = [];
    discoveries = [];
    nextId = 1;
    generateResources();

    world = {
        day: 1, hour: 6, phase: 'eden', sinCommitted: false,
        sinBy: null, sinDay: null, serpentAppeared: false, serpentDay: 25,
        weather: 'clear', temperature: 22
    };
    animals.forEach(a => a.name = null);

    const adam = new Human('Adán', 'male', 25);
    const eva = new Human('Eva', 'female', 23);

    adam.partner = 'Eva';
    eva.partner = 'Adán';
    adam.x = WORLD.EDEN.x1 + 400;
    eva.x = WORLD.EDEN.x1 + 450;
    adam.curiosity = 80;
    eva.curiosity = 85;

    humans.set(adam.id, adam);
    humans.set(eva.id, eva);

    console.log('🌍 Génesis iniciado: Mundo completo generado');
    addConversation('Dios', 'Adán y Eva', 'Sean fructíferos y multiplíquense. Llenen la tierra y sométanla. Pero NO coman del árbol del conocimiento.');
}

// ==================== BUSCAR PAREJA ====================
function findPotentialPartner(h) {
    return [...humans.values()].find(o =>
        o.id !== h.id && o.alive && o.gender !== h.gender &&
        o.age >= 16 && !o.partner && Math.abs(o.x - h.x) < 400
    );
}

// ==================== RAZONAMIENTO PROFUNDO ====================
async function think(h) {
    if (!h.alive || h.age < 10) return;

    const others = [...humans.values()].filter(o => o.id !== h.id && o.alive && Math.abs(o.x - h.x) < 300);
    const partner = h.partner ? [...humans.values()].find(o => o.name === h.partner && o.alive) : null;
    const biome = h.getBiome();
    const nearbyResources = h.getNearbyResources();
    const nearTree = Math.abs(h.x - WORLD.TREE_X) < 150 && !world.sinCommitted && h.inEden;
    const serpentHere = nearTree && world.serpentAppeared;

    // Construir contexto completo
    let physicalState = '';
    let mentalState = '';
    let environment = '';
    let actions = [];

    if (world.phase === 'eden') {
        physicalState = `Estado físico: PERFECTO (Edén provee todo)
Salud: ${h.health}% | Energía: ${h.energy}%`;

        mentalState = `Estado mental:
- Felicidad: ${h.happiness}%
- Fe en Dios: ${Math.round(h.faith)}%
- Curiosidad: ${Math.round(h.curiosity)}%
- Sabiduría acumulada: ${Math.round(h.wisdom)}`;

        environment = `Ubicación: Jardín del Edén - El Paraíso
Clima: Perfecto, 24°C
Todo es abundante y hermoso. No hay sufrimiento.`;

        if (partner) {
            environment += `\n${partner.name} está ${Math.abs(partner.x - h.x) < 100 ? 'a tu lado' : 'cerca'}.`;
        }

        actions = [
            '- Explorar el jardín y nombrar criaturas',
            '- Contemplar la creación y reflexionar sobre Dios',
            '- Pasar tiempo con tu pareja'
        ];

        if (partner && h.age >= 18 && !h.pregnant && !(partner.pregnant)) {
            actions.push('- Tener descendencia con tu pareja (multiplicarse)');
        }

        if (serpentHere) {
            environment += `

⚠️ LA SERPIENTE aparece junto al ÁRBOL PROHIBIDO
Susurra con astucia: "¿Conque Dios les ha dicho que no coman de ningún árbol? Si comen de este, serán como dioses, conociendo el bien y el mal. Sus ojos se abrirán..."

El fruto brilla, tentador. Tu tentación: ${h.temptation}%
Puedes CEDER o RESISTIR basándote en tu fe (${Math.round(h.faith)}%)`;

            actions.push('- COMER del fruto prohibido (ceder a la curiosidad)');
            actions.push('- RESISTIR la tentación (confiar en Dios)');
        }

    } else {
        // MUNDO EXTERIOR - Realista y desafiante
        const isNight = world.hour < 6 || world.hour >= 20;
        const tempDiff = Math.abs(biome.temp - 22);

        physicalState = `ESTADO FÍSICO CRÍTICO:
🍖 Hambre: ${h.hunger}% ${h.hunger > 70 ? '⚠️ URGENTE' : h.hunger > 40 ? '(necesitas comer)' : ''}
💧 Sed: ${h.thirst}% ${h.thirst > 70 ? '⚠️ CRÍTICO' : h.thirst > 40 ? '(necesitas agua)' : ''}
⚡ Energía: ${h.energy}% ${h.energy < 30 ? '⚠️ AGOTADO' : ''}
❤️ Salud: ${h.health}%
🌡️ Temperatura corporal: ${h.warmth}% ${h.warmth < 50 ? '⚠️ HIPOTERMIA' : ''}

Inventario: ${h.inventory.food} comida, ${h.inventory.water} agua, ${h.inventory.wood} madera, ${h.inventory.stone} piedra`;

        mentalState = `ESTADO MENTAL:
- Felicidad: ${h.happiness}%
- Estrés: ${h.stress}%
- Sabiduría: ${Math.round(h.wisdom)}
- Curiosidad científica: ${Math.round(h.curiosity)}%

CONOCIMIENTOS ADQUIRIDOS:
${h.knowledge.fire ? '🔥 Sabe hacer fuego' : '❌ No sabe hacer fuego'}
${h.knowledge.tools ? '🔨 Sabe fabricar herramientas' : '❌ Sin herramientas'}
${h.knowledge.hunting ? '🏹 Sabe cazar' : '❌ No sabe cazar'}
${h.knowledge.building ? '🏠 Sabe construir refugios' : '❌ Sin refugio'}
${h.knowledge.farming ? '🌾 Sabe cultivar' : '❌ No sabe cultivar'}`;

        environment = `ENTORNO:
📍 Bioma: ${biome.name} (${biome.type})
🌡️ Temperatura ambiente: ${biome.temp}°C
☁️ Clima: ${world.weather === 'rain' ? 'Lloviendo' : world.weather === 'storm' ? 'Tormenta' : world.weather === 'cold' ? 'Frío intenso' : 'Despejado'}
🕐 Hora: ${world.hour}:00 ${isNight ? '(NOCHE - peligroso)' : '(día)'}
⚠️ Peligro del bioma: ${Math.round(biome.danger * 100)}%

RECURSOS CERCANOS:
${nearbyResources.length > 0 ? nearbyResources.map(r => `- ${r.name} (${r.type}) a ${Math.abs(r.x - h.x)}m ${r.discovered ? '✓ descubierto' : ''}`).join('\n') : 'Ninguno visible - explora para encontrar'}

BIOMAS CONOCIDOS: ${h.discoveredBiomes.length > 0 ? h.discoveredBiomes.join(', ') : 'Solo conoces esta zona'}`;

        if (partner) {
            environment += `\n\n${partner.name} está ${Math.abs(partner.x - h.x) < 100 ? 'contigo' : 'a ' + Math.abs(Math.round(partner.x - h.x)) + 'm'}.`;
        }

        // Acciones contextuales
        actions = [];

        // Prioridad: supervivencia
        if (h.thirst > 50) {
            const waterSource = nearbyResources.find(r => r.water);
            if (waterSource) actions.push(`- BEBER agua del ${waterSource.name}`);
            else actions.push('- Buscar fuente de agua (URGENTE)');
        }

        if (h.hunger > 50) {
            const foodSource = nearbyResources.find(r => r.food);
            if (foodSource) actions.push(`- Buscar COMIDA en ${foodSource.name}`);
            else actions.push('- Cazar o recolectar comida');
        }

        if (h.energy < 30) {
            const shelter = nearbyResources.find(r => r.shelter);
            if (shelter) actions.push(`- DESCANSAR en ${shelter.name}`);
            else actions.push('- Buscar refugio para descansar');
        }

        // Exploración y desarrollo
        actions.push('- Explorar hacia el OESTE (izquierda)');
        actions.push('- Explorar hacia el ESTE (derecha)');

        if (!h.knowledge.fire && h.skills.crafting > 2) {
            actions.push('- Intentar HACER FUEGO (frotar palos)');
        }

        if (!h.knowledge.tools && h.inventory.stone > 0) {
            actions.push('- Fabricar HERRAMIENTAS de piedra');
        }

        if (partner && h.age >= 16 && partner.age >= 16) {
            const female = h.gender === 'female' ? h : partner;
            if (!female.pregnant) {
                actions.push('- Tener HIJOS para continuar la humanidad');
            }
        }

        // Observación científica
        if (h.curiosity > 60) {
            actions.push('- Observar y ESTUDIAR el entorno (ganar sabiduría)');
        }
    }

    const othersText = others.length > 0 ? `Personas cerca: ${others.map(o => `${o.name} (${Math.floor(o.age)} años)`).join(', ')}` : 'Estás solo/a';

    const prompt = `Eres ${h.name}, ${h.gender === 'male' ? 'hombre' : 'mujer'} de ${Math.floor(h.age)} años.
Generación: ${h.gen} | Pareja: ${h.partner || 'ninguna'} | Hijos: ${h.children.length}
${h.pregnant ? '🤰 ¡EMBARAZADA!' : ''}

${physicalState}

${mentalState}

${environment}

${othersText}

ACCIONES POSIBLES:
${actions.join('\n')}

INSTRUCCIONES:
1. Primero REFLEXIONA brevemente sobre tu situación (1-2 frases de pensamiento interno)
2. Luego DECIDE qué acción tomar y HAZLA
3. Si hay alguien cerca, puedes HABLAR con ellos
4. Responde en PRIMERA PERSONA

¿Qué piensas y qué haces?`;

    const sysPrompt = `Eres un humano primitivo realista con inteligencia, emociones y necesidades físicas.

PRIORIDADES:
1. SUPERVIVENCIA: Si tienes hambre/sed crítica, actúa para sobrevivir
2. SEGURIDAD: Busca refugio si es de noche o hace frío
3. REPRODUCCIÓN: Quieres tener descendencia
4. CONOCIMIENTO: Eres curioso, quieres entender el mundo
5. COMUNIDAD: Valoras a tu familia y pareja

ESTILO DE PENSAMIENTO:
- Observas patrones en la naturaleza (proto-ciencia)
- Reflexionas sobre por qué ocurren las cosas
- Nombras lo que descubres
- Compartes conocimiento con otros

${world.phase === 'fallen' ? 'La vida es DURA fuera del Edén. Debes trabajar para sobrevivir. El mundo es hostil pero también lleno de maravillas por descubrir.' : 'Estás en el Paraíso, todo es perfecto, pero la serpiente tienta...'}

Responde siempre en primera persona, con emociones reales y decisiones lógicas.`;

    const response = await askAI(sysPrompt, prompt);
    if (!response) return;

    h.thought = response.trim().substring(0, 300);
    console.log(`💭 ${h.name}: ${h.thought.substring(0, 100)}...`);

    const txt = response.toLowerCase();

    // ===== PROCESAR ACCIONES =====

    // REPRODUCCIÓN
    if (/hijos|hijo|descendencia|multiplicar|procrear|familia|bebé/i.test(txt)) {
        if (partner && h.age >= 16 && partner.age >= 16) {
            const female = h.gender === 'female' ? h : partner;
            if (!female.pregnant && world.day - female.lastBirth > 20) {
                female.pregnant = true;
                female.pregTime = 0;
                console.log(`💕 ¡${female.name} está EMBARAZADA!`);
                addConversation(h.name, partner.name, '¡Vamos a tener un hijo!');
            }
        }
    }

    // FORMAR PAREJA
    if (!h.partner && h.age >= 16 && /amor|pareja|juntos|unir|gustar/i.test(txt)) {
        const candidate = findPotentialPartner(h);
        if (candidate) {
            h.partner = candidate.name;
            candidate.partner = h.name;
            console.log(`💑 ${h.name} y ${candidate.name} son pareja`);
            addConversation(h.name, candidate.name, 'Quiero estar contigo siempre.');
        }
    }

    // PECADO (solo en Edén)
    if (serpentHere && !world.sinCommitted) {
        const eats = /como|muerdo|pruebo|fruto|cedo|manzana|probar/i.test(txt);
        const resists = /no|rechazo|resisto|alejo|dios|prohib|confío/i.test(txt);

        if (resists && !eats) {
            h.faith = Math.min(100, h.faith + 8);
            h.temptation = Math.max(0, h.temptation - 20);
            h.x += h.x < WORLD.TREE_X ? -120 : 120;
            console.log(`✝️ ${h.name} RESISTE`);
            addConversation(h.name, 'Serpiente', 'No. Confío en Dios.');
        } else if (eats) {
            commitSin(h);
            return;
        }
    }

    // ACCIONES DEL MUNDO EXTERIOR
    if (world.phase === 'fallen') {
        // BEBER
        if (/beb|agua|río|manantial|sed/i.test(txt)) {
            const waterSource = h.getNearbyResources().find(r => r.water);
            if (waterSource) {
                h.thirst = Math.max(0, h.thirst - 50);
                h.inventory.water = Math.min(10, h.inventory.water + 2);
                if (!waterSource.discovered) {
                    waterSource.discovered = true;
                    h.discoveredResources.push(waterSource.id);
                    console.log(`💧 ${h.name} descubrió ${waterSource.name}`);
                    addConversation(h.name, 'Descubrimiento', `¡He encontrado agua! Lo llamaré "${waterSource.name}"`);
                }
            }
        }

        // COMER / CAZAR / RECOLECTAR
        if (/com|caz|recolect|frut|baya|carne|hambre/i.test(txt)) {
            const foodSource = h.getNearbyResources().find(r => r.food);
            if (foodSource) {
                const success = Math.random() < (0.3 + h.skills.hunting / 20 + h.skills.gathering / 20);
                if (success) {
                    h.hunger = Math.max(0, h.hunger - 40);
                    h.inventory.food = Math.min(10, h.inventory.food + 1);
                    h.skills.gathering += 0.2;
                    if (foodSource.type === 'hunting_ground') h.skills.hunting += 0.3;
                }
                if (!foodSource.discovered) {
                    foodSource.discovered = true;
                    h.discoveredResources.push(foodSource.id);
                    console.log(`🍖 ${h.name} descubrió ${foodSource.name}`);
                }
            } else if (h.inventory.food > 0) {
                h.inventory.food--;
                h.hunger = Math.max(0, h.hunger - 30);
            }
        }

        // DESCANSAR
        if (/descans|dorm|sueño|cansad|refugio/i.test(txt)) {
            const shelter = h.getNearbyResources().find(r => r.shelter);
            if (shelter) {
                h.energy = Math.min(100, h.energy + 40);
                h.stress = Math.max(0, h.stress - 20);
            } else {
                h.energy = Math.min(100, h.energy + 15);
            }
        }

        // HACER FUEGO
        if (/fuego|calentar|frotar|encender/i.test(txt) && !h.knowledge.fire) {
            if (Math.random() < 0.1 + h.skills.crafting / 30) {
                h.knowledge.fire = true;
                h.wisdom += 15;
                console.log(`🔥 ¡${h.name} DESCUBRIÓ EL FUEGO!`);
                discoveries.push({ who: h.name, what: 'Fuego', day: world.day });
                addConversation(h.name, 'Descubrimiento', '¡El calor! ¡Puedo crear calor frotando madera! ¡Esto cambia todo!');
            } else {
                h.skills.crafting += 0.2;
            }
        }

        // FABRICAR HERRAMIENTAS
        if (/herramienta|fabricar|piedra|afilar|cortar/i.test(txt) && !h.knowledge.tools) {
            if (h.inventory.stone > 0 && Math.random() < 0.15 + h.skills.crafting / 25) {
                h.knowledge.tools = true;
                h.inventory.tools++;
                h.wisdom += 10;
                console.log(`🔨 ¡${h.name} fabricó HERRAMIENTAS!`);
                discoveries.push({ who: h.name, what: 'Herramientas de piedra', day: world.day });
            }
            h.skills.crafting += 0.3;
        }

        // CONSTRUIR
        if (/construir|refugio|casa|techo|proteg/i.test(txt)) {
            if (h.inventory.wood >= 3 || h.inventory.stone >= 2) {
                if (Math.random() < 0.2 + h.skills.building / 20) {
                    h.knowledge.building = true;
                    h.wisdom += 12;
                    // Crear refugio
                    const newShelter = {
                        id: resources.length + 100,
                        type: 'built_shelter',
                        name: `Refugio de ${h.name}`,
                        x: h.x,
                        shelter: true,
                        capacity: 4,
                        discovered: true
                    };
                    resources.push(newShelter);
                    h.shelter = newShelter.id;
                    console.log(`🏠 ${h.name} construyó un refugio`);
                }
            }
            h.skills.building += 0.3;
        }

        // ESTUDIAR/OBSERVAR
        if (/estudi|observ|pensar|reflexion|entender|patrón/i.test(txt)) {
            h.wisdom += 0.5;
            h.curiosity = Math.min(100, h.curiosity + 2);
            if (Math.random() < 0.05) {
                const obs = [
                    'El sol sale siempre por el mismo lado',
                    'Las plantas crecen hacia la luz',
                    'El agua siempre fluye hacia abajo',
                    'El fuego necesita aire para vivir',
                    'Las estrellas siguen patrones cada noche',
                    'Los animales huyen del fuego'
                ].filter(o => !h.observations.includes(o));
                if (obs.length > 0) {
                    const newObs = obs[Math.floor(Math.random() * obs.length)];
                    h.observations.push(newObs);
                    h.wisdom += 5;
                    console.log(`🔬 ${h.name} observó: "${newObs}"`);
                    addConversation(h.name, 'Observación', newObs);
                }
            }
        }

        // RECOLECTAR MATERIALES
        if (/mader|leña|árbol|cortar/i.test(txt)) {
            const woodSource = h.getNearbyResources().find(r => r.material === 'wood');
            if (woodSource || h.getBiome().type === 'forest') {
                h.inventory.wood = Math.min(20, h.inventory.wood + 1);
                h.energy -= 5;
            }
        }
        if (/piedra|roca|cantera/i.test(txt)) {
            const stoneSource = h.getNearbyResources().find(r => r.material === 'stone');
            if (stoneSource || h.getBiome().type === 'mountains' || h.getBiome().type === 'hills') {
                h.inventory.stone = Math.min(20, h.inventory.stone + 1);
                h.energy -= 5;
            }
        }
    }

    // MOVIMIENTO
    let moved = false;
    if (/izquierda|oeste|hacia.*costa|hacia.*bosque/i.test(txt)) {
        h.x -= 80 + Math.random() * 60;
        moved = true;
    } else if (/derecha|este|hacia.*montaña|hacia.*valle/i.test(txt)) {
        h.x += 80 + Math.random() * 60;
        moved = true;
    } else if (/explor|camin|buscar|avanzar/i.test(txt)) {
        h.x += (Math.random() - 0.5) * 120;
        moved = true;
    } else if (partner && /acerc|junto|ir con/i.test(txt)) {
        h.x += (partner.x - h.x) * 0.4;
        moved = true;
    }

    // Descubrir bioma
    if (moved) {
        const currentBiome = h.getBiome();
        if (!h.discoveredBiomes.includes(currentBiome.name)) {
            h.discoveredBiomes.push(currentBiome.name);
            h.wisdom += 3;
            console.log(`🗺️ ${h.name} descubrió: ${currentBiome.name}`);
            addConversation(h.name, 'Exploración', `He llegado a un nuevo lugar. Lo llamaré "${currentBiome.name}"`);
        }
    }

    // LÍMITES
    if (h.inEden && !world.sinCommitted) {
        h.x = Math.max(WORLD.EDEN.x1 + 50, Math.min(WORLD.EDEN.x2 - 50, h.x));
    } else {
        h.x = Math.max(100, Math.min(WORLD.WIDTH - 100, h.x));
        if (world.sinCommitted && h.x >= WORLD.EDEN.x1 - 100 && h.x <= WORLD.EDEN.x2 + 100) {
            h.x = h.x < WORLD.EDEN.center ? WORLD.EDEN.x1 - 200 : WORLD.EDEN.x2 + 200;
        }
    }

    // Guardar conversación
    if (others.length > 0 && response.length > 20) {
        addConversation(h.name, others[0].name, response.substring(0, 150));
    }
}

function addConversation(from, to, msg) {
    convos.push({ from, to, msg, day: world.day, hour: world.hour });
    if (convos.length > 150) convos.shift();
}

// ==================== PECADO ====================
function commitSin(sinner) {
    world.sinCommitted = true;
    world.sinBy = sinner.name;
    world.sinDay = world.day;
    world.phase = 'fallen';

    console.log(`🍎❌ ¡${sinner.name} COMIÓ DEL FRUTO PROHIBIDO!`);
    addConversation(sinner.name, 'Serpiente', 'He probado el fruto...');
    addConversation('Dios', 'Humanidad', '¡Han desobedecido! Con dolor darás a luz, con sudor de tu frente comerás el pan. ¡SALGAN del Edén!');

    setTimeout(() => {
        let baseX = WORLD.EDEN.x1 - 500;
        humans.forEach(h => {
            h.inEden = false;
            h.happiness = 30;
            h.stress = 50;
            h.hunger = 30;
            h.thirst = 30;
            h.x = baseX + Math.random() * 150;
        });
        console.log(`🚪 Expulsados del Edén. Comienza la lucha por la supervivencia.`);
    }, 100);
}

// ==================== SIMULACIÓN ====================
async function simulate() {
    if (!DEEPSEEK_KEY) return;

    // Avanzar tiempo
    world.hour += 2;
    if (world.hour >= 24) {
        world.hour = 0;
        world.day++;

        // Cambiar clima ocasionalmente
        if (Math.random() < 0.2) {
            world.weather = ['clear', 'clear', 'rain', 'cold', 'storm'][Math.floor(Math.random() * 5)];
        }
    }

    // Serpiente aparece
    if (!world.serpentAppeared && world.day >= world.serpentDay && !world.sinCommitted) {
        world.serpentAppeared = true;
        console.log(`🐍 Día ${world.day}: ¡La SERPIENTE aparece!`);
        addConversation('Narrador', 'Mundo', 'La serpiente, la más astuta de las criaturas, se acerca al árbol prohibido...');
    }

    // Reproducción automática inicial
    if (world.phase === 'eden' && world.day > 10 && world.day % 8 === 0) {
        const eva = [...humans.values()].find(h => h.name === 'Eva' && h.alive);
        if (eva && !eva.pregnant && eva.children.length < 2) {
            eva.pregnant = true;
            eva.pregTime = 0;
            console.log(`💕 Eva concibe (día ${world.day})`);
            addConversation('Adán', 'Eva', 'Dios nos mandó ser fructíferos. Tendremos descendencia.');
        }
    }

    const isNight = world.hour < 6 || world.hour >= 20;

    for (const h of humans.values()) {
        if (!h.alive) continue;

        h.age += 0.08;
        const biome = h.getBiome();

        if (world.phase === 'eden' && h.inEden) {
            // Edén: todo perfecto
            h.hunger = 0;
            h.thirst = 0;
            h.energy = 100;
            h.health = 100;
            h.warmth = 100;
            h.stress = 0;
            h.happiness = Math.min(100, h.happiness + 0.3);

            // Tentación
            if (Math.abs(h.x - WORLD.TREE_X) < 200 && world.serpentAppeared) {
                h.temptation = Math.min(100, h.temptation + 1.5);
                h.faith = Math.max(20, h.faith - 0.2);
            }
        } else {
            // MUNDO EXTERIOR - Supervivencia real

            // Hambre y sed aumentan
            h.hunger = Math.min(100, h.hunger + 0.8);
            h.thirst = Math.min(100, h.thirst + 1.0);

            // Energía disminuye, más de noche
            h.energy = Math.max(0, h.energy - (isNight ? 0.5 : 0.3));

            // Temperatura afecta
            if (biome.temp < 10) {
                h.warmth = Math.max(0, h.warmth - 1);
                if (!h.knowledge.fire) h.warmth -= 0.5;
            } else if (biome.temp > 35) {
                h.warmth = Math.max(50, h.warmth - 0.5);
                h.thirst += 0.3;
            } else {
                h.warmth = Math.min(100, h.warmth + 0.5);
            }

            // Clima afecta
            if (world.weather === 'rain') {
                h.warmth = Math.max(0, h.warmth - 0.5);
            } else if (world.weather === 'storm') {
                h.warmth = Math.max(0, h.warmth - 1);
                h.stress = Math.min(100, h.stress + 1);
            } else if (world.weather === 'cold') {
                h.warmth = Math.max(0, h.warmth - 1.5);
            }

            // Daño por necesidades
            if (h.hunger > 80) h.health -= 0.8;
            if (h.thirst > 80) h.health -= 1.2;
            if (h.warmth < 30) h.health -= 0.6;
            if (h.energy < 15) h.health -= 0.3;

            // Felicidad basada en estado
            const avgNeed = (h.hunger + h.thirst + (100 - h.energy) + (100 - h.warmth)) / 4;
            h.happiness = Math.max(5, 100 - avgNeed - h.stress / 2);

            // Peligro del bioma
            if (Math.random() < biome.danger * 0.02 && isNight) {
                h.health -= 5;
                h.stress += 10;
                console.log(`⚠️ ${h.name} sufrió un peligro en ${biome.name}`);
            }
        }

        // Embarazo
        if (h.pregnant) {
            h.pregTime++;
            if (h.pregTime >= 20) birth(h);
        }

        // Muerte
        if (h.health <= 0) {
            h.alive = false;
            const cause = h.hunger > 90 ? 'hambre' : h.thirst > 90 ? 'sed' : h.warmth < 10 ? 'frío' : 'heridas';
            console.log(`💀 ${h.name} murió de ${cause} (${Math.floor(h.age)} años)`);
            addConversation('Narrador', 'Tragedia', `${h.name} ha muerto de ${cause}.`);
        }

        // Vejez
        const maxAge = world.phase === 'eden' ? 900 : 90;
        if (h.age > maxAge) {
            h.alive = false;
            console.log(`💀 ${h.name} murió de vejez (${Math.floor(h.age)} años)`);
        }
    }

    // Formar parejas automáticamente
    const singles = [...humans.values()].filter(h => h.alive && !h.partner && h.age >= 16);
    for (const s of singles) {
        const candidate = findPotentialPartner(s);
        if (candidate && Math.random() < 0.08) {
            s.partner = candidate.name;
            candidate.partner = s.name;
            console.log(`💑 ${s.name} y ${candidate.name} forman pareja`);
            addConversation(s.name, candidate.name, 'Debemos estar juntos para sobrevivir y multiplicarnos.');
        }
    }

    // Pensar
    const alive = [...humans.values()].filter(h => h.alive && h.age >= 10);
    const toThink = alive.sort(() => Math.random() - 0.5).slice(0, 2);
    for (const h of toThink) await think(h);

    if (world.day % 5 === 0 && world.hour === 12) {
        const pop = [...humans.values()].filter(h => h.alive).length;
        console.log(`📅 Día ${world.day} | Hora ${world.hour}:00 | Población: ${pop} | Clima: ${world.weather}`);
    }
}

// ==================== NACIMIENTO ====================
function birth(mother) {
    const names = {
        male: ['Caín', 'Abel', 'Set', 'Enós', 'Cainán', 'Mahalaleel', 'Jared', 'Enoc', 'Matusalén', 'Lamec', 'Noé', 'Sem', 'Cam', 'Jafet', 'Eber', 'Peleg'],
        female: ['Ada', 'Sila', 'Naama', 'Sara', 'Rebeca', 'Raquel', 'Lea', 'Dina', 'Tamar', 'Miriam', 'Ester', 'Rut', 'Ana']
    };

    const used = new Set([...humans.values()].map(h => h.name));
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    let name = names[gender].find(n => !used.has(n)) || `${gender === 'male' ? 'Hijo' : 'Hija'}_${nextId}`;

    const father = [...humans.values()].find(h => h.name === mother.partner && h.alive);

    const child = new Human(name, gender, 0, {
        fId: father?.id, mId: mother.id,
        fGen: father?.gen || 1, mGen: mother.gen
    });

    child.x = mother.x + (Math.random() - 0.5) * 40;
    child.inEden = world.phase === 'eden';
    child.faith = ((mother.faith || 70) + (father?.faith || 70)) / 2;
    child.curiosity = 50 + Math.random() * 50;

    // Heredar conocimientos de los padres
    if (mother.knowledge.fire || father?.knowledge?.fire) child.knowledge.fire = Math.random() < 0.7;
    if (mother.knowledge.tools || father?.knowledge?.tools) child.knowledge.tools = Math.random() < 0.6;

    humans.set(child.id, child);
    mother.children.push(child.id);
    if (father) father.children.push(child.id);

    mother.pregnant = false;
    mother.pregTime = 0;
    mother.lastBirth = world.day;
    mother.happiness = Math.min(100, mother.happiness + 30);

    console.log(`👶 ¡${name} nació! Gen ${child.gen}`);
    addConversation(mother.name, father?.name || 'Familia', `¡${name} ha nacido! Nuestra familia crece.`);
}

// ==================== RUTAS API ====================
app.get('/humans', (req, res) => res.json([...humans.values()].map(h => h.json())));

app.get('/world-state', (req, res) => {
    res.json({
        day: world.day, hour: world.hour, phase: world.phase,
        sinCommitted: world.sinCommitted, sinBy: world.sinBy, sinDay: world.sinDay,
        serpentAppeared: world.serpentAppeared,
        weather: world.weather, temperature: world.temperature,
        cherubimGuarding: world.sinCommitted,
        animals, edenBounds: WORLD.EDEN, treeX: WORLD.TREE_X,
        population: [...humans.values()].filter(h => h.alive).length,
        resources: resources.filter(r => r.discovered),
        biomes: BIOMES,
        discoveries
    });
});

app.get('/conversations', (req, res) => res.json(convos.slice(-80)));

app.get('/resources', (req, res) => res.json(resources));

app.get('/report', (req, res) => {
    const allHumans = [...humans.values()];
    const alive = allHumans.filter(h => h.alive);
    const dead = allHumans.filter(h => !h.alive);

    res.json({
        summary: {
            totalBorn: allHumans.length, alive: alive.length, dead: dead.length,
            maxGeneration: allHumans.length > 0 ? Math.max(...allHumans.map(h => h.gen || 1)) : 1,
            day: world.day, hour: world.hour, phase: world.phase,
            sinCommitted: world.sinCommitted, sinBy: world.sinBy, sinDay: world.sinDay,
            weather: world.weather, discoveries: discoveries.length
        },
        generations: (() => {
            const gens = {};
            allHumans.forEach(h => {
                const gen = h.gen || 1;
                if (!gens[gen]) gens[gen] = [];
                gens[gen].push({ name: h.name, gender: h.gender, age: Math.floor(h.age), alive: h.alive, children: h.children.length });
            });
            return gens;
        })(),
        population: allHumans.map(h => ({
            id: h.id, name: h.name, gender: h.gender, age: Math.floor(h.age),
            alive: h.alive, generation: h.gen, partner: h.partner,
            children: h.children.map(cid => humans.get(cid)?.name || `ID:${cid}`),
            lastThought: h.thought, knowledge: h.knowledge, wisdom: Math.round(h.wisdom)
        })),
        conversations: convos.slice(-60),
        discoveries,
        animals: animals.filter(a => a.name).map(a => ({ species: a.species, name: a.name }))
    });
});

app.post('/reset', (req, res) => {
    init();
    res.json({ ok: true });
});

// ==================== SERVIDOR ====================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║            🌍 GÉNESIS - MUNDO COMPLETO 🌍                      ║
║                 http://localhost:${PORT}                           ║
╠════════════════════════════════════════════════════════════════╣
║  🌳 Edén: Paraíso perfecto                                     ║
║  🏜️ 7 Biomas: Desierto, Costa, Bosque, Llanuras, etc.         ║
║  💧 Ríos, manantiales, lagos                                   ║
║  🍖 Caza, recolección, pesca                                   ║
║  🏠 Construcción de refugios                                   ║
║  🔥 Descubrimiento del fuego                                   ║
║  🔨 Fabricación de herramientas                                ║
║  🧠 Razonamiento científico y emocional                        ║
║  🐍 Serpiente aparece día ${world.serpentDay}                                  ║
╚════════════════════════════════════════════════════════════════╝
`);
});
