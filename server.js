const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// ==================== API KEY (se configura desde el frontend) ====================
let DEEPSEEK_KEY = null;
let simulationStarted = false;
let simulationInterval = null;

// Pantalla de configuración de API
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
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .subtitle {
            color: #aaa;
            margin-bottom: 30px;
        }
        .eden-icon {
            font-size: 4em;
            margin-bottom: 20px;
        }
        input[type="password"] {
            width: 100%;
            padding: 15px;
            border: none;
            border-radius: 10px;
            font-size: 1em;
            background: rgba(255,255,255,0.2);
            color: #fff;
            margin-bottom: 20px;
        }
        input[type="password"]::placeholder {
            color: rgba(255,255,255,0.5);
        }
        button {
            width: 100%;
            padding: 15px 30px;
            border: none;
            border-radius: 10px;
            font-size: 1.1em;
            cursor: pointer;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
        }
        .info {
            margin-top: 25px;
            padding: 15px;
            background: rgba(255,255,255,0.05);
            border-radius: 10px;
            font-size: 0.9em;
            color: #ccc;
        }
        .info a {
            color: #667eea;
            text-decoration: none;
        }
        .features {
            text-align: left;
            margin-top: 20px;
        }
        .features li {
            margin: 8px 0;
            padding-left: 25px;
            position: relative;
        }
        .features li::before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #4ade80;
        }
        .error {
            background: rgba(255,0,0,0.2);
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 15px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="eden-icon">🌳</div>
        <h1>GÉNESIS</h1>
        <p class="subtitle">Simulación Bíblica con IA</p>

        <div class="error" id="error"></div>

        <input type="password" id="apiKey" placeholder="Introduce tu DeepSeek API Key" />
        <button onclick="startSimulation()">Iniciar Simulación</button>

        <div class="info">
            <p>Obtén tu API key en: <a href="https://platform.deepseek.com" target="_blank">platform.deepseek.com</a></p>
            <ul class="features">
                <li>Adán y Eva en el Jardín del Edén</li>
                <li>La serpiente aparecerá el día 10</li>
                <li>Sistema de fe y tentación</li>
                <li>Vida dura fuera del Edén</li>
                <li>Procreación y generaciones</li>
            </ul>
        </div>
    </div>

    <script>
        function startSimulation() {
            const apiKey = document.getElementById('apiKey').value.trim();
            const errorDiv = document.getElementById('error');

            if (!apiKey) {
                errorDiv.textContent = 'Por favor, introduce tu API key de DeepSeek';
                errorDiv.style.display = 'block';
                return;
            }

            if (!apiKey.startsWith('sk-')) {
                errorDiv.textContent = 'La API key debe empezar con "sk-"';
                errorDiv.style.display = 'block';
                return;
            }

            fetch('/set-api-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey })
            })
            .then(res => res.json())
            .then(data => {
                if (data.ok) {
                    window.location.href = '/genesis.html';
                } else {
                    errorDiv.textContent = data.error || 'Error al configurar la API';
                    errorDiv.style.display = 'block';
                }
            })
            .catch(err => {
                errorDiv.textContent = 'Error de conexión';
                errorDiv.style.display = 'block';
            });
        }

        // Enter para enviar
        document.getElementById('apiKey').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') startSimulation();
        });
    </script>
