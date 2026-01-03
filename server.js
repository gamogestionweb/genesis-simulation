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
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
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
            color: #fff; transition: transform 0.2s;
        }
        button:hover { transform: translateY(-2px); }
        .info { margin-top: 25px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 10px; }
        .info a { color: #667eea; }
        .features { text-align: left; margin-top: 20px; }
        .features li { margin: 8px 0; padding-left: 25px; position: relative; }
        .features li::before { content: "✓"; position: absolute; left: 0; color: #4ade80; }
        .error { background: rgba(255,0,0,0.2); padding: 10px; border-radius: 5px; margin-bottom: 15px; display: none; }
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
                <li>Reproducción y descendencia realista</li>
                <li>La serpiente aparece después</li>
                <li>Elección: resistir o ceder</li>
                <li>Vida dura fuera del Edén</li>
            </ul>
        </div>
    </div>
    <script>
        function startSimulation() {
            const apiKey = document.getElementById('apiKey').value.trim();
            const errorDiv = document.getElementById('error');
            if (!apiKey || !apiKey.startsWith('sk-')) {
                errorDiv.textContent = 'API key inválida (debe empezar con sk-)';
                errorDiv.style.display = 'block';
                return;
            }
            fetch('/set-api-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey })
            }).then(r => r.json()).then(d => {
                if (d.ok) window.location.href = '/genesis.html';
                else { errorDiv.textContent = d.error; errorDiv.style.display = 'block'; }
            });
        }
        document.getElementById('apiKey').addEventListener('keypress', e => { if (e.key === 'Enter') startSimulation(); });
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
        setInterval(async () => {
            try { await simulate(); } catch (e) { console.error('Error:', e.message); }
        }, 3000);
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
                max_tokens: 150,
                temperature: 0.9,
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

// ==================== MUNDO ====================
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
    serpentDay: 20  // La serpiente aparece día 20
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
        this.lastBirth = -999;
        this.thought = "...";
        this.gen = parents ? Math.max(parents.fGen || 1, parents.mGen || 1) + 1 : 1;
        this.temptation = 0;
        this.faith = 80 + Math.random() * 20;
        this.sinned = false;
        this.inEden = true;
        this.skills = { farming: 0, hunting: 0, building: 0 };
    }

    json() {
        return {
            id: this.id, name: this.name, gender: this.gender,
            x: Math.round(this.x), age: Math.floor(this.age),
            alive: this.alive, health: Math.round(this.health),
            hunger: Math.round(this.hunger), thirst: Math.round(this.thirst),
            energy: Math.round(this.energy), happiness: Math.round(this.happiness),
            partner: this.partner, childrenCount: this.children.length,
            pregnant: this.pregnant, thought: this.thought,
            generation: this.gen, inEden: this.inEden,
            temptation: Math.round(this.temptation), faith: Math.round(this.faith)
        };
    }
}

// ==================== INICIALIZAR ====================
function init() {
    humans.clear();
    convos = [];
    nextId = 1;
    world = {
        day: 1, phase: 'eden', sinCommitted: false,
        sinBy: null, sinDay: null, serpentAppeared: false, serpentDay: 20
    };
    animals.forEach(a => a.name = null);

    const adam = new Human('Adán', 'male', 25);
    const eva = new Human('Eva', 'female', 23);

    adam.partner = 'Eva';
    eva.partner = 'Adán';
    // Juntos, lejos del árbol
    adam.x = WORLD.EDEN.x1 + 300;
    eva.x = WORLD.EDEN.x1 + 350;

    humans.set(adam.id, adam);
    humans.set(eva.id, eva);

    console.log('🌳 Génesis iniciado: Adán y Eva en el Edén');
    addConversation('Dios', 'Adán y Eva', 'Sean fructíferos y multiplíquense. Pero NO coman del árbol del conocimiento.');
}

// ==================== BUSCAR PAREJA ====================
function findPotentialPartner(h) {
    // Buscar pareja del sexo opuesto, viva, mayor de 16, sin pareja
    const candidates = [...humans.values()].filter(o =>
        o.id !== h.id &&
        o.alive &&
        o.gender !== h.gender &&
        o.age >= 16 &&
        !o.partner &&
        Math.abs(o.x - h.x) < 300
    );
    return candidates.length > 0 ? candidates[0] : null;
}

// ==================== PENSAR ====================
async function think(h) {
    if (!h.alive || h.age < 8) return;

    const others = [...humans.values()].filter(o => o.id !== h.id && o.alive && Math.abs(o.x - h.x) < 200);
    const partner = h.partner ? [...humans.values()].find(o => o.name === h.partner && o.alive) : null;
    const nearTree = Math.abs(h.x - WORLD.TREE_X) < 150 && !world.sinCommitted && h.inEden;
    const serpentHere = nearTree && world.serpentAppeared;

    let situation = '';
    let actions = [];

    if (world.phase === 'eden') {
        situation = `Vives en el PARAÍSO del Edén. Todo es perfecto y abundante.
Felicidad: ${h.happiness}% | Fe en Dios: ${Math.round(h.faith)}%`;

        if (partner) {
            situation += `\nTu amado/a ${partner.name} está ${Math.abs(partner.x - h.x) < 100 ? 'junto a ti' : 'cerca'}.`;
        }

        actions.push('- Pasear por el jardín');
        if (partner) actions.push(`- Hablar/estar con ${partner.name}`);

        // Reproducción - MUY IMPORTANTE
        if (partner && h.age >= 16 && partner.age >= 16) {
            const female = h.gender === 'female' ? h : partner;
            if (!female.pregnant) {
                actions.push(`- TENER HIJOS con ${partner.name} (di "quiero hijos/descendencia/multiplicarnos")`);
            }
        }

        // Sin pareja? Buscar
        if (!partner && h.age >= 16) {
            const candidate = findPotentialPartner(h);
            if (candidate) {
                actions.push(`- Cortejar a ${candidate.name} (di "me gusta/quiero estar con ${candidate.name}")`);
            }
        }

        if (serpentHere) {
            situation += `

⚠️ ¡LA SERPIENTE susurra junto al árbol prohibido!
"¿Por qué Dios les prohibió este fruto? Si lo comen, serán como dioses..."
Tentación: ${Math.round(h.temptation)}% | Fe: ${Math.round(h.faith)}%`;
            actions.push('- COMER el fruto (di "como/pruebo el fruto")');
            actions.push('- RESISTIR (di "no/rechazo/Dios lo prohibió")');
        }
    } else {
        // Fuera del Edén
        situation = `EXPULSADOS del Edén. La vida es DIFÍCIL.
Hambre: ${h.hunger}% | Sed: ${h.thirst}% | Energía: ${h.energy}%`;

        actions.push('- Cazar para comer');
        actions.push('- Buscar agua');
        actions.push('- Descansar');

        if (partner) {
            const female = h.gender === 'female' ? h : partner;
            if (!female.pregnant) {
                actions.push(`- Tener hijos con ${partner.name}`);
            }
        } else if (h.age >= 16) {
            const candidate = findPotentialPartner(h);
            if (candidate) {
                actions.push(`- Formar pareja con ${candidate.name}`);
            }
        }
    }

    if (h.pregnant) situation += `\n¡Estás EMBARAZADA!`;

    const othersNear = others.filter(o => o.name !== h.partner).map(o => o.name);

    const prompt = `Eres ${h.name}, ${h.gender === 'male' ? 'hombre' : 'mujer'} de ${Math.floor(h.age)} años.
Pareja: ${h.partner || 'ninguna'}
Hijos: ${h.children.length}
${h.pregnant ? '¡EMBARAZADA!' : ''}

${situation}

Cerca: ${others.map(o => o.name).join(', ') || 'nadie'}

ACCIONES:
${actions.join('\n')}

Responde en primera persona, 1-3 frases. ¿Qué haces/dices?`;

    const sysPrompt = `Eres un personaje bíblico realista. Responde SIEMPRE en primera persona.
${!h.partner && h.age >= 16 ? 'Quieres encontrar pareja y formar familia.' : ''}
${h.partner && !h.pregnant ? 'Amas a tu pareja y quieres tener hijos para multiplicar la humanidad.' : ''}
${serpentHere ? 'La serpiente te tienta. Decide según tu fe y tentación.' : ''}
Sé expresivo, emocional, habla con los demás.`;

    const response = await askAI(sysPrompt, prompt);
    if (!response) return;

    h.thought = response.trim().substring(0, 200);
    console.log(`💭 ${h.name}: ${h.thought}`);

    const txt = response.toLowerCase();

    // ===== DETECTAR ACCIONES =====

    // FORMAR PAREJA
    if (!h.partner && h.age >= 16) {
        const wantsPartner = /me gusta|quiero estar|amor|pareja|juntos|casarnos|unir/i.test(txt);
        if (wantsPartner) {
            const candidate = findPotentialPartner(h);
            if (candidate && !candidate.partner) {
                h.partner = candidate.name;
                candidate.partner = h.name;
                h.happiness = Math.min(100, h.happiness + 30);
                candidate.happiness = Math.min(100, candidate.happiness + 30);
                console.log(`💑 ¡${h.name} y ${candidate.name} son ahora pareja!`);
                addConversation(h.name, candidate.name, '¡Quiero estar contigo para siempre!');
            }
        }
    }

    // REPRODUCCIÓN
    const wantsKids = /hijos|hijo|bebé|descenden|procrear|familia|multiplicar|embaraz|fructí/i.test(txt);
    if (wantsKids && partner && h.age >= 16 && partner.age >= 16) {
        const female = h.gender === 'female' ? h : partner;
        if (!female.pregnant && world.day - female.lastBirth > 25) {
            female.pregnant = true;
            female.pregTime = 0;
            h.happiness = Math.min(100, h.happiness + 20);
            if (partner) partner.happiness = Math.min(100, partner.happiness + 20);
            console.log(`💕 ¡${female.name} está EMBARAZADA!`);
            addConversation(h.name, partner.name, '¡Vamos a tener un hijo!');
        }
    }

    // PECADO ORIGINAL
    if (serpentHere && !world.sinCommitted) {
        const eats = /como|muerdo|pruebo|probar|morder|fruto|cedo|acepto|manzana/i.test(txt);
        const resists = /no|rechazo|alejo|aparto|resisto|dios|prohib|fe|nunca|jamás/i.test(txt);

        if (resists && !eats) {
            h.faith = Math.min(100, h.faith + 5);
            h.temptation = Math.max(0, h.temptation - 15);
            h.x += h.x < WORLD.TREE_X ? -100 : 100;
            console.log(`✝️ ${h.name} RESISTE. Fe: ${Math.round(h.faith)}%`);
            addConversation(h.name, 'Dios', '¡No comeré del fruto prohibido!');
        } else if (eats) {
            commitSin(h);
            return;
        }
    }

    // MOVIMIENTO
    if (/izquierda|oeste/i.test(txt)) {
        h.x -= 50 + Math.random() * 40;
    } else if (/derecha|este/i.test(txt)) {
        h.x += 50 + Math.random() * 40;
    } else if (/árbol|fruto|serpiente|prohibido/i.test(txt) && !world.sinCommitted && world.serpentAppeared) {
        h.x += (WORLD.TREE_X - h.x) * 0.15;
        h.temptation += 3;
    } else if (/explor|camin|paseo/i.test(txt)) {
        h.x += (Math.random() - 0.5) * 80;
    } else if (partner && /acerc|junto|amor|abraz|habla|estar con/i.test(txt)) {
        h.x += (partner.x - h.x) * 0.4;
    }

    // TRABAJO (fuera del Edén)
    if (world.phase === 'fallen') {
        if (/caz|animal/i.test(txt)) {
            h.skills.hunting += 0.3;
            h.energy -= 8;
            if (Math.random() < 0.3 + h.skills.hunting / 20) {
                h.hunger = Math.max(0, h.hunger - 40);
                console.log(`🏹 ${h.name} cazó algo`);
            }
        }
        if (/agua|beb|río/i.test(txt)) {
            h.thirst = Math.max(0, h.thirst - 45);
        }
        if (/descans|dorm/i.test(txt)) {
            h.energy = Math.min(100, h.energy + 30);
        }
    }

    // LÍMITES
    if (h.inEden && !world.sinCommitted) {
        h.x = Math.max(WORLD.EDEN.x1 + 50, Math.min(WORLD.EDEN.x2 - 50, h.x));
    } else {
        h.x = Math.max(WORLD.OUTSIDE_LEFT, Math.min(WORLD.OUTSIDE_RIGHT, h.x));
        if (world.sinCommitted && h.x >= WORLD.EDEN.x1 - 100) {
            h.x = WORLD.EDEN.x1 - 200;
        }
    }

    // Guardar conversación
    if (others.length > 0 && response.length > 10) {
        addConversation(h.name, others[0].name, response.substring(0, 120));
    }
}