</body>
</html>
        `);
    } else {
        res.sendFile(path.join(__dirname, 'genesis.html'));
    }
});

// Static SIN index automático
app.use(express.static(path.join(__dirname), { index: false }));

// ==================== CONFIGURAR API KEY ====================
app.post('/set-api-key', (req, res) => {
    const { apiKey } = req.body;

    if (!apiKey || !apiKey.startsWith('sk-')) {
        return res.json({ ok: false, error: 'API key inválida' });
    }

    DEEPSEEK_KEY = apiKey;

    // Iniciar simulación
    if (!simulationStarted) {
        init();
        simulationStarted = true;

        // Auto-simulación cada 3 segundos
        simulationInterval = setInterval(async () => {
            try {
                await simulate();
            } catch (e) {
                console.error('Error simulación:', e.message);
            }
        }, 3000);
    }

    console.log('✅ API Key configurada. Simulación iniciada.');
    res.json({ ok: true });
});

// ==================== DEEPSEEK API ====================
const MODEL = 'deepseek-chat';

async function askAI(systemPrompt, userPrompt) {
    if (!DEEPSEEK_KEY) {
        console.error('No hay API key configurada');
        return null;
    }

    try {
        const res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 100,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        });
        const data = await res.json();
        if (data.error) {
            console.error('DeepSeek Error:', data.error.message || data.error);
            return null;
        }
        return data.choices?.[0]?.message?.content || null;
    } catch (e) {
        console.error('API fail:', e.message);
        return null;
    }
}

// ==================== MUNDO BÍBLICO ====================
const WORLD = {
    EDEN: { x1: 5000, x2: 7000, center: 6000 },
    TREE_X: 6000,
    OUTSIDE_LEFT: 2000,
    OUTSIDE_RIGHT: 10000
};

let world = {
    day: 1,
    phase: 'eden',
    sinCommitted: false,
    sinBy: null,
    sinDay: null,
    serpentAppeared: false,
    serpentDay: 10
};

let animals = [
    { id: 1, species: 'ciervo', x: 5700, name: null },
    { id: 2, species: 'conejo', x: 5850, name: null },
    { id: 3, species: 'paloma', x: 6000, name: null },
    { id: 4, species: 'cordero', x: 6150, name: null },
    { id: 5, species: 'zorro', x: 6300, name: null }
];

// ==================== HUMANOS ====================
let humans = new Map();
let convos = [];
let nextId = 1;

class Human {
    constructor(name, gender, age, parents = null) {
        this.id = nextId++;
        this.name = name;
        this.gender = gender;
        this.age = age;
        this.x = WORLD.EDEN.center;
        this.alive = true;
        this.health = 100;
        this.hunger = 0;
        this.thirst = 0;
        this.energy = 100;
        this.happiness = 100;
        this.parents = parents;
        this.partner = null;
        this.children = [];
        this.pregnant = false;
        this.pregTime = 0;
        this.lastBirth = -50;
        this.thought = "...";
        this.action = null;
        this.gen = parents ? Math.max(parents.fGen || 1, parents.mGen || 1) + 1 : 1;
        this.temptation = 0;
        this.faith = 100;
        this.sinned = false;
        this.inEden = true;
        this.skills = {
            farming: 0,
            hunting: 0,
            building: 0
        };
    }

    json() {
        return {
            id: this.id,
            name: this.name,
            gender: this.gender,
            x: Math.round(this.x),
            age: Math.floor(this.age),
            alive: this.alive,
            health: Math.round(this.health),
            hunger: Math.round(this.hunger),
            thirst: Math.round(this.thirst),
            energy: Math.round(this.energy),
            happiness: Math.round(this.happiness),
            partner: this.partner,
            childrenCount: this.children.length,
            pregnant: this.pregnant,
            thought: this.thought,
            action: this.action,
            generation: this.gen,
            inEden: this.inEden,
            temptation: Math.round(this.temptation),
            faith: Math.round(this.faith)
        };
    }
}

// ==================== INICIALIZAR ====================
function init() {
    humans.clear();
    convos = [];
    nextId = 1;
    world = {
        day: 1,
        phase: 'eden',
        sinCommitted: false,
        sinBy: null,
        sinDay: null,
        serpentAppeared: false,
        serpentDay: 10
    };
    animals.forEach(a => a.name = null);

    const adam = new Human('Adán', 'male', 25);
    const eva = new Human('Eva', 'female', 23);

    adam.partner = 'Eva';
    eva.partner = 'Adán';
    adam.x = WORLD.EDEN.x1 + 200;
    eva.x = WORLD.EDEN.x1 + 250;
    adam.happiness = 100;
    eva.happiness = 100;
    adam.faith = 100;
    eva.faith = 100;

    humans.set(adam.id, adam);
    humans.set(eva.id, eva);

    console.log('🌳 Génesis: Adán y Eva en el Jardín del Edén');
}

// ==================== PENSAR ====================
async function think(h) {
    if (!h.alive || h.age < 3) return;

    const others = [...humans.values()].filter(o => o.id !== h.id && o.alive && Math.abs(o.x - h.x) < 150);
    const nearTree = Math.abs(h.x - WORLD.TREE_X) < 100 && !world.sinCommitted && h.inEden;
    const serpentHere = nearTree && world.serpentAppeared;

    let situation = '';

    if (world.phase === 'eden') {
        situation = `Estás en el PARAÍSO del Edén. Todo es perfecto.