function addConversation(from, to, msg) {
    convos.push({ from, to, msg, day: world.day });
    if (convos.length > 100) convos.shift();
}

// ==================== PECADO ====================
function commitSin(sinner) {
    world.sinCommitted = true;
    world.sinBy = sinner.name;
    world.sinDay = world.day;
    world.phase = 'fallen';
    sinner.sinned = true;

    console.log(`🍎❌ ¡${sinner.name} COMIÓ DEL FRUTO PROHIBIDO!`);
    addConversation(sinner.name, 'Serpiente', 'He probado el fruto prohibido...');
    addConversation('Dios', 'Humanidad', '¡Han desobedecido! Serán EXPULSADOS del Paraíso.');

    setTimeout(() => {
        let baseX = WORLD.EDEN.x1 - 400;
        humans.forEach(h => {
            h.inEden = false;
            h.happiness = Math.max(10, h.happiness - 50);
            h.x = baseX + Math.random() * 100;
        });
        console.log(`🚪 Expulsados del Edén.`);
    }, 100);
}

// ==================== SIMULACIÓN ====================
async function simulate() {
    if (!DEEPSEEK_KEY) return;

    world.day++;

    // Serpiente aparece
    if (!world.serpentAppeared && world.day >= world.serpentDay && !world.sinCommitted) {
        world.serpentAppeared = true;
        console.log(`🐍 Día ${world.day}: ¡La SERPIENTE aparece!`);
        addConversation('Narrador', 'Mundo', 'La serpiente aparece junto al árbol prohibido...');
    }

    // FORZAR REPRODUCCIÓN si no tienen hijos después de un tiempo
    if (world.phase === 'eden' && world.day > 8 && world.day % 5 === 0) {
        const adam = [...humans.values()].find(h => h.name === 'Adán' && h.alive);
        const eva = [...humans.values()].find(h => h.name === 'Eva' && h.alive);
        if (adam && eva && !eva.pregnant && eva.children.length === 0 && world.day - eva.lastBirth > 20) {
            eva.pregnant = true;
            eva.pregTime = 0;
            console.log(`💕 Eva queda embarazada naturalmente (día ${world.day})`);
            addConversation('Adán', 'Eva', 'Debemos ser fructíferos y multiplicarnos como Dios mandó.');
        }
    }

    for (const h of humans.values()) {
        if (!h.alive) continue;
        h.age += 0.1;

        if (world.phase === 'eden' && h.inEden) {
            h.hunger = 0;
            h.thirst = 0;
            h.energy = 100;
            h.health = 100;

            // Tentación cerca del árbol
            if (Math.abs(h.x - WORLD.TREE_X) < 200 && world.serpentAppeared) {
                h.temptation = Math.min(100, h.temptation + 2);
                h.faith = Math.max(20, h.faith - 0.3);
            } else {
                h.temptation = Math.max(0, h.temptation - 0.5);
                h.faith = Math.min(100, h.faith + 0.1);
            }
        } else {
            // Fuera del Edén
            h.hunger = Math.min(100, h.hunger + 1);
            h.thirst = Math.min(100, h.thirst + 1.2);
            h.energy = Math.max(0, h.energy - 0.3);

            if (h.hunger > 80) h.health -= 1;
            if (h.thirst > 80) h.health -= 1.5;
        }

        // Embarazo
        if (h.pregnant) {
            h.pregTime++;
            if (h.pregTime >= 18) birth(h);
        }

        // Muerte
        if (h.health <= 0) {
            h.alive = false;
            console.log(`💀 ${h.name} murió (${Math.floor(h.age)} años)`);
        }

        // Vejez (más larga en el Edén)
        const maxAge = world.phase === 'eden' ? 900 : 120;
        if (h.age > maxAge) {
            h.alive = false;
            console.log(`💀 ${h.name} murió de vejez (${Math.floor(h.age)} años)`);
        }
    }

    // Forzar formación de parejas entre descendientes
    const singles = [...humans.values()].filter(h => h.alive && !h.partner && h.age >= 16);
    for (const s of singles) {
        const candidate = findPotentialPartner(s);
        if (candidate && Math.random() < 0.1) {
            s.partner = candidate.name;
            candidate.partner = s.name;
            console.log(`💑 ${s.name} y ${candidate.name} forman pareja`);
            addConversation(s.name, candidate.name, 'Quiero que estemos juntos.');
        }
    }

    // Pensar
    const alive = [...humans.values()].filter(h => h.alive && h.age >= 8);
    const toThink = alive.sort(() => Math.random() - 0.5).slice(0, 2);
    for (const h of toThink) await think(h);

    if (world.day % 10 === 0) {
        const pop = [...humans.values()].filter(h => h.alive).length;
        console.log(`📅 Día ${world.day} | Población: ${pop} | Fase: ${world.phase}`);
    }
}