Hambre: ${h.hunger}% | Felicidad: ${h.happiness}% | Fe: ${h.faith}%`;

        if (serpentHere) {
            situation += `

🐍 ¡LA SERPIENTE está junto al ÁRBOL PROHIBIDO!
Susurra: "Si comen, serán como dioses..."
Tentación: ${h.temptation}%
Puedes RESISTIR o CEDER (di "como el fruto")`;
        }
    } else {
        situation = `EXPULSADOS del Edén. Vida DURA.
Hambre: ${h.hunger}% | Sed: ${h.thirst}% | Energía: ${h.energy}%
Debes trabajar para sobrevivir.`;
    }

    const partner = others.find(o => o.name === h.partner);
    const canMate = partner && h.age >= 16 && partner.age >= 16 && !h.pregnant && !partner.pregnant;

    let prompt = `Eres ${h.name}, ${h.gender === 'male' ? 'hombre' : 'mujer'} de ${Math.floor(h.age)} años.
Pareja: ${h.partner || 'ninguna'}. Hijos: ${h.children.length}.
${h.pregnant ? '¡Embarazada!' : ''}

${situation}

Cerca: ${others.length > 0 ? others.map(o => o.name).join(', ') : 'nadie'}

ACCIONES:
- Caminar (izquierda/derecha)
- Hablar con ${h.partner || 'alguien'}
${canMate ? '- Tener hijos (di "quiero hijos")' : ''}
${world.phase === 'fallen' ? '- Buscar comida/agua, trabajar' : ''}
${serpentHere ? '- COMER el fruto O RESISTIR' : ''}

Responde 1-2 frases BREVES. ¿Qué haces?`;

    const response = await askAI(
        'Simulas un personaje bíblico. Responde breve, en primera persona.',
        prompt
    );

    if (!response) return;

    h.thought = response.trim().substring(0, 180);
    console.log(`💭 ${h.name}: ${h.thought}`);

    const txt = response.toLowerCase();

    // PECADO
    if (serpentHere && !world.sinCommitted) {
        const eats = /como|muerdo|pruebo|tomo.*fruto|cedo|acepto/i.test(txt);
        const resists = /no|resisto|rechazo|aparto|alejo|dios|fe|prohib/i.test(txt);

        if (resists) {
            h.faith = Math.min(100, h.faith + 10);
            h.temptation = Math.max(0, h.temptation - 15);
            h.thought = "¡No! Dios nos lo prohibió.";
            h.x += h.x < WORLD.TREE_X ? -80 : 80;
            console.log(`✝️ ${h.name} RESISTE la tentación`);
        } else if (eats || h.temptation >= 95) {
            commitSin(h);
            return;
        }
    }

    // REPRODUCCIÓN
    if (canMate && /hijos|hijo|bebé|descenden|procrear/i.test(txt)) {
        const female = h.gender === 'female' ? h : partner;
        if (!female.pregnant && world.day - female.lastBirth > 20) {
            female.pregnant = true;
            female.pregTime = 0;
            console.log(`💕 ¡${female.name} está embarazada!`);
        }
    }

    // MOVIMIENTO
    if (/izquierda|oeste|alejar/i.test(txt)) {
        h.x -= 40 + Math.random() * 30;
    } else if (/derecha|este|acercar/i.test(txt)) {
        h.x += 40 + Math.random() * 30;
    } else if (/árbol|fruto|serpiente/i.test(txt) && !world.sinCommitted && world.serpentAppeared) {
        h.x += (WORLD.TREE_X - h.x) * 0.2;
        h.temptation += 5;
    } else if (/explor|camin|paseo/i.test(txt)) {
        h.x += (Math.random() - 0.5) * 60;
    } else if (partner && /junto|acerc|habla/i.test(txt)) {
        h.x += (partner.x - h.x) * 0.3;
    }

    // TRABAJO
    if (world.phase === 'fallen') {
        if (/caza|cazo|animal/i.test(txt)) {
            h.skills.hunting += 0.5;
            h.energy -= 10;
            if (Math.random() < h.skills.hunting / 20) {
                h.hunger = Math.max(0, h.hunger - 40);
            }
        }
        if (/cultiv|sembr|plant/i.test(txt)) {
            h.skills.farming += 0.5;
            h.energy -= 8;
        }
        if (/agua|beb|río/i.test(txt)) {
            h.thirst = Math.max(0, h.thirst - 30);
        }
        if (/descans|dorm/i.test(txt)) {
            h.energy = Math.min(100, h.energy + 20);
        }
    }

    // LÍMITES Y BARRERA
    if (h.inEden && !world.sinCommitted) {
        h.x = Math.max(WORLD.EDEN.x1 + 50, Math.min(WORLD.EDEN.x2 - 50, h.x));
    } else {
        h.x = Math.max(WORLD.OUTSIDE_LEFT, Math.min(WORLD.OUTSIDE_RIGHT, h.x));
        if (world.sinCommitted && h.x >= WORLD.EDEN.x1 - 100) {
            h.x = WORLD.EDEN.x1 - 150;
            h.thought = "¡El querubín con espada flamígera guarda el Edén!";
            console.log(`⚔️🔥 ${h.name} bloqueado por el querubín`);
        }
    }

    if (others.length > 0 && response.length > 20) {
        convos.push({ from: h.name, to: others[0].name, msg: response.substring(0, 100), day: world.day });
    }
}

// ==================== PECADO ====================
function commitSin(sinner) {
    world.sinCommitted = true;
    world.sinBy = sinner.name;
    world.sinDay = world.day;
    world.phase = 'fallen';
    sinner.sinned = true;
    sinner.thought = "He comido del fruto... ahora sé el bien y el mal...";

    console.log(`🍎❌ ¡${sinner.name} COMIÓ DEL FRUTO PROHIBIDO!`);

    setTimeout(() => {
        let baseX = WORLD.EDEN.x1 - 300;
        humans.forEach(h => {
            h.inEden = false;
            h.happiness = Math.max(20, h.happiness - 50);
            h.x = baseX + Math.random() * 50;
            h.thought = "Expulsados del Paraíso...";
        });
        console.log(`🚪 Expulsados del Edén`);
    }, 100);
}

// ==================== SIMULACIÓN ====================
async function simulate() {
    if (!DEEPSEEK_KEY) return;

    world.day++;

    if (!world.serpentAppeared && world.day >= world.serpentDay && !world.sinCommitted) {
        world.serpentAppeared = true;
        console.log(`🐍 Día ${world.day}: La SERPIENTE aparece...`);
    }

    for (const h of humans.values()) {
        if (!h.alive) continue;
        h.age += 0.1;

        if (world.phase === 'eden' && h.inEden) {
            h.hunger = Math.max(0, h.hunger - 2);
            h.thirst = 0;
            h.energy = 100;
            h.health = Math.min(100, h.health + 1);

            if (Math.abs(h.x - WORLD.TREE_X) < 150 && world.serpentAppeared) {
                h.temptation = Math.min(100, h.temptation + 3 + Math.random() * 5);
                h.faith = Math.max(0, h.faith - 1);
            }
        } else {
            h.hunger = Math.min(100, h.hunger + 1.5);
            h.thirst = Math.min(100, h.thirst + 2);
            h.energy = Math.max(0, h.energy - 0.5);

            if (h.hunger > 80) h.health -= 2;
            if (h.thirst > 80) h.health -= 3;
            if (h.energy < 10) h.health -= 1;
            h.happiness = Math.max(10, 100 - h.hunger/2 - h.thirst/2);
        }

        if (h.pregnant) {
            h.pregTime++;
            if (h.pregTime >= 15) birth(h);
        }

        if (h.health <= 0 || h.age > 900 || (world.phase === 'fallen' && h.age > 120)) {
            h.alive = false;
            console.log(`💀 ${h.name} murió (${Math.floor(h.age)} años)`);
        }
    }

    const alive = [...humans.values()].filter(h => h.alive && h.age >= 3);
    const toThink = alive.sort(() => Math.random() - 0.5).slice(0, 2);
    for (const h of toThink) await think(h);

    if (world.day % 20 === 0) {
        console.log(`📅 Día ${world.day} | Población: ${[...humans.values()].filter(h => h.alive).length}`);
    }
}

// ==================== NACIMIENTO ====================
function birth(mother) {
    const biblicalNames = {
        male: ['Caín', 'Abel', 'Set', 'Enós', 'Cainán', 'Mahalaleel', 'Jared', 'Enoc', 'Matusalén', 'Lamec', 'Noé'],
        female: ['Ada', 'Sila', 'Naama', 'Sara', 'Rebeca', 'Raquel', 'Lea', 'Dina', 'Tamar', 'Miriam']
    };

    const used = new Set([...humans.values()].map(h => h.name));
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    let name = biblicalNames[gender].find(n => !used.has(n)) || `Hijo_${nextId}`;
    const father = [...humans.values()].find(h => h.name === mother.partner);

    const child = new Human(name, gender, 0, {
        fId: father?.id, mId: mother.id, fGen: father?.gen || 1, mGen: mother.gen
    });

    child.x = mother.x + (Math.random() - 0.5) * 30;
    child.inEden = world.phase === 'eden';
    child.faith = (mother.faith + (father?.faith || 50)) / 2;

    humans.set(child.id, child);
    mother.children.push(child.id);
    if (father) father.children.push(child.id);

    mother.pregnant = false;
    mother.pregTime = 0;
    mother.lastBirth = world.day;

    console.log(`👶 ${name} nació (Gen ${child.gen})`);
}

// ==================== RUTAS API ====================
app.get('/humans', (req, res) => res.json([...humans.values()].map(h => h.json())));

app.get('/world-state', (req, res) => {
    res.json({
        day: world.day,
        phase: world.phase,
        sinCommitted: world.sinCommitted,
        sinBy: world.sinBy,
        sinDay: world.sinDay,
        serpentAppeared: world.serpentAppeared,
        cherubimGuarding: world.sinCommitted,
        cherubimX: WORLD.EDEN.x1 - 50,
        animals,
        edenBounds: WORLD.EDEN,
        treeX: WORLD.TREE_X,
        population: [...humans.values()].filter(h => h.alive).length,
        apiConfigured: !!DEEPSEEK_KEY
    });
});

app.get('/conversations', (req, res) => res.json(convos.slice(-30)));

app.get('/report', (req, res) => {
    const allHumans = [...humans.values()];
    const alive = allHumans.filter(h => h.alive);
    const dead = allHumans.filter(h => !h.alive);

    const generations = {};
    allHumans.forEach(h => {
        const gen = h.gen || 1;
        if (!generations[gen]) generations[gen] = [];
        generations[gen].push({ name: h.name, gender: h.gender, age: Math.floor(h.age), alive: h.alive, children: h.children.length });
    });

    res.json({
        summary: {
            totalBorn: allHumans.length, alive: alive.length, dead: dead.length,
            maxGeneration: Math.max(...allHumans.map(h => h.gen || 1)),
            day: world.day, phase: world.phase, sinCommitted: world.sinCommitted, sinBy: world.sinBy, sinDay: world.sinDay
        },
        generations,
        population: allHumans.map(h => ({
            id: h.id, name: h.name, gender: h.gender, age: Math.floor(h.age), alive: h.alive,
            generation: h.gen, partner: h.partner, children: h.children.map(cid => humans.get(cid)?.name || `ID:${cid}`), lastThought: h.thought
        })),
        conversations: convos.slice(-20),
        animals: animals.filter(a => a.name).map(a => ({ species: a.species, name: a.name }))
    });
});

app.post('/reset', (req, res) => {
    init();
    res.json({ ok: true, message: 'Génesis reiniciado' });
});

// ==================== INICIAR SERVIDOR ====================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║     🌳 GÉNESIS - Simulación Bíblica 🌳        ║
║         Powered by DeepSeek                   ║
║         http://localhost:${PORT}                  ║
╠═══════════════════════════════════════════════╣
║  Abre el navegador e introduce tu API key     ║
╚═══════════════════════════════════════════════╝
`);
});