// ==================== NACIMIENTO ====================
function birth(mother) {
    const names = {
        male: ['Caín', 'Abel', 'Set', 'Enós', 'Cainán', 'Mahalaleel', 'Jared', 'Enoc', 'Matusalén', 'Lamec', 'Noé', 'Sem', 'Cam', 'Jafet', 'Eber', 'Peleg', 'Reu', 'Serug', 'Nacor', 'Taré'],
        female: ['Ada', 'Sila', 'Naama', 'Sara', 'Rebeca', 'Raquel', 'Lea', 'Dina', 'Tamar', 'Miriam', 'Ester', 'Rut', 'Ana', 'Abigail', 'Betsabé', 'Débora']
    };

    const used = new Set([...humans.values()].map(h => h.name));
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    let name = names[gender].find(n => !used.has(n)) || `${gender === 'male' ? 'Hijo' : 'Hija'}_${nextId}`;

    const father = [...humans.values()].find(h => h.name === mother.partner && h.alive);

    const child = new Human(name, gender, 0, {
        fId: father?.id, mId: mother.id,
        fGen: father?.gen || 1, mGen: mother.gen
    });

    child.x = mother.x + (Math.random() - 0.5) * 50;
    child.inEden = world.phase === 'eden';
    child.faith = ((mother.faith || 80) + (father?.faith || 80)) / 2;

    humans.set(child.id, child);
    mother.children.push(child.id);
    if (father) father.children.push(child.id);

    mother.pregnant = false;
    mother.pregTime = 0;
    mother.lastBirth = world.day;
    mother.happiness = Math.min(100, mother.happiness + 25);

    console.log(`👶 ¡${name} nació! Gen ${child.gen} | Padres: ${mother.name} + ${father?.name || '?'}`);
    addConversation(mother.name, father?.name || 'Dios', `¡Nuestro hijo ${name} ha nacido!`);
}

// ==================== RUTAS API ====================
app.get('/humans', (req, res) => res.json([...humans.values()].map(h => h.json())));

app.get('/world-state', (req, res) => {
    res.json({
        day: world.day, phase: world.phase,
        sinCommitted: world.sinCommitted, sinBy: world.sinBy, sinDay: world.sinDay,
        serpentAppeared: world.serpentAppeared,
        cherubimGuarding: world.sinCommitted,
        animals, edenBounds: WORLD.EDEN, treeX: WORLD.TREE_X,
        population: [...humans.values()].filter(h => h.alive).length
    });
});

app.get('/conversations', (req, res) => res.json(convos.slice(-50)));

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
            maxGeneration: allHumans.length > 0 ? Math.max(...allHumans.map(h => h.gen || 1)) : 1,
            day: world.day, phase: world.phase,
            sinCommitted: world.sinCommitted, sinBy: world.sinBy, sinDay: world.sinDay
        },
        generations,
        population: allHumans.map(h => ({
            id: h.id, name: h.name, gender: h.gender, age: Math.floor(h.age),
            alive: h.alive, generation: h.gen, partner: h.partner,
            children: h.children.map(cid => humans.get(cid)?.name || `ID:${cid}`),
            lastThought: h.thought
        })),
        conversations: convos.slice(-50),
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
╔═══════════════════════════════════════════════════════════╗
║           🌳 GÉNESIS - Simulación Bíblica 🌳              ║
║              http://localhost:${PORT}                         ║
╠═══════════════════════════════════════════════════════════╣
║  • Reproducción realista (también entre descendientes)    ║
║  • La serpiente aparece día ${world.serpentDay}                           ║
║  • Elección: resistir o ceder                             ║
╚═══════════════════════════════════════════════════════════╝
`);
});
