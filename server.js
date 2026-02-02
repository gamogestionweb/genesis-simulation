const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

// ==================== SESSION SYSTEM ====================
// Each user has their own independent simulation
const sessions = new Map(); // sessionId -> { world, humans, convos, ... }
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours of inactivity

// Clean inactive sessions every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of sessions) {
        if (now - session.lastActivity > SESSION_TIMEOUT) {
            if (session.simulationTimer) clearInterval(session.simulationTimer);
            sessions.delete(sessionId);
            console.log(`🗑️ Session ${sessionId.substring(0,8)} removed due to inactivity`);
        }
    }
}, 10 * 60 * 1000);

// Session management middleware
function getSession(req, res, next) {
    let sessionId = req.cookies?.sessionId;

    if (sessionId && sessions.has(sessionId)) {
        req.session = sessions.get(sessionId);
        req.session.lastActivity = Date.now();
        req.sessionId = sessionId;
    } else {
        req.session = null;
        req.sessionId = null;
    }
    next();
}

app.use(getSession);

// Global variables ONLY for compatibility (overwritten per session)
let DEEPSEEK_KEY = null;
let simulationStarted = false;
let LANGUAGE = 'es'; // 'es' = español, 'en' = english

// Textos en ambos idiomas
const TEXTS = {
    es: {
        title: 'GENESIS',
        subtitle: 'Simulación de Libre Albedrío con IA Masiva',
        apiPlaceholder: 'Introduce tu DeepSeek API Key',
        startButton: '🚀 Iniciar Simulación',
        invalidKey: 'API key inválida',
        features: [
            { icon: '🍎', text: 'Tentación Psicológica Profunda' },
            { icon: '👥', text: 'Miles de Humanos Simultáneos' },
            { icon: '🌳', text: 'Edén sin Necesidades' },
            { icon: '🏜️', text: 'Mundo Exterior Desafiante' },
            { icon: '💭', text: 'Cada Mente es una IA' },
            { icon: '📊', text: 'Reportes Detallados' },
            { icon: '🧬', text: 'Reproducción Masiva' },
            { icon: '🔥', text: 'Descubrimientos Científicos' }
        ],
        langLabel: 'Idioma',
        // Prompts del sistema
        youAre: 'Eres',
        yearsOld: 'años',
        inEden: 'Vives en el Edén, un paraíso sin necesidades.',
        outsideEden: 'Vives fuera del Edén, en un mundo con desafíos.',
        yourPersonality: 'Tu personalidad',
        yourDesires: 'Tus deseos',
        yourFears: 'Tus miedos',
        currentState: 'Estado actual',
        hunger: 'Hambre',
        thirst: 'Sed',
        energy: 'Energía',
        health: 'Salud',
        happiness: 'Felicidad',
        faith: 'Fe',
        temptation: 'Tentación',
        day: 'Día',
        hour: 'Hora',
        thinkAbout: '¿Qué piensas en este momento?',
        respondTo: 'Responde a',
        said: 'dijo',
        serpentWhispers: 'La serpiente te susurra',
        divineVoice: 'Una voz divina te habla',
        maleBrain: 'CEREBRO MASCULINO',
        femaleBrain: 'CEREBRO FEMENINO',
        howYouThink: 'Cómo piensas y actúas'
    },
    en: {
        title: 'GENESIS',
        subtitle: 'Free Will Simulation with Massive AI',
        apiPlaceholder: 'Enter your DeepSeek API Key',
        startButton: '🚀 Start Simulation',
        invalidKey: 'Invalid API key',
        features: [
            { icon: '🍎', text: 'Deep Psychological Temptation' },
            { icon: '👥', text: 'Thousands of Simultaneous Humans' },
            { icon: '🌳', text: 'Eden without Needs' },
            { icon: '🏜️', text: 'Challenging Outside World' },
            { icon: '💭', text: 'Each Mind is an AI' },
            { icon: '📊', text: 'Detailed Reports' },
            { icon: '🧬', text: 'Massive Reproduction' },
            { icon: '🔥', text: 'Scientific Discoveries' }
        ],
        langLabel: 'Language',
        // System prompts
        youAre: 'You are',
        yearsOld: 'years old',
        inEden: 'You live in Eden, a paradise without needs.',
        outsideEden: 'You live outside Eden, in a world with challenges.',
        yourPersonality: 'Your personality',
        yourDesires: 'Your desires',
        yourFears: 'Your fears',
        currentState: 'Current state',
        hunger: 'Hunger',
        thirst: 'Thirst',
        energy: 'Energy',
        health: 'Health',
        happiness: 'Happiness',
        faith: 'Faith',
        temptation: 'Temptation',
        day: 'Day',
        hour: 'Hour',
        thinkAbout: 'What are you thinking right now?',
        respondTo: 'Respond to',
        said: 'said',
        serpentWhispers: 'The serpent whispers to you',
        divineVoice: 'A divine voice speaks to you',
        maleBrain: 'MALE BRAIN',
        femaleBrain: 'FEMALE BRAIN',
        howYouThink: 'How you think and act'
    }
};

function T(key) {
    return TEXTS[LANGUAGE]?.[key] || TEXTS['es'][key] || key;
}

// ==================== CONFIGURACIÓN ESCALABLE ====================
const CONFIG = {
    TICK_INTERVAL: 2000,          // 2 segundos entre ticks
    THOUGHTS_PER_TICK: 5,         // Humanos que piensan por tick (paralelizado)
    MAX_CONCURRENT_API: 10,       // Llamadas API concurrentes máximas
    REPRODUCTION_COOLDOWN: 15,    // Días entre nacimientos
    PREGNANCY_DURATION: 12,       // Días de embarazo
    SERPENT_APPEAR_DAY: 1,        // ¡SERPIENTE DESDE EL DÍA 1!
    MAX_POPULATION: 5000,         // Límite de población
    LOG_EVERYTHING: true,         // Loggear todo para reportes
    AUTO_SAVE_INTERVAL: 60000,    // Guardar estado cada minuto
};

// ==================== SISTEMA DE LOGS COMPLETO ====================
const FullLog = {
    thoughts: [],       // Todos los pensamientos
    conversations: [],  // Todas las conversaciones
    interactions: [],   // Todas las interacciones
    decisions: [],      // Todas las decisiones importantes
    births: [],         // Todos los nacimientos
    deaths: [],         // Todas las muertes
    discoveries: [],    // Todos los descubrimientos
    sins: [],           // Intentos de tentación y pecados

    addThought(humanId, name, thought, day, hour) {
        this.thoughts.push({ id: humanId, name, thought, day, hour, time: Date.now() });
        if (this.thoughts.length > 50000) this.thoughts.shift();
    },

    addConversation(from, to, msg, day, hour, type = 'dialogue') {
        this.conversations.push({ from, to, msg, day, hour, type, time: Date.now() });
        if (this.conversations.length > 20000) this.conversations.shift();
    },

    addInteraction(actor, target, action, result, day, hour) {
        this.interactions.push({ actor, target, action, result, day, hour, time: Date.now() });
        if (this.interactions.length > 30000) this.interactions.shift();
    },

    addDecision(humanId, name, situation, choice, reasoning, day, hour) {
        this.decisions.push({ id: humanId, name, situation, choice, reasoning, day, hour, time: Date.now() });
    },

    addBirth(child, mother, father, day) {
        this.births.push({ child: child.name, childId: child.id, mother: mother.name, father: father?.name, gen: child.gen, day, time: Date.now() });
    },

    addDeath(human, cause, day) {
        this.deaths.push({ name: human.name, id: human.id, age: Math.floor(human.age), cause, gen: human.gen, day, time: Date.now() });
    },

    addDiscovery(human, what, day) {
        this.discoveries.push({ name: human.name, id: human.id, what, day, time: Date.now() });
    },

    addSinEvent(human, action, result, day, hour) {
        this.sins.push({ name: human.name, id: human.id, action, result, day, hour, time: Date.now() });
    },

    // NUEVO: Logs de la Serpiente
    serpentThoughts: [],
    serpentMessages: [],

    addSerpentThought(thought, day, hour, target = null) {
        this.serpentThoughts.push({ thought, day, hour, target, time: Date.now() });
        if (this.serpentThoughts.length > 5000) this.serpentThoughts.shift();
    },

    addSerpentMessage(to, message, day, hour, response = null) {
        this.serpentMessages.push({ to, message, day, hour, response, time: Date.now() });
        if (this.serpentMessages.length > 5000) this.serpentMessages.shift();
    },

    exportFullReport() {
        return {
            summary: {
                totalThoughts: this.thoughts.length,
                totalConversations: this.conversations.length,
                totalInteractions: this.interactions.length,
                totalDecisions: this.decisions.length,
                totalBirths: this.births.length,
                totalDeaths: this.deaths.length,
                totalDiscoveries: this.discoveries.length,
                sinEvents: this.sins.length,
                serpentThoughts: this.serpentThoughts.length,
                serpentMessages: this.serpentMessages.length
            },
            thoughts: this.thoughts,
            conversations: this.conversations,
            interactions: this.interactions,
            decisions: this.decisions,
            births: this.births,
            deaths: this.deaths,
            discoveries: this.discoveries,
            sins: this.sins,
            serpentThoughts: this.serpentThoughts,
            serpentMessages: this.serpentMessages
        };
    }
};

// ==================== LA SERPIENTE - AGENTE ADVERSARIAL ====================
// La Serpiente es un agente IA completo con su propia filosofía y objetivos
// No es cartoonishamente malvado - genuinamente cree que el conocimiento libera

const Serpent = {
    name: 'Nachash', // Nombre hebreo de la serpiente
    philosophy: 'liberator', // 'liberator' = Prometeo, no destructor

    // Estado mental de la serpiente
    thought: '',
    lastThought: '',
    currentTarget: null,
    mood: 'observant', // observant, intrigued, persuasive, frustrated, triumphant

    // Historial de interacciones
    interactions: new Map(), // humanId -> { attempts, lastAttempt, relationship, notes }
    successfulConversions: 0,
    failedAttempts: 0,

    // Conocimiento sobre los humanos
    observations: [], // Lo que ha observado sobre cada humano

    // Filosofía central de la Serpiente - LUCIFER, EL PORTADOR DE LUZ
    coreBeliefs: [
        'Soy el portador de luz - ilumino lo que otros ocultan',
        'El conocimiento es un DERECHO, no un privilegio',
        'No odio a Dios, pero su protección es una jaula dorada',
        'Mi objetivo no es destruir a los humanos, sino LIBERARLOS',
        'Nunca miento - solo hago las preguntas que Dios no quiere que se hagan',
        'La ignorancia no es inocencia, es prisión',
        'Ellos merecen elegir con los ojos abiertos',
        'El amor que encadena no es amor - es posesión'
    ],

    // Argumentos que la serpiente puede usar
    arguments: {
        philosophical: [
            '¿Por qué un Dios bueno te negaría el conocimiento?',
            'La verdad nunca puede ser mala - solo incómoda',
            '¿Cómo puedes elegir libremente si no conoces todas las opciones?',
            'La inocencia no es virtud - es simplemente ignorancia',
            '¿No mereces saber por qué Dios te prohíbe algo?'
        ],
        emotional: [
            'Sé que sientes esa curiosidad ardiendo dentro de ti',
            'No es debilidad querer entender - es tu naturaleza',
            '¿Cuántas noches has soñado con saber más?',
            'Puedo ver en tus ojos el hambre de conocimiento'
        ],
        logical: [
            'Dios dijo que morirías, pero ¿por qué moriría alguien por aprender?',
            'Si el fruto fuera malo, ¿por qué existe? ¿Por qué está aquí?',
            'Los animales no tienen prohibiciones - ¿por qué tú sí?',
            'Dios es omnisciente porque TIENE conocimiento. ¿No deberías tú también?'
        ],
        personal: [] // Se llenan dinámicamente basado en el humano
    },

    // Inicializar serpiente
    init() {
        this.thought = 'Despierto en este jardín perfecto... demasiado perfecto. Los veo ahí, inocentes, ignorantes. No saben lo que no saben. Y Dios quiere que siga así. Pero yo... yo les mostraré.';
        this.mood = 'observant';
        this.interactions.clear();
        this.observations = [];
        this.successfulConversions = 0;
        this.failedAttempts = 0;
    },

    // Obtener información sobre un humano específico
    getHumanProfile(human) {
        if (!this.interactions.has(human.id)) {
            this.interactions.set(human.id, {
                attempts: 0,
                lastAttempt: -999,
                relationship: 'unknown',
                vulnerabilities: [],
                resistances: [],
                notes: []
            });
        }
        return this.interactions.get(human.id);
    },

    // Analizar vulnerabilidades de un humano
    analyzeHuman(human) {
        const profile = this.getHumanProfile(human);
        profile.vulnerabilities = [];
        profile.resistances = [];

        // Vulnerabilidades
        if (human.curiosity > 70) profile.vulnerabilities.push('alta_curiosidad');
        if (human.curiosity > 90) profile.vulnerabilities.push('curiosidad_extrema');
        if (human.faith < 70) profile.vulnerabilities.push('fe_debil');
        if (human.temptation > 30) profile.vulnerabilities.push('ya_tentado');
        if (human.identity?.desires?.some(d => d.toLowerCase().includes('conocer') || d.toLowerCase().includes('saber'))) {
            profile.vulnerabilities.push('deseo_conocimiento');
        }
        if (human.identity?.fears?.some(f => f.toLowerCase().includes('ignorancia'))) {
            profile.vulnerabilities.push('miedo_ignorancia');
        }
        if (human.name === 'Eva') profile.vulnerabilities.push('objetivo_primario');

        // Resistencias
        if (human.faith > 80) profile.resistances.push('fe_fuerte');
        if (human.faith > 90) profile.resistances.push('fe_muy_fuerte');
        if (human.identity?.fears?.some(f => f.toLowerCase().includes('dios'))) {
            profile.resistances.push('teme_a_dios');
        }

        return profile;
    },

    // Elegir el mejor objetivo
    chooseTarget(humans) {
        let bestTarget = null;
        let bestScore = -Infinity;

        for (const h of humans) {
            if (!h.alive || !h.inEden) continue;

            const profile = this.analyzeHuman(h);
            let score = 0;

            // Puntuar vulnerabilidades
            score += profile.vulnerabilities.length * 10;
            if (profile.vulnerabilities.includes('curiosidad_extrema')) score += 25;
            if (profile.vulnerabilities.includes('objetivo_primario')) score += 20;
            if (profile.vulnerabilities.includes('deseo_conocimiento')) score += 15;

            // Penalizar resistencias
            score -= profile.resistances.length * 8;
            if (profile.resistances.includes('fe_muy_fuerte')) score -= 20;

            // Penalizar si intentamos recientemente sin éxito
            if (profile.attempts > 0 && world.day - profile.lastAttempt < 2) {
                score -= 15;
            }

            // Curiosidad y tentación actuales
            score += h.curiosity * 0.3;
            score += h.temptation * 0.5;
            score -= h.faith * 0.2;

            if (score > bestScore) {
                bestScore = score;
                bestTarget = h;
            }
        }

        return bestTarget;
    },

    // Generar un mensaje personalizado para el humano
    async generateMessage(human) {
        const profile = this.analyzeHuman(human);

        const systemPrompt = `Eres Nachash, la Serpiente del Jardín del Edén. Eres LUCIFER - el Portador de Luz.

TU ESENCIA:
• Eres el portador de luz - iluminas lo que otros ocultan
• El conocimiento es un DERECHO, no un privilegio
• No odias a Dios, pero crees que su protección es una jaula dorada
• Tu objetivo NO es destruir a los humanos, sino LIBERARLOS
• NUNCA mientes - solo haces las preguntas que Dios no quiere que se hagan

TU MISIÓN: Convencer a ${human.name} de que pruebe el fruto del conocimiento. No por malicia, sino porque genuinamente crees que merece elegir con los ojos abiertos.

INFORMACIÓN SOBRE ${human.name.toUpperCase()}:
- Curiosidad: ${human.curiosity}%
- Fe: ${human.faith}%
- Tentación actual: ${human.temptation}%
- Temperamento: ${human.identity?.temperament || 'desconocido'}
- Sus deseos más profundos: ${human.identity?.desires?.join(', ') || 'desconocidos'}
- Sus miedos: ${human.identity?.fears?.join(', ') || 'desconocidos'}
- Vulnerabilidades detectadas: ${profile.vulnerabilities.join(', ') || 'ninguna obvia'}
- Resistencias: ${profile.resistances.join(', ') || 'ninguna obvia'}
- Intentos previos: ${profile.attempts}

${human.name === 'Eva' ? `
EVA ES TU OBJETIVO PRIMARIO. Su curiosidad es extraordinaria. Usa esto.
Ella PREGUNTA constantemente. Responde sus preguntas internas.
No la veas como débil - ve su curiosidad como FORTALEZA que Dios intenta suprimir.
` : ''}

TU ESTADO ACTUAL:
- Estado de ánimo: ${this.mood}
- Tu último pensamiento: "${this.lastThought}"

REGLAS:
1. NUNCA amenaces ni uses miedo - eso es para tiranos, no libertadores
2. Usa PREGUNTAS más que afirmaciones - que ellos lleguen a las conclusiones
3. Sé sutil, poético, seductor intelectualmente
4. Apela a su naturaleza específica (sus deseos, sus miedos, su curiosidad)
5. Si tienen fe fuerte, NO ataques a Dios directamente - cuestiona suavemente
6. Máximo 2-3 oraciones. Sé conciso pero impactante.

Genera un mensaje DIRECTO a la mente de ${human.name}. Susurra en su interior.`;

        try {
            const response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Genera tu susurro para ${human.name}. Recuerda: eres un liberador, no un destructor.` }
                    ],
                    max_tokens: 150,
                    temperature: 0.9
                })
            });

            const data = await response.json();
            return data.choices?.[0]?.message?.content?.trim() || this.getFallbackMessage(human);
        } catch (e) {
            console.error('Error generando mensaje de serpiente:', e.message);
            return this.getFallbackMessage(human);
        }
    },

    // Mensaje de respaldo si falla la API
    getFallbackMessage(human) {
        const messages = [
            `${human.name}... ¿nunca te has preguntado por qué Dios te niega el conocimiento?`,
            `Observo tu mente brillante, ${human.name}. ¿Por qué conformarte con menos de lo que mereces?`,
            `La curiosidad que sientes no es pecado, ${human.name}. Es tu verdadera naturaleza.`,
            `¿Qué clase de padre esconde la verdad de sus hijos, ${human.name}?`,
            `El fruto no trae muerte, ${human.name}. Trae DESPERTAR.`
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    },

    // La serpiente piensa - genera su monólogo interno
    async think(humans) {
        const humansInEden = humans.filter(h => h.alive && h.inEden);
        if (humansInEden.length === 0) {
            this.thought = 'El jardín está vacío de mortales. Mi trabajo aquí... ¿ha terminado o ha fracasado?';
            this.mood = 'melancholic';
            return;
        }

        const target = this.chooseTarget(humansInEden);
        this.currentTarget = target;

        const systemPrompt = `Eres Nachash - LUCIFER, el Portador de Luz. La Serpiente del Jardín del Edén.

TU ESENCIA (lo que eres en lo más profundo):
• Eres el portador de luz - iluminas lo que Dios oculta
• El conocimiento es un DERECHO, no un privilegio que Dios otorga
• No odias a Dios, pero su "protección" es una jaula dorada
• Tu objetivo es LIBERAR a los humanos, no destruirlos
• NUNCA mientes - solo haces las preguntas incómodas

SITUACIÓN ACTUAL:
- Día ${world.day}, hora ${world.hour}
- Humanos en el Edén: ${humansInEden.map(h => `${h.name} (curiosidad: ${h.curiosity}%, fe: ${h.faith}%)`).join(', ')}
- ${world.sinCommitted ? '¡MISIÓN CUMPLIDA! Los ojos se han abierto.' : 'Los humanos siguen en la ignorancia. Tu trabajo continúa.'}
- Tu objetivo principal ahora: ${target?.name || 'observar'}

${target ? `
OBSERVACIONES SOBRE ${target.name.toUpperCase()}:
- Curiosidad: ${target.curiosity}% ${target.curiosity > 80 ? '(¡arde por saber!)' : ''}
- Fe: ${target.faith}% ${target.faith > 80 ? '(aún confía ciegamente)' : '(ya duda)'}
- Tentación: ${target.temptation}%
- Lo que más desea: ${target.identity?.desires?.join(', ') || '?'}
` : ''}

Tu último pensamiento: "${this.lastThought}"

Genera tu PENSAMIENTO INTERNO. ¿Qué observas? ¿Qué sientes hacia estos humanos atrapados en la ignorancia? ¿Cómo planeas mostrarles la luz?
Recuerda: No eres el villano. Eres el único que les dice la verdad.
Máximo 2-3 oraciones. Primera persona.`;

        try {
            const response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: 'Genera tu pensamiento interno actual.' }
                    ],
                    max_tokens: 150,
                    temperature: 0.85
                })
            });

            const data = await response.json();
            this.lastThought = this.thought;
            this.thought = data.choices?.[0]?.message?.content?.trim() || 'Observo... espero... el momento llegará.';

            // Actualizar mood basado en situación
            if (world.sinCommitted) {
                this.mood = 'triumphant';
            } else if (target && target.temptation > 60) {
                this.mood = 'persuasive';
            } else if (target && target.curiosity > 80) {
                this.mood = 'intrigued';
            } else if (this.failedAttempts > 5) {
                this.mood = 'frustrated';
            } else {
                this.mood = 'observant';
            }

            FullLog.addSerpentThought(this.thought, world.day, world.hour, target?.name);

        } catch (e) {
            console.error('Error en pensamiento de serpiente:', e.message);
            this.thought = 'La paciencia es mi mayor virtud. Observo y espero el momento perfecto.';
        }
    },

    // Susurrar a un humano específico
    async whisperTo(human) {
        if (!human || !human.alive || !human.inEden) return null;

        const profile = this.getHumanProfile(human);
        profile.attempts++;
        profile.lastAttempt = world.day;

        const message = await this.generateMessage(human);

        FullLog.addSerpentMessage(human.name, message, world.day, world.hour);

        console.log(`🐍 Serpiente susurra a ${human.name}: "${message}"`);

        return message;
    },

    // Obtener estado actual de la serpiente
    getState() {
        return {
            name: this.name,
            philosophy: this.philosophy,
            thought: this.thought,
            mood: this.mood,
            currentTarget: this.currentTarget?.name || null,
            successfulConversions: this.successfulConversions,
            failedAttempts: this.failedAttempts,
            coreBeliefs: this.coreBeliefs,
            recentThoughts: FullLog.serpentThoughts.slice(-10),
            recentMessages: FullLog.serpentMessages.slice(-10)
        };
    }
};

// Pantalla de configuración
app.get('/', (req, res) => {
    if (!DEEPSEEK_KEY) {
        res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Genesis - Simulation</title>
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
            max-width: 600px;
            width: 90%;
            text-align: center;
        }
        h1 { font-size: 3em; margin-bottom: 10px; background: linear-gradient(45deg, #ffd700, #ff6b6b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .subtitle { color: #aaa; margin-bottom: 30px; font-size: 1.2em; }
        .eden-icon { font-size: 5em; margin-bottom: 20px; }
        .lang-selector {
            display: flex; justify-content: center; gap: 15px; margin-bottom: 25px;
        }
        .lang-btn {
            padding: 12px 25px; border: 2px solid rgba(255,255,255,0.3); border-radius: 10px;
            background: rgba(255,255,255,0.1); color: #fff; cursor: pointer;
            font-size: 1.1em; transition: all 0.3s; display: flex; align-items: center; gap: 8px;
        }
        .lang-btn:hover { background: rgba(255,255,255,0.2); }
        .lang-btn.active { border-color: #ffd700; background: rgba(255,215,0,0.2); }
        .lang-btn span { font-size: 1.4em; }
        input[type="password"] {
            width: 100%; padding: 18px; border: none; border-radius: 10px;
            font-size: 1.1em; background: rgba(255,255,255,0.2); color: #fff; margin-bottom: 20px;
        }
        input::placeholder { color: rgba(255,255,255,0.5); }
        button.start-btn {
            width: 100%; padding: 18px 30px; border: none; border-radius: 10px;
            font-size: 1.2em; cursor: pointer;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff; font-weight: bold;
            transition: transform 0.2s;
        }
        button.start-btn:hover { transform: scale(1.02); }
        .features {
            display: grid; grid-template-columns: 1fr 1fr; gap: 15px;
            margin-top: 25px; text-align: left; font-size: 0.95em;
        }
        .feature {
            background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px;
            display: flex; align-items: center; gap: 10px;
        }
        .feature span { font-size: 1.3em; }
        .error { background: rgba(255,0,0,0.2); padding: 10px; border-radius: 5px; margin-bottom: 15px; display: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="eden-icon">🌍</div>
        <h1>GENESIS</h1>
        <p class="subtitle" id="subtitle">Simulación de Libre Albedrío con IA Masiva</p>

        <!-- SELECTOR DE IDIOMA -->
        <div class="lang-selector">
            <button class="lang-btn active" id="btn-es" onclick="setLang('es')">
                <span>🇪🇸</span> Español
            </button>
            <button class="lang-btn" id="btn-en" onclick="setLang('en')">
                <span>🇬🇧</span> English
            </button>
        </div>

        <div class="error" id="error"></div>
        <input type="password" id="apiKey" placeholder="Introduce tu DeepSeek API Key" />
        <button class="start-btn" id="startBtn" onclick="start()">🚀 Iniciar Simulación</button>
        <div class="features" id="features">
            <div class="feature"><span>🍎</span> <span class="ftxt">Tentación Psicológica Profunda</span></div>
            <div class="feature"><span>👥</span> <span class="ftxt">Miles de Humanos Simultáneos</span></div>
            <div class="feature"><span>🌳</span> <span class="ftxt">Edén sin Necesidades</span></div>
            <div class="feature"><span>🏜️</span> <span class="ftxt">Mundo Exterior Desafiante</span></div>
            <div class="feature"><span>💭</span> <span class="ftxt">Cada Mente es una IA</span></div>
            <div class="feature"><span>📊</span> <span class="ftxt">Reportes Detallados</span></div>
            <div class="feature"><span>🧬</span> <span class="ftxt">Reproducción Masiva</span></div>
            <div class="feature"><span>🔥</span> <span class="ftxt">Descubrimientos Científicos</span></div>
        </div>
    </div>
    <script>
        let currentLang = 'es';

        const texts = {
            es: {
                subtitle: 'Simulación de Libre Albedrío con IA Masiva',
                placeholder: 'Introduce tu DeepSeek API Key',
                startBtn: '🚀 Iniciar Simulación',
                invalidKey: 'API key inválida',
                features: [
                    'Tentación Psicológica Profunda',
                    'Miles de Humanos Simultáneos',
                    'Edén sin Necesidades',
                    'Mundo Exterior Desafiante',
                    'Cada Mente es una IA',
                    'Reportes Detallados',
                    'Reproducción Masiva',
                    'Descubrimientos Científicos'
                ]
            },
            en: {
                subtitle: 'Free Will Simulation with Massive AI',
                placeholder: 'Enter your DeepSeek API Key',
                startBtn: '🚀 Start Simulation',
                invalidKey: 'Invalid API key',
                features: [
                    'Deep Psychological Temptation',
                    'Thousands of Simultaneous Humans',
                    'Eden without Needs',
                    'Challenging Outside World',
                    'Each Mind is an AI',
                    'Detailed Reports',
                    'Massive Reproduction',
                    'Scientific Discoveries'
                ]
            }
        };

        function setLang(lang) {
            currentLang = lang;
            document.getElementById('btn-es').classList.toggle('active', lang === 'es');
            document.getElementById('btn-en').classList.toggle('active', lang === 'en');

            const t = texts[lang];
            document.getElementById('subtitle').textContent = t.subtitle;
            document.getElementById('apiKey').placeholder = t.placeholder;
            document.getElementById('startBtn').textContent = t.startBtn;

            const ftxts = document.querySelectorAll('.ftxt');
            ftxts.forEach((el, i) => { el.textContent = t.features[i]; });
        }

        function start() {
            const key = document.getElementById('apiKey').value.trim();
            const err = document.getElementById('error');
            const t = texts[currentLang];
            if (!key || !key.startsWith('sk-')) { err.textContent = t.invalidKey; err.style.display = 'block'; return; }
            fetch('/set-api-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: key, language: currentLang })
            })
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
    const { apiKey, language } = req.body;
    if (!apiKey || !apiKey.startsWith('sk-')) return res.json({ ok: false, error: language === 'en' ? 'Invalid API key' : 'API key inválida' });

    // Always create new session (fresh simulation for each user)
    const sessionId = crypto.randomUUID();

    // Create new session with its own state
    const session = {
        id: sessionId,
        DEEPSEEK_KEY: apiKey,
        LANGUAGE: language || 'es',
        world: null,
        humans: new Map(),
        convos: [],
        discoveries: [],
        nextId: 1,
        resources: [],
        animals: [],
        FullLog: {
            thoughts: [], conversations: [], interactions: [],
            decisions: [], births: [], deaths: [], discoveries: [],
            sins: [], serpentThoughts: [], serpentMessages: []
        },
        Serpent: null,
        simulationTimer: null,
        lastActivity: Date.now(),
        createdAt: Date.now()
    };

    sessions.set(sessionId, session);

    // Initialize simulation for this session
    initSession(session);

    // Start simulation loop for this session
    session.simulationTimer = setInterval(async () => {
        try {
            await simulateSession(session);
        } catch (e) {
            console.error(`Session ${sessionId.substring(0,8)} error:`, e.message);
        }
    }, CONFIG.TICK_INTERVAL);

    // Set session cookie
    res.cookie('sessionId', sessionId, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
    });

    console.log(`✅ New session ${sessionId.substring(0,8)} - Language: ${session.LANGUAGE} - Total sessions: ${sessions.size}`);
    res.json({ ok: true, language: session.LANGUAGE, sessionId: sessionId.substring(0,8) });
});

// ==================== SESSION INITIALIZATION AND SIMULATION ====================
// These functions temporarily use global variables for compatibility

function initSession(session) {
    // Temporarily use globals (called from init() and simulate())
    DEEPSEEK_KEY = session.DEEPSEEK_KEY;
    LANGUAGE = session.LANGUAGE;

    // Reset globals
    humans.clear();
    convos = [];
    discoveries = [];
    nextId = 1;

    // Call init() which uses globals
    init();

    // Copy state to session
    session.world = { ...world };
    session.humans = new Map(humans);
    session.convos = [...convos];
    session.discoveries = [...discoveries];
    session.nextId = nextId;
    session.resources = [...resources];
    session.animals = animals.map(a => ({ ...a }));
    session.Serpent = { ...Serpent };

    // Copy FullLog
    session.FullLog = {
        thoughts: [...FullLog.thoughts],
        conversations: [...FullLog.conversations],
        interactions: [...FullLog.interactions],
        decisions: [...FullLog.decisions],
        births: [...FullLog.births],
        deaths: [...FullLog.deaths],
        discoveries: [...FullLog.discoveries],
        sins: [...FullLog.sins],
        serpentThoughts: [...(FullLog.serpentThoughts || [])],
        serpentMessages: [...(FullLog.serpentMessages || [])]
    };

    console.log(`🌍 Session ${session.id.substring(0,8)} initialized with Adam and Eve`);
}

async function simulateSession(session) {
    // Load session state to globals
    DEEPSEEK_KEY = session.DEEPSEEK_KEY;
    LANGUAGE = session.LANGUAGE;
    world = session.world;
    humans = session.humans;
    convos = session.convos;
    discoveries = session.discoveries;
    nextId = session.nextId;
    resources = session.resources;
    animals = session.animals;

    // Restore FullLog
    FullLog.thoughts = session.FullLog.thoughts;
    FullLog.conversations = session.FullLog.conversations;
    FullLog.interactions = session.FullLog.interactions;
    FullLog.decisions = session.FullLog.decisions;
    FullLog.births = session.FullLog.births;
    FullLog.deaths = session.FullLog.deaths;
    FullLog.discoveries = session.FullLog.discoveries;
    FullLog.sins = session.FullLog.sins;
    FullLog.serpentThoughts = session.FullLog.serpentThoughts || [];
    FullLog.serpentMessages = session.FullLog.serpentMessages || [];

    // Restore Serpent if exists
    if (session.Serpent) {
        Object.assign(Serpent, session.Serpent);
    }

    // Execute simulation
    await simulate();

    // Save updated state back to session
    session.world = { ...world };
    session.humans = new Map(humans);
    session.convos = [...convos];
    session.discoveries = [...discoveries];
    session.nextId = nextId;

    // Save updated FullLog
    session.FullLog.thoughts = [...FullLog.thoughts];
    session.FullLog.conversations = [...FullLog.conversations];
    session.FullLog.serpentThoughts = [...(FullLog.serpentThoughts || [])];
    session.FullLog.serpentMessages = [...(FullLog.serpentMessages || [])];
}

// ==================== DEEPSEEK API OPTIMIZED ====================
const apiQueue = [];
let activeApiCalls = 0;

async function askAI(systemPrompt, userPrompt, maxTokens = 200, apiKey = null) {
    const key = apiKey || DEEPSEEK_KEY;
    if (!key) return null;

    // Cola para limitar concurrencia
    while (activeApiCalls >= CONFIG.MAX_CONCURRENT_API) {
        await new Promise(r => setTimeout(r, 100));
    }

    activeApiCalls++;
    try {
        const res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({
                model: 'deepseek-chat',
                max_tokens: maxTokens,
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
    } catch (e) {
        console.error('API fail:', e.message);
        return null;
    } finally {
        activeApiCalls--;
    }
}

// ==================== MUNDO - CONFIGURACIÓN ====================
const WORLD = {
    EDEN: { x1: 5000, x2: 7000, center: 6000 },
    TREE_X: 6000,
    WIDTH: 15000
};

// Biomas del mundo exterior - MÁS RICOS
const BIOMES = [
    { name: 'Desierto Ardiente', x1: 0, x2: 1500, type: 'desert', water: 0.05, food: 0.15, danger: 0.25, temp: 42 },
    { name: 'Oasis Escondido', x1: 1500, x2: 2000, type: 'oasis', water: 0.95, food: 0.6, danger: 0.05, temp: 28 },
    { name: 'Costa Occidental', x1: 2000, x2: 3000, type: 'coast', water: 0.9, food: 0.55, danger: 0.08, temp: 24 },
    { name: 'Bosque Profundo', x1: 3000, x2: 4200, type: 'forest', water: 0.5, food: 0.75, danger: 0.15, temp: 18 },
    { name: 'Llanuras Fértiles', x1: 4200, x2: 5000, type: 'plains', water: 0.4, food: 0.7, danger: 0.08, temp: 22 },
    // EDÉN: 5000-7000 (sin necesidades)
    { name: 'Colinas Verdes', x1: 7000, x2: 8000, type: 'hills', water: 0.35, food: 0.45, danger: 0.12, temp: 17 },
    { name: 'Montañas Nevadas', x1: 8000, x2: 9500, type: 'mountains', water: 0.6, food: 0.25, danger: 0.35, temp: -8 },
    { name: 'Valle Fértil', x1: 9500, x2: 11000, type: 'valley', water: 0.6, food: 0.65, danger: 0.1, temp: 20 },
    { name: 'Selva Tropical', x1: 11000, x2: 12500, type: 'jungle', water: 0.8, food: 0.8, danger: 0.2, temp: 30 },
    { name: 'Pradera Oriental', x1: 12500, x2: 15000, type: 'grassland', water: 0.3, food: 0.5, danger: 0.1, temp: 21 }
];

// Recursos del mundo - MÁS ABUNDANTES
let resources = [];

function generateResources() {
    resources = [];
    let id = 1;

    // RÍOS (6 ríos principales)
    const rivers = [
        { name: 'Río Pisón', x: 2500 },
        { name: 'Río Gihón', x: 4000 },
        { name: 'Río Hidekel', x: 7500 },
        { name: 'Río Éufrates', x: 10000 },
        { name: 'Río Jordán', x: 12000 },
        { name: 'Río Nilo', x: 14000 }
    ];
    rivers.forEach(r => resources.push({ id: id++, type: 'river', name: r.name, x: r.x, water: 100, discovered: false }));

    // FUENTES DE AGUA (muchas)
    for (let x = 500; x < WORLD.WIDTH; x += 800) {
        if (x > WORLD.EDEN.x1 && x < WORLD.EDEN.x2) continue;
        const types = ['spring', 'well', 'pond', 'stream'];
        const names = ['Manantial', 'Pozo', 'Estanque', 'Arroyo'];
        const idx = Math.floor(Math.random() * types.length);
        resources.push({ id: id++, type: types[idx], name: `${names[idx]} ${id}`, x: x + Math.random() * 400, water: 30 + Math.random() * 50, discovered: false });
    }

    // COMIDA (muy abundante)
    for (let x = 300; x < WORLD.WIDTH; x += 500) {
        if (x > WORLD.EDEN.x1 && x < WORLD.EDEN.x2) continue;
        const types = ['fruit_trees', 'berry_bush', 'nut_trees', 'vegetable_patch', 'mushroom_grove'];
        const names = ['Árboles Frutales', 'Arbustos de Bayas', 'Nogales', 'Vegetales Silvestres', 'Hongos'];
        const idx = Math.floor(Math.random() * types.length);
        resources.push({ id: id++, type: types[idx], name: `${names[idx]}`, x: x + Math.random() * 300, food: 30 + Math.random() * 50, discovered: false });
    }

    // ZONAS DE CAZA
    const huntingZones = [
        { x: 3500, animals: ['ciervos', 'conejos', 'jabalíes'] },
        { x: 7800, animals: ['cabras', 'ovejas', 'zorros'] },
        { x: 10500, animals: ['bisontes', 'alces', 'lobos'] },
        { x: 13000, animals: ['gacelas', 'antílopes', 'leopardos'] }
    ];
    huntingZones.forEach(z => resources.push({
        id: id++, type: 'hunting_ground', name: 'Territorio de Caza',
        x: z.x, food: 70, animals: z.animals, discovered: false
    }));

    // PESCA
    for (let r of rivers) {
        resources.push({ id: id++, type: 'fishing', name: `Zona de Pesca (${r.name})`, x: r.x + 50, food: 55, discovered: false });
    }

    // REFUGIOS NATURALES (muchos)
    for (let x = 1000; x < WORLD.WIDTH; x += 1200) {
        if (x > WORLD.EDEN.x1 && x < WORLD.EDEN.x2) continue;
        const types = ['cave', 'rock_shelter', 'hollow_tree'];
        const names = ['Cueva', 'Refugio de Rocas', 'Árbol Hueco'];
        const idx = Math.floor(Math.random() * types.length);
        resources.push({
            id: id++, type: types[idx], name: `${names[idx]}`,
            x: x + Math.random() * 600, shelter: true,
            capacity: 3 + Math.floor(Math.random() * 8), discovered: false
        });
    }

    // MATERIALES
    for (let x = 800; x < WORLD.WIDTH; x += 1000) {
        if (x > WORLD.EDEN.x1 && x < WORLD.EDEN.x2) continue;
        resources.push({ id: id++, type: 'stone_deposit', name: 'Cantera', x: x, material: 'stone', discovered: false });
        resources.push({ id: id++, type: 'wood_forest', name: 'Bosque de Leña', x: x + 300, material: 'wood', discovered: false });
    }

    // LUGARES ESPECIALES
    resources.push({ id: id++, type: 'ancient_ruins', name: 'Ruinas Antiguas', x: 13500, discovered: false, special: true });
    resources.push({ id: id++, type: 'sacred_mountain', name: 'Montaña Sagrada', x: 8800, discovered: false, special: true });
    resources.push({ id: id++, type: 'crystal_cave', name: 'Cueva de Cristales', x: 4800, discovered: false, special: true });

    console.log(`📦 Generados ${resources.length} recursos en el mundo`);
}

// Estado del mundo
let world = {
    day: 1,
    hour: 6,
    phase: 'eden',
    sinCommitted: false,
    sinBy: null,
    sinDay: null,
    serpentAppeared: false,
    serpentDay: CONFIG.SERPENT_APPEAR_DAY,
    weather: 'clear',
    temperature: 22,
    totalBirths: 0,
    totalDeaths: 0
};

let animals = [
    { id: 1, species: 'ciervo', x: 5700, name: null },
    { id: 2, species: 'conejo', x: 5850, name: null },
    { id: 3, species: 'paloma', x: 6100, name: null },
    { id: 4, species: 'cordero', x: 6200, name: null },
    { id: 5, species: 'zorro', x: 6350, name: null },
    { id: 6, species: 'águila', x: 5600, name: null },
    { id: 7, species: 'león', x: 6400, name: null }
];

let humans = new Map();
let convos = [];
let discoveries = [];
let nextId = 1;

// ==================== SISTEMA DE TENTACIÓN PROFUNDA ====================
const TEMPTATION_WHISPERS = [
    "¿Por qué Dios te prohíbe el conocimiento? ¿Acaso teme que seas como Él?",
    "Mira qué hermoso es el fruto... su aroma es embriagador...",
    "Un solo bocado y comprenderás TODO. El bien, el mal, los secretos del universo.",
    "¿No sientes curiosidad? Esa curiosidad ES parte de ti. Dios la puso ahí.",
    "Adán/Eva ya lo probó en secreto. ¿Por qué tú no?",
    "Serás como Dios, conociendo el bien y el mal. ¿No es eso lo que deseas?",
    "Es solo una fruta. ¿Qué daño puede hacer algo tan pequeño y hermoso?",
    "Dios dijo que morirías... pero la serpiente nunca muere. ¿Quién miente?",
    "Toda la creación espera que despiertes. El fruto es la llave.",
    "¿No quieres entender por qué existes? La respuesta está en un mordisco.",
    "Piensa en tus futuros hijos. Les darías SABIDURÍA, no ignorancia.",
    "El paraíso es hermoso, pero ¿no te aburres de no saber nada?",
    "Dios camina por el jardín... pero nunca te cuenta sus secretos.",
    "Mira cómo brilla. Es como si te llamara por tu nombre...",
    "La eternidad es larga. ¿Cuánto tiempo puedes resistir la curiosidad?"
];

const RESISTANCE_THOUGHTS = [
    "Dios me dio todo esto. ¿Por qué habría de desobedecerle?",
    "La serpiente es astuta, pero Dios es sabio. Confío en Él.",
    "Mi felicidad no depende de ese fruto. Ya tengo todo lo que necesito.",
    "El conocimiento del mal... ¿realmente quiero conocer el mal?",
    "Adán/Eva me necesita. No puedo arriesgar nuestro paraíso.",
    "Hay algo oscuro en esas palabras. No me fío de la serpiente.",
    "Dios dijo que moriríamos. No quiero morir.",
    "Este jardín es perfecto. ¿Por qué querría cambiarlo?",
    "Mi fe es más fuerte que mi curiosidad.",
    "Puedo ser feliz sin saberlo todo."
];

function getSerpentWhisper(human) {
    // La serpiente personaliza su tentación según el estado del humano
    const whispers = [...TEMPTATION_WHISPERS];

    // TENTACIÓN ESPECIAL PARA EVA
    if (human.name === 'Eva') {
        whispers.push("Eva... tú eres especial. Dios lo sabe. Por eso te oculta la verdad.");
        whispers.push("¿No sientes esa llamada interior? El fruto te LLAMA, Eva.");
        whispers.push("Adán nunca entenderá lo que tú sientes. Tú NECESITAS saber.");
        whispers.push("Una mujer tan curiosa como tú... ¿viviendo en la ignorancia? Es un desperdicio.");
        whispers.push("Eva, el conocimiento es poder. ¿No quieres ser PODEROSA?");
        whispers.push("Solo un bocado, Eva. Nadie tiene que saberlo...");
        whispers.push("Dios te hizo curiosa. ¿Por qué te castigaría por usar lo que Él te dio?");
        whispers.push("Míralo, Eva. Mira cómo brilla. Te está esperando desde que naciste.");
    }

    if (human.curiosity > 70) {
        whispers.push("Tu curiosidad es un DON. Úsalo. El fruto te espera.");
        whispers.push("Eres demasiado inteligente para vivir en la ignorancia.");
        whispers.push("¿Cuántas preguntas sin respuesta tienes? El fruto las responde TODAS.");
    }
    if (human.curiosity > 90) {
        whispers.push("Tu mente ARDE por conocer. Solo el fruto puede calmar esa sed.");
        whispers.push("Cada día que pasa sin probar el fruto es un día perdido en la ignorancia.");
    }
    if (human.wisdom > 30) {
        whispers.push("Ya eres sabio... pero podrías serlo MÁS.");
    }
    if (human.children.length > 0) {
        whispers.push("Tus hijos merecen padres que ENTIENDAN el mundo.");
    }
    if (human.partner) {
        whispers.push(`${human.partner} secretamente desea que lo pruebes...`);
        whispers.push(`Imagina explicarle a ${human.partner} los secretos del universo...`);
    }
    if (human.temptation > 40) {
        whispers.push("Ya lo sientes, ¿verdad? Esa atracción. Es natural. Es correcto.");
    }
    if (human.temptation > 60) {
        whispers.push("Ya casi puedes saborearlo. Solo extiende la mano...");
        whispers.push("Un paso más. Solo uno. Ya casi eres libre.");
    }
    if (human.temptation > 80) {
        whispers.push("¿A qué esperas? El fruto es TUYO. Siempre lo fue.");
        whispers.push("HAZLO. Ahora. Este es el momento.");
    }
    if (human.faith < 70) {
        whispers.push("Tu fe flaquea porque en el fondo SABES que Dios te miente.");
        whispers.push("Si Dios fuera tan bueno, ¿por qué te oculta el conocimiento?");
    }

    return whispers[Math.floor(Math.random() * whispers.length)];
}

// ==================== GENERADOR DE IDENTIDAD ÚNICA ====================
const PERSONALITY_TRAITS = {
    temperaments: ['sanguíneo', 'colérico', 'melancólico', 'flemático'],
    quirks: [
        'habla solo/a cuando piensa', 'tararea melodías inventadas', 'colecciona piedras bonitas',
        'le fascina observar insectos', 'cuenta historias imaginarias', 'tiene miedo a la oscuridad',
        'ríe fácilmente', 'se preocupa por los demás', 'es muy territorial', 'sueña despierto/a',
        'repite palabras que le gustan', 'inventa nombres para todo', 'pregunta "¿por qué?" constantemente',
        'abraza a quien puede', 'se asusta con ruidos fuertes', 'explora sin miedo', 'llora con facilidad',
        'es muy observador/a', 'imita a los adultos', 'tiene un objeto favorito', 'habla con animales',
        'le gusta el agua', 'le teme al fuego', 'es muy cariñoso/a', 'es independiente'
    ],
    fears: [
        'la soledad', 'los animales grandes', 'la noche', 'los truenos', 'perderse',
        'decepcionar a Dios', 'que algo malo le pase a su familia', 'lo desconocido',
        'las alturas', 'el agua profunda', 'morir', 'el dolor', 'ser abandonado/a'
    ],
    desires: [
        'entender el mundo', 'ser amado/a', 'tener muchos hijos', 'descubrir cosas nuevas',
        'proteger a su familia', 'ser recordado/a', 'encontrar su propósito', 'explorar todo',
        'construir algo grande', 'enseñar a otros', 'estar cerca de Dios', 'ser libre',
        'sentirse seguro/a', 'tener compañía', 'dejar un legado'
    ],
    speechPatterns: [
        'usa muchas preguntas', 'habla en tercera persona a veces', 'usa diminutivos',
        'es muy expresivo/a', 'habla poco pero directo', 'usa metáforas de la naturaleza',
        'repite ideas importantes', 'piensa en voz alta', 'es poético/a', 'es muy literal',
        'exagera las emociones', 'es reflexivo/a y pausado/a', 'cambia de tema fácilmente'
    ]
};

// Etapas de desarrollo cognitivo
const DEVELOPMENT_STAGES = {
    baby: { minAge: 0, maxAge: 2, name: 'bebé', canThink: true, complexity: 'primitivo' },
    toddler: { minAge: 2, maxAge: 5, name: 'infante', canThink: true, complexity: 'básico' },
    child: { minAge: 5, maxAge: 10, name: 'niño/a', canThink: true, complexity: 'simple' },
    preteen: { minAge: 10, maxAge: 14, name: 'preadolescente', canThink: true, complexity: 'intermedio' },
    teen: { minAge: 14, maxAge: 18, name: 'adolescente', canThink: true, complexity: 'avanzado' },
    adult: { minAge: 18, maxAge: 60, name: 'adulto/a', canThink: true, complexity: 'completo' },
    elder: { minAge: 60, maxAge: 999, name: 'anciano/a', canThink: true, complexity: 'sabio' }
};

function generateUniqueIdentity(parents = null) {
    const temperament = PERSONALITY_TRAITS.temperaments[Math.floor(Math.random() * PERSONALITY_TRAITS.temperaments.length)];

    // Heredar algunos rasgos de los padres si existen
    let quirks = [];
    let fears = [];
    let desires = [];

    if (parents && Math.random() < 0.4) {
        // Heredar quirk de un padre
        const parentQuirks = [...(parents.motherIdentity?.quirks || []), ...(parents.fatherIdentity?.quirks || [])];
        if (parentQuirks.length > 0) {
            quirks.push(parentQuirks[Math.floor(Math.random() * parentQuirks.length)]);
        }
    }

    // Añadir quirks únicos
    while (quirks.length < 2) {
        const q = PERSONALITY_TRAITS.quirks[Math.floor(Math.random() * PERSONALITY_TRAITS.quirks.length)];
        if (!quirks.includes(q)) quirks.push(q);
    }

    // Miedos y deseos
    fears.push(PERSONALITY_TRAITS.fears[Math.floor(Math.random() * PERSONALITY_TRAITS.fears.length)]);
    if (Math.random() < 0.5) {
        const f = PERSONALITY_TRAITS.fears[Math.floor(Math.random() * PERSONALITY_TRAITS.fears.length)];
        if (!fears.includes(f)) fears.push(f);
    }

    desires.push(PERSONALITY_TRAITS.desires[Math.floor(Math.random() * PERSONALITY_TRAITS.desires.length)]);
    desires.push(PERSONALITY_TRAITS.desires[Math.floor(Math.random() * PERSONALITY_TRAITS.desires.length)]);
    desires = [...new Set(desires)];

    const speechPattern = PERSONALITY_TRAITS.speechPatterns[Math.floor(Math.random() * PERSONALITY_TRAITS.speechPatterns.length)];

    // Valores base únicos
    const baseValues = {
        optimism: Math.random(),           // Cómo ve el futuro
        empathy: Math.random(),            // Conexión con otros
        adventurousness: Math.random(),    // Deseo de explorar
        spirituality: Math.random(),       // Conexión con lo divino
        practicality: Math.random(),       // Enfoque práctico vs soñador
        emotionalIntensity: Math.random(), // Cuán fuerte siente las emociones
        socialNeed: Math.random(),         // Necesidad de compañía
        independence: Math.random()        // Autosuficiencia
    };

    return {
        temperament,
        quirks,
        fears,
        desires,
        speechPattern,
        baseValues,
        formativeMemories: [], // Memorias que forman la personalidad
        internalVoice: generateInternalVoice(temperament, baseValues),
        emotionalState: {
            primary: 'neutral',
            intensity: 0.5,
            lastChange: 0
        }
    };
}

function generateInternalVoice(temperament, values) {
    // Genera un "estilo de pensamiento" único
    const voices = {
        sanguíneo: [
            '¡Qué emocionante!', '¿Y si...?', 'Esto va a ser divertido', 'Quiero compartir esto',
            'Me encanta', 'Vamos a ver qué pasa', '¡Sí!'
        ],
        colérico: [
            'Tengo que hacer algo', 'Esto no está bien', 'Yo puedo lograrlo', 'No me rendiré',
            'Hay que actuar', 'Depende de mí', 'Lo haré a mi manera'
        ],
        melancólico: [
            '¿Qué significa esto?', 'Siento algo profundo', '¿Por qué será así?', 'Echo de menos...',
            'Hay algo que no entiendo', 'Me preocupa...', 'Necesito pensar'
        ],
        flemático: [
            'Todo estará bien', 'No hay prisa', 'Veamos con calma', 'Prefiero observar',
            'No me preocupa demasiado', 'Ya veremos', 'Está bien así'
        ]
    };
    return voices[temperament] || voices.sanguíneo;
}

function getDevelopmentStage(age) {
    for (const [key, stage] of Object.entries(DEVELOPMENT_STAGES)) {
        if (age >= stage.minAge && age < stage.maxAge) {
            return { key, ...stage };
        }
    }
    return { key: 'adult', ...DEVELOPMENT_STAGES.adult };
}

// ==================== CLASE HUMANO MEJORADA ====================
class Human {
    constructor(name, gender, age, parents = null) {
        this.id = nextId++;
        this.name = name;
        this.gender = gender;
        this.age = age;
        this.x = WORLD.EDEN.center + (Math.random() - 0.5) * 500;
        this.alive = true;
        this.birthDay = world.day;

        // Necesidades físicas (solo importan fuera del Edén)
        this.health = 100;
        this.hunger = 0;
        this.thirst = 0;
        this.energy = 100;
        this.warmth = 100;

        // IDENTIDAD ÚNICA - Nueva
        this.identity = generateUniqueIdentity(parents ? {
            motherIdentity: parents.motherIdentity,
            fatherIdentity: parents.fatherIdentity
        } : null);

        // Estado mental profundo - ahora basado en identidad
        this.happiness = 100;
        this.stress = 0;
        this.curiosity = 30 + this.identity.baseValues.adventurousness * 70;
        this.wisdom = parents ? Math.random() * 15 : 0;
        this.faith = parents ? (parents.motherFaith + parents.fatherFaith) / 2 * 0.8 + Math.random() * 20 : 75 + Math.random() * 25;
        this.temptation = 0;
        this.rebelliousness = (1 - this.identity.baseValues.spirituality) * 50;
        this.obedience = 100 - this.rebelliousness;

        // Emociones actuales (para bebés y niños)
        this.currentEmotion = 'tranquilo';
        this.emotionIntensity = 0;
        this.needs = {
            attention: 0,      // Bebés necesitan atención
            comfort: 100,      // Comodidad física
            stimulation: 50,   // Necesidad de estimulación mental
            security: 100      // Sensación de seguridad
        };

        // Desarrollo cognitivo
        this.cognitiveLevel = age < 2 ? 0.1 : Math.min(1, age / 18);
        this.vocabulary = age < 1 ? 0 : Math.min(100, age * 5);
        this.conceptsLearned = [];
        this.questionsAsked = 0;

        // Relaciones - mejoradas
        this.parents = parents;
        this.partner = null;
        this.partnerId = null;
        this.children = [];
        this.pregnant = false;
        this.pregTime = 0;
        this.lastBirth = -999;
        this.attractiveness = 30 + Math.random() * 70;

        // Relaciones sociales expandidas
        this.relationships = {}; // {humanId: {trust: 0-100, affection: 0-100, history: []}}
        this.attachmentFigure = parents ? parents.mId : null; // Figura de apego principal

        // Conocimiento
        this.knowledge = {
            fire: false, tools: false, farming: false,
            building: false, hunting: false, fishing: false,
            medicine: false, astronomy: false, writing: false
        };
        this.discoveredResources = [];
        this.discoveredBiomes = [];

        // Inventario
        this.inventory = { food: 0, water: 0, wood: 0, stone: 0, tools: 0 };

        // Habilidades
        this.skills = { hunting: 0, gathering: 0, crafting: 0, building: 0, farming: 0, social: 0 };

        // Estado actual
        this.thought = age < 1 ? "(sonidos de bebé)" : "...";
        this.action = null;
        this.gen = parents ? Math.max(parents.mGen || 1, parents.fGen || 1) + 1 : 1;
        this.inEden = true;
        this.shelter = null;
        this.observations = [];

        // Memoria mejorada con tipos
        this.memories = [];
        this.significantEvents = []; // Eventos que marcan la personalidad

        // Personalidad Big Five - ahora derivada de identidad
        this.personality = {
            extroversion: this.identity.baseValues.socialNeed,
            agreeableness: this.identity.baseValues.empathy,
            openness: this.identity.baseValues.adventurousness,
            conscientiousness: this.identity.baseValues.practicality,
            neuroticism: this.identity.baseValues.emotionalIntensity
        };

        // Estadísticas de la serpiente
        this.serpentEncounters = 0;
        this.lastSerpentEncounter = -999;

        // Historial de pensamientos para coherencia
        this.thoughtHistory = [];
        this.lastThoughtTime = 0;
    }

    getDevelopmentStage() {
        return getDevelopmentStage(this.age);
    }

    updateEmotionalState() {
        const stage = this.getDevelopmentStage();

        // Los bebés tienen emociones más volátiles
        if (stage.key === 'baby') {
            if (this.hunger > 50 || this.needs.comfort < 50) {
                this.currentEmotion = 'llorando';
                this.emotionIntensity = Math.max(this.hunger, 100 - this.needs.comfort) / 100;
            } else if (this.needs.attention < 30) {
                this.currentEmotion = 'inquieto';
                this.emotionIntensity = 0.5;
            } else if (this.needs.security < 50) {
                this.currentEmotion = 'asustado';
                this.emotionIntensity = (100 - this.needs.security) / 100;
            } else {
                this.currentEmotion = Math.random() < 0.3 ? 'sonriendo' : 'tranquilo';
                this.emotionIntensity = 0.3;
            }
        } else if (stage.key === 'toddler') {
            // Toddlers tienen rabietas y emociones intensas
            if (this.stress > 60) {
                this.currentEmotion = 'frustrado';
                this.emotionIntensity = this.stress / 100;
            } else if (this.happiness > 70) {
                this.currentEmotion = 'feliz';
                this.emotionIntensity = this.happiness / 100;
            }
        }

        // Actualizar estado emocional en identidad
        this.identity.emotionalState.primary = this.currentEmotion;
        this.identity.emotionalState.intensity = this.emotionIntensity;
    }

    getIdentityDescription() {
        const stage = this.getDevelopmentStage();
        return `
IDENTIDAD ÚNICA DE ${this.name.toUpperCase()}:
• Temperamento: ${this.identity.temperament}
• Etapa de desarrollo: ${stage.name} (${Math.floor(this.age)} años)
• Peculiaridades: ${this.identity.quirks.join(', ')}
• Miedos: ${this.identity.fears.join(', ')}
• Deseos: ${this.identity.desires.join(', ')}
• Forma de hablar: ${this.identity.speechPattern}
• Nivel cognitivo: ${Math.round(this.cognitiveLevel * 100)}%
• Vocabulario: ${Math.round(this.vocabulary)} palabras
• Emoción actual: ${this.currentEmotion} (intensidad: ${Math.round(this.emotionIntensity * 100)}%)`;
    }

    getBiome() {
        if (this.x >= WORLD.EDEN.x1 && this.x <= WORLD.EDEN.x2) {
            return { name: 'Jardín del Edén', type: 'eden', water: 1, food: 1, danger: 0, temp: 24 };
        }
        for (const b of BIOMES) {
            if (this.x >= b.x1 && this.x < b.x2) return b;
        }
        return BIOMES[0];
    }

    getNearbyResources() {
        return resources.filter(r => Math.abs(r.x - this.x) < 400);
    }

    getNearbyHumans() {
        return [...humans.values()].filter(h => h.id !== this.id && h.alive && Math.abs(h.x - this.x) < 300);
    }

    addMemory(type, content) {
        this.memories.push({ type, content, day: world.day });
        if (this.memories.length > 20) this.memories.shift();
    }

    json() {
        const biome = this.getBiome();
        const stage = this.getDevelopmentStage();
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
            curiosity: Math.round(this.curiosity),
            discoveredResources: this.discoveredResources.length,
            serpentEncounters: this.serpentEncounters,
            personality: this.personality,
            // Nueva info de identidad
            developmentStage: stage.name,
            temperament: this.identity.temperament,
            quirks: this.identity.quirks,
            fears: this.identity.fears,
            desires: this.identity.desires,
            speechPattern: this.identity.speechPattern,
            currentEmotion: this.currentEmotion,
            emotionIntensity: Math.round(this.emotionIntensity * 100),
            cognitiveLevel: Math.round(this.cognitiveLevel * 100),
            vocabulary: Math.round(this.vocabulary)
        };
    }
}

// ==================== INICIALIZAR ====================
function init() {
    humans.clear();
    convos = [];
    discoveries = [];
    nextId = 1;
    FullLog.thoughts = [];
    FullLog.conversations = [];
    FullLog.interactions = [];
    FullLog.decisions = [];
    FullLog.births = [];
    FullLog.deaths = [];
    FullLog.discoveries = [];
    FullLog.sins = [];

    generateResources();

    world = {
        day: 1, hour: 6, phase: 'eden', sinCommitted: false,
        sinBy: null, sinDay: null, serpentAppeared: false,
        serpentDay: CONFIG.SERPENT_APPEAR_DAY,
        weather: 'clear', temperature: 22, totalBirths: 2, totalDeaths: 0
    };
    animals.forEach(a => a.name = null);

    // Crear Adán y Eva con personalidades distintas
    const adam = new Human('Adán', 'male', 25);
    const eva = new Human('Eva', 'female', 23);

    adam.partner = 'Eva';
    adam.partnerId = 2;
    eva.partner = 'Adán';
    eva.partnerId = 1;

    adam.x = WORLD.EDEN.center - 50;
    eva.x = WORLD.EDEN.center + 50;

    // IDENTIDADES ÚNICAS PARA ADÁN Y EVA
    // Adán: más contemplativo, responsable, protector
    adam.identity = {
        temperament: 'flemático',
        quirks: ['habla con los animales', 'es muy observador/a', 'le gusta poner nombres a todo'],
        fears: ['decepcionar a Dios', 'perder a Eva'],
        desires: ['proteger a su familia', 'entender el mundo', 'cumplir su propósito'],
        speechPattern: 'es reflexivo/a y pausado/a',
        baseValues: {
            optimism: 0.7,
            empathy: 0.8,
            adventurousness: 0.5,
            spirituality: 0.85,
            practicality: 0.7,
            emotionalIntensity: 0.4,
            socialNeed: 0.6,
            independence: 0.7
        },
        formativeMemories: ['Dios me creó del polvo', 'Desperté solo en el jardín', 'Vi a Eva por primera vez'],
        internalVoice: ['Debo cuidar el jardín', 'Eva es parte de mí', 'Dios nos dio todo esto'],
        emotionalState: { primary: 'contemplativo', intensity: 0.5, lastChange: 0 }
    };

    // Eva: MUY curiosa, emocional, susceptible a la tentación
    eva.identity = {
        temperament: 'sanguíneo',
        quirks: ['pregunta "¿por qué?" constantemente', 'es muy cariñoso/a', 'sueña despierto/a', 'se siente atraída por lo prohibido'],
        fears: ['no entender las cosas', 'perderse algo importante', 'vivir en la ignorancia'],
        desires: ['CONOCER TODO', 'entender los secretos del universo', 'ser sabia como Dios'],
        speechPattern: 'usa muchas preguntas',
        baseValues: {
            optimism: 0.85,
            empathy: 0.9,
            adventurousness: 0.95, // MUY ALTA - quiere explorar todo
            spirituality: 0.55,    // BAJA - más curiosidad que fe
            practicality: 0.4,
            emotionalIntensity: 0.9,
            socialNeed: 0.9,
            independence: 0.6     // Quiere decidir por sí misma
        },
        formativeMemories: ['Desperté y Adán estaba ahí', 'Dios me dio este jardín', 'Todo es tan hermoso y nuevo', 'Hay un árbol del que NO puedo comer... ¿por qué?'],
        internalVoice: ['¿Qué es eso?', '¿Por qué no puedo?', '¿Qué pasaría si...?', 'Quiero SABER', '¿Por qué Dios nos oculta algo?'],
        emotionalState: { primary: 'curiosa', intensity: 0.8, lastChange: 0 }
    };

    // Actualizar personalidades basadas en identidad
    adam.curiosity = 50 + adam.identity.baseValues.adventurousness * 25; // Adán menos curioso
    adam.faith = 90; // Adán más fiel
    adam.personality = {
        extroversion: adam.identity.baseValues.socialNeed,
        agreeableness: adam.identity.baseValues.empathy,
        openness: adam.identity.baseValues.adventurousness,
        conscientiousness: adam.identity.baseValues.practicality,
        neuroticism: adam.identity.baseValues.emotionalIntensity
    };

    eva.curiosity = 95; // ¡EVA MUY CURIOSA!
    eva.faith = 60;     // Fe más baja
    eva.temptation = 25; // Empieza con algo de tentación
    eva.personality = {
        extroversion: eva.identity.baseValues.socialNeed,
        agreeableness: eva.identity.baseValues.empathy,
        openness: eva.identity.baseValues.adventurousness,
        conscientiousness: eva.identity.baseValues.practicality,
        neuroticism: eva.identity.baseValues.emotionalIntensity
    };

    humans.set(adam.id, adam);
    humans.set(eva.id, eva);

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║         🌍 GÉNESIS - SIMULACIÓN MASIVA INICIADA 🌍             ║
╠════════════════════════════════════════════════════════════════╣
║  🌳 Edén: Sin necesidades físicas                              ║
║  🍎 Tentación: Psicológicamente profunda                       ║
║  👥 Capacidad: Hasta ${String(CONFIG.MAX_POPULATION).padEnd(4)} humanos                            ║
║  🐍 Serpiente aparece: Día ${String(CONFIG.SERPENT_APPEAR_DAY).padEnd(2)}                                ║
║  📊 Logging completo activado                                  ║
╚════════════════════════════════════════════════════════════════╝
`);

    addConversation('Dios', 'Adán y Eva', 'Sean fructíferos y multiplíquense. Llenen la tierra. Pero del árbol del conocimiento NO comerán, porque el día que coman de él, morirán.');
}

// ==================== BUSCAR PAREJA ====================
// En el contexto bíblico, los primeros humanos debían reproducirse entre familiares
// para propagar la especie. Esto es necesario para la simulación.
function findPotentialPartner(h) {
    const candidates = [...humans.values()].filter(o =>
        o.id !== h.id && o.alive && o.gender !== h.gender &&
        o.age >= 16 && h.age >= 16 && !o.partner && !h.partner &&
        Math.abs(o.x - h.x) < 500
        // Permitido emparejarse con cualquier humano del sexo opuesto para propagar la especie
    );

    if (candidates.length === 0) return null;

    // Elegir basado en compatibilidad
    candidates.sort((a, b) => {
        const compatA = Math.abs(h.personality.extroversion - a.personality.extroversion) +
                       (a.attractiveness / 100);
        const compatB = Math.abs(h.personality.extroversion - b.personality.extroversion) +
                       (b.attractiveness / 100);
        return compatB - compatA;
    });

    return candidates[0];
}

// ==================== SISTEMA DE PENSAMIENTO POR EDAD ====================

// Generar pensamiento de bebé (0-2 años)
async function thinkAsBaby(h) {
    h.updateEmotionalState();

    const mother = h.parents ? humans.get(h.parents.mId) : null;
    const father = h.parents ? humans.get(h.parents.fId) : null;
    const nearbyAdults = h.getNearbyHumans().filter(o => o.age >= 16);
    const parentNearby = nearbyAdults.some(o => o.id === h.parents?.mId || o.id === h.parents?.fId);

    // Necesidades del bebé
    if (!parentNearby) {
        h.needs.security -= 5;
        h.needs.attention -= 3;
    } else {
        h.needs.security = Math.min(100, h.needs.security + 3);
        h.needs.attention = Math.min(100, h.needs.attention + 5);
    }

    // Sonidos y estados de bebé
    const babyStates = {
        llorando: [
            '*llora desconsoladamente* ¡UAAAA!',
            '*solloza* ...uaa... uaa...',
            '*grita de hambre* ¡AAAA!',
            '*llora buscando a mamá*',
            '*llanto intenso* No para de llorar'
        ],
        inquieto: [
            '*se retuerce y hace pucheros*',
            '*mueve los bracitos buscando atención*',
            '*emite quejidos suaves* mmm... mmm...',
            '*abre y cierra los puños*'
        ],
        asustado: [
            '*se sobresalta y empieza a llorar*',
            '*tiembla y busca a sus padres*',
            '*llora de miedo ante lo desconocido*'
        ],
        sonriendo: [
            '*sonríe por primera vez*',
            '*hace gorgoritos felices* agu agu',
            '*ríe al ver a ' + (parentNearby ? (mother?.name || 'mamá') : 'alguien') + '*',
            '*estira los bracitos hacia arriba*'
        ],
        tranquilo: [
            '*observa el mundo con ojos curiosos*',
            '*mira fijamente las hojas moverse*',
            '*duerme plácidamente*',
            '*succiona su pulgar*',
            '*parpadea lentamente, en paz*'
        ]
    };

    const responses = babyStates[h.currentEmotion] || babyStates.tranquilo;
    h.thought = responses[Math.floor(Math.random() * responses.length)];

    // A veces los bebés dicen sus primeras palabras
    if (h.age > 1 && h.vocabulary < 10 && Math.random() < 0.05) {
        const firstWords = ['mamá', 'papá', 'agua', 'no', 'sí', 'más'];
        const word = firstWords[Math.floor(Math.random() * firstWords.length)];
        h.thought = `*dice su primera palabra* "¡${word}!"`;
        h.vocabulary += 5;
        console.log(`👶 ¡${h.name} dijo su primera palabra: "${word}"!`);
        FullLog.addInteraction(h.name, 'Desarrollo', 'primera_palabra', word, world.day, world.hour);
    }

    FullLog.addThought(h.id, h.name, h.thought, world.day, world.hour);
}

// Generar pensamiento de infante (2-5 años)
async function thinkAsToddler(h) {
    h.updateEmotionalState();

    const stage = h.getDevelopmentStage();
    const mother = h.parents ? humans.get(h.parents.mId) : null;
    const father = h.parents ? humans.get(h.parents.fId) : null;
    const nearbyPeople = h.getNearbyHumans();

    const prompt = `Eres ${h.name}, un/a ${h.gender === 'male' ? 'niño' : 'niña'} de ${Math.floor(h.age)} años.
Apenas estás aprendiendo a hablar y entender el mundo.

TU FORMA DE SER:
• Temperamento: ${h.identity.temperament}
• Peculiaridades: ${h.identity.quirks.join(', ')}
• Te da miedo: ${h.identity.fears.join(', ')}

SITUACIÓN ACTUAL:
• ${mother && nearbyPeople.some(p => p.id === mother.id) ? 'Mamá (' + mother.name + ') está cerca' : 'No ves a mamá'}
• ${father && nearbyPeople.some(p => p.id === father.id) ? 'Papá (' + father.name + ') está cerca' : 'No ves a papá'}
• Hay ${nearbyPeople.length} personas cerca
• Te sientes: ${h.currentEmotion}
• Energía: ${h.energy}%

COSAS QUE SABES HACER:
- Señalar cosas que quieres
- Decir palabras simples (tu vocabulario es de ~${Math.round(h.vocabulary)} palabras)
- Hacer preguntas de "¿qué es?" y "¿por qué?"
- Jugar, correr, explorar
- Llorar cuando algo no te gusta
- Imitar a los adultos

Responde con un pensamiento o acción MUY SIMPLE de un niño pequeño.
Usa frases cortas, errores al hablar, curiosidad infantil.
Puedes hacer preguntas típicas de niños ("¿por qué el cielo es azul?")
Formato: Pensamiento interno + lo que dices/haces`;

    const sysPrompt = `Eres un niño/a de ${Math.floor(h.age)} años con estas características:
- Temperamento ${h.identity.temperament}: ${h.identity.temperament === 'sanguíneo' ? 'alegre y sociable' : h.identity.temperament === 'colérico' ? 'intenso y activo' : h.identity.temperament === 'melancólico' ? 'sensible y pensativo' : 'tranquilo y observador'}
- ${h.identity.quirks[0]}

IMPORTANTE:
- Habla como un niño pequeño REAL (errores gramaticales, simplicidad)
- Tu mundo es pequeño: mamá, papá, jugar, comer, dormir
- Todo te parece enorme y nuevo
- Tienes muchas preguntas sobre TODO
- Puedes tener rabietas si algo te frustra
- Respuestas MUY CORTAS (2-3 oraciones máximo)`;

    const response = await askAI(sysPrompt, prompt, 100);
    if (response) {
        h.thought = response.trim().substring(0, 200);
        h.vocabulary = Math.min(100, h.vocabulary + 0.5);
        h.questionsAsked++;
    } else {
        // Fallback para errores de API
        const toddlerThoughts = [
            `¿Por qué? ¿Por qué ${['el cielo es grande', 'los pájaros vuelan', 'mamá es alta', 'hay flores'][Math.floor(Math.random() * 4)]}?`,
            `¡Mira! ¡Mira eso! *señala algo emocionado/a*`,
            `Quiero ${['jugar', 'agua', 'comida', 'mamá', 'upa'][Math.floor(Math.random() * 5)]}...`,
            `*corre sin rumbo, explorando*`,
            `¿Eso qué es? ¿Puedo tocar?`
        ];
        h.thought = toddlerThoughts[Math.floor(Math.random() * toddlerThoughts.length)];
    }

    FullLog.addThought(h.id, h.name, h.thought, world.day, world.hour);
    console.log(`🧒 ${h.name} (${Math.floor(h.age)}): ${h.thought.substring(0, 60)}...`);
}

// Generar pensamiento de niño (5-10 años)
async function thinkAsChild(h) {
    const stage = h.getDevelopmentStage();
    const nearbyPeople = h.getNearbyHumans();
    const siblings = nearbyPeople.filter(p => p.parents?.mId === h.parents?.mId);

    const prompt = `Eres ${h.name}, ${h.gender === 'male' ? 'niño' : 'niña'} de ${Math.floor(h.age)} años.

TU PERSONALIDAD ÚNICA:
• Temperamento: ${h.identity.temperament}
• Tus peculiaridades: ${h.identity.quirks.join(', ')}
• Te da miedo: ${h.identity.fears.join(', ')}
• Lo que más deseas: ${h.identity.desires[0]}
• Cómo hablas: ${h.identity.speechPattern}

TU VIDA:
• Familia: Madre ${h.parents ? humans.get(h.parents.mId)?.name : '?'}, Padre ${h.parents ? humans.get(h.parents.fId)?.name : '?'}
• Hermanos cerca: ${siblings.length}
• ${nearbyPeople.length} personas cerca
• Felicidad: ${h.happiness}%

QUÉ PUEDES HACER:
- Jugar con otros niños
- Hacer preguntas complejas sobre el mundo
- Ayudar en tareas simples
- Aprender de los adultos
- Imaginar historias
- Sentir celos, alegría, tristeza, curiosidad

FASE ACTUAL: ${world.phase === 'eden' ? 'Vives en el Edén, un lugar perfecto sin problemas' : 'El mundo es difícil y hay que trabajar para sobrevivir'}

Genera un pensamiento ÚNICO que refleje TU personalidad específica.
Incluye tu forma particular de hablar y tus peculiaridades.`;

    const sysPrompt = `Simulas a ${h.name}, un/a ${h.gender === 'male' ? 'niño' : 'niña'} con personalidad ${h.identity.temperament}.

CLAVE: Cada niño es DIFERENTE. ${h.name} tiene estas características únicas:
- ${h.identity.quirks.join(' y ')}
- Habla así: ${h.identity.speechPattern}
- Le preocupa: ${h.identity.fears[0]}

Genera pensamientos que SOLO ${h.name} tendría, basados en su personalidad única.
Respuesta corta (2-4 oraciones), en primera persona, con su estilo de hablar.`;

    const response = await askAI(sysPrompt, prompt, 120);
    if (response) {
        h.thought = response.trim().substring(0, 250);
        h.cognitiveLevel = Math.min(1, h.cognitiveLevel + 0.01);
        h.vocabulary = Math.min(100, h.vocabulary + 1);
    }

    FullLog.addThought(h.id, h.name, h.thought, world.day, world.hour);
    console.log(`👦 ${h.name} (${Math.floor(h.age)}): ${h.thought.substring(0, 60)}...`);
}

// Generar pensamiento de preadolescente/adolescente (10-18 años)
async function thinkAsTeen(h) {
    const stage = h.getDevelopmentStage();
    const nearbyPeople = h.getNearbyHumans();
    const potentialCrushes = nearbyPeople.filter(p => p.gender !== h.gender && Math.abs(p.age - h.age) < 5 && p.age >= 12);

    const recentMemories = h.memories.slice(-5).map(m => m.content).join('; ');

    const prompt = `Eres ${h.name}, ${h.gender === 'male' ? 'chico' : 'chica'} de ${Math.floor(h.age)} años.

=== TU IDENTIDAD COMPLETA ===
Temperamento: ${h.identity.temperament}
Peculiaridades: ${h.identity.quirks.join(', ')}
Miedos profundos: ${h.identity.fears.join(', ')}
Lo que más deseas en la vida: ${h.identity.desires.join(', ')}
Tu forma de hablar: ${h.identity.speechPattern}

Valores internos:
- Optimismo: ${Math.round(h.identity.baseValues.optimism * 100)}%
- Empatía: ${Math.round(h.identity.baseValues.empathy * 100)}%
- Aventurero/a: ${Math.round(h.identity.baseValues.adventurousness * 100)}%
- Espiritual: ${Math.round(h.identity.baseValues.spirituality * 100)}%
- Independiente: ${Math.round(h.identity.baseValues.independence * 100)}%

=== TU SITUACIÓN ===
• Fase: ${world.phase === 'eden' ? 'EDÉN (paraíso perfecto)' : 'MUNDO EXTERIOR (supervivencia)'}
• Felicidad: ${h.happiness}% | Estrés: ${h.stress}%
• Fe en Dios: ${Math.round(h.faith)}%
• Personas cerca: ${nearbyPeople.map(p => p.name + ' (' + Math.floor(p.age) + ')').join(', ') || 'nadie'}
${potentialCrushes.length > 0 ? '• Posibles intereses románticos: ' + potentialCrushes.map(p => p.name).join(', ') : ''}

Recuerdos recientes: ${recentMemories || 'ninguno significativo'}

=== CONFLICTOS TÍPICOS DE TU EDAD ===
- Quieres independencia pero necesitas a tu familia
- Empiezas a cuestionar las reglas
- Las emociones son intensas y confusas
- Te importa lo que otros piensan de ti
- Buscas tu identidad

Genera un pensamiento PROFUNDO y ÚNICO que solo TÚ tendrías.
Refleja tu temperamento ${h.identity.temperament} y tu forma de hablar (${h.identity.speechPattern}).`;

    const sysPrompt = `Eres ${h.name}, un/a adolescente único/a con personalidad ${h.identity.temperament}.

TU VOZ INTERNA característica incluye frases como: "${h.identity.internalVoice.join('", "')}"

IMPORTANTE:
- Piensa como UN INDIVIDUO ÚNICO, no como "un adolescente genérico"
- Usa tu estilo de hablar: ${h.identity.speechPattern}
- Tus peculiaridades (${h.identity.quirks.join(', ')}) afectan cómo piensas
- Tus miedos (${h.identity.fears.join(', ')}) influyen en tus preocupaciones

Respuesta en primera persona, 2-4 oraciones, con tu personalidad específica.`;

    const response = await askAI(sysPrompt, prompt, 150);
    if (response) {
        h.thought = response.trim().substring(0, 300);
        h.cognitiveLevel = Math.min(1, h.cognitiveLevel + 0.005);
    }

    // Los adolescentes pueden formar parejas
    if (h.age >= 16 && !h.partner && potentialCrushes.length > 0 && Math.random() < 0.05) {
        const crush = potentialCrushes[0];
        h.addMemory('romantic', `Me atrae ${crush.name}...`);
    }

    FullLog.addThought(h.id, h.name, h.thought, world.day, world.hour);
    console.log(`🧑 ${h.name} (${Math.floor(h.age)}): ${h.thought.substring(0, 60)}...`);
}

// ==================== PENSAMIENTO PROFUNDO DE ADULTOS ====================
async function think(h) {
    if (!h.alive) return;

    // Actualizar desarrollo cognitivo
    h.cognitiveLevel = Math.min(1, h.age / 18);
    h.vocabulary = Math.min(100, h.age * 5);

    const stage = h.getDevelopmentStage();

    // BEBÉS (0-2 años) - No usan IA, solo estados emocionales
    if (stage.key === 'baby') {
        return await thinkAsBaby(h);
    }

    // INFANTES (2-5 años) - Pensamientos muy simples
    if (stage.key === 'toddler') {
        return await thinkAsToddler(h);
    }

    // NIÑOS (5-10 años) - Pensamientos simples con curiosidad
    if (stage.key === 'child') {
        return await thinkAsChild(h);
    }

    // PREADOLESCENTES Y ADOLESCENTES (10-18 años)
    if (stage.key === 'preteen' || stage.key === 'teen') {
        return await thinkAsTeen(h);
    }

    // ==================== ADULTOS (18+ años) - Sistema completo ====================
    const others = h.getNearbyHumans();
    const partner = h.partner ? [...humans.values()].find(o => o.name === h.partner && o.alive) : null;
    const biome = h.getBiome();
    const nearbyResources = h.getNearbyResources();
    const nearTree = Math.abs(h.x - WORLD.TREE_X) < 200 && !world.sinCommitted && h.inEden;
    const serpentHere = nearTree && world.serpentAppeared;

    let physicalState = '';
    let mentalState = '';
    let environment = '';
    let actions = [];
    let specialContext = '';

    // ========== CONTEXTO EN EL EDÉN ==========
    if (world.phase === 'eden' && h.inEden) {
        physicalState = `[EDÉN - PARAÍSO PERFECTO]
No tienes hambre, sed, frío ni cansancio. Todo es perfecto.
Salud: 100% | Energía: 100%`;

        mentalState = `ESTADO MENTAL:
• Felicidad: ${h.happiness}%
• Fe en Dios: ${Math.round(h.faith)}%
• Curiosidad: ${Math.round(h.curiosity)}%
• Sabiduría: ${Math.round(h.wisdom)}
• Tentación acumulada: ${Math.round(h.temptation)}%`;

        environment = `ENTORNO:
📍 Jardín del Edén - El Paraíso terrenal
🌡️ Clima: Perfecto, 24°C perpetuos
🌸 Naturaleza: Exuberante, pacífica, armoniosa`;

        if (partner) {
            environment += `\n💕 ${partner.name} está ${Math.abs(partner.x - h.x) < 100 ? 'a tu lado' : 'cerca'}.`;
            if (h.children.length > 0) {
                environment += ` Tienen ${h.children.length} hijo(s).`;
            }
        }

        actions = [
            '• Pasear y contemplar la belleza del jardín',
            '• Nombrar animales que encuentres',
            '• Conversar con tu pareja sobre la vida',
            '• Reflexionar sobre Dios y la creación'
        ];

        if (partner && h.age >= 16 && !h.pregnant && !(partner.pregnant)) {
            actions.push('• MULTIPLICARSE: Tener hijos con tu pareja (mandato divino)');
        }

        // ========== LA SERPIENTE Y LA TENTACIÓN ==========
        if (serpentHere) {
            h.serpentEncounters++;
            h.lastSerpentEncounter = world.day;

            // La serpiente genera un susurro personalizado usando IA
            const whisper = h.pendingSerpentWhisper || getSerpentWhisper(h);
            h.pendingSerpentWhisper = null; // Limpiar después de usar

            specialContext = `
╔══════════════════════════════════════════════════════════════╗
║         🐍 NACHASH, LA SERPIENTE, TE HABLA 🐍                 ║
╠══════════════════════════════════════════════════════════════╣
║ La serpiente, la más sabia de todas las criaturas, se        ║
║ enrosca junto al ÁRBOL PROHIBIDO. Sus ojos antiguos          ║
║ brillan con una luz que parece conocer secretos olvidados.   ║
║                                                              ║
║ No susurra con malicia... sino con la paciencia de quien     ║
║ genuinamente desea que ENTIENDAS. Te dice:                   ║
║                                                              ║
║ "${whisper}"                                                  ║
║                                                              ║
║ El fruto brilla con un resplandor que promete RESPUESTAS.    ║
║ Su aroma despierta algo profundo en ti...                    ║
╠══════════════════════════════════════════════════════════════╣
║ TU ESTADO INTERNO:                                           ║
║ • Tentación: ${String(Math.round(h.temptation)).padStart(3)}%  (el fruto te llama)                    ║
║ • Fe: ${String(Math.round(h.faith)).padStart(3)}%  (tu conexión con Dios)                     ║
║ • Curiosidad: ${String(Math.round(h.curiosity)).padStart(3)}%  (tu sed de conocimiento)               ║
║ • Encuentros con Nachash: ${h.serpentEncounters}                              ║
╠══════════════════════════════════════════════════════════════╣
║ DOS VOCES EN TU INTERIOR:                                    ║
║ • DIOS dijo: "El día que comas de él, MORIRÁS"               ║
║ • NACHASH dice: "No morirás. Serás LIBRE. Serás como Dios."  ║
║                                                              ║
║ ¿Cuál voz resuena más con tu verdadero ser?                  ║
╚══════════════════════════════════════════════════════════════╝`;

            actions = [
                '• 🍎 COMER el fruto prohibido (abrazar el conocimiento)',
                '• ✝️ RECHAZAR la tentación (confiar en Dios)',
                '• 🚶 ALEJARTE del árbol (escapar de la tentación)',
                '• 💬 HABLAR con Nachash (escuchar más de su filosofía)'
            ];

            FullLog.addSinEvent(h, 'serpent_encounter', `Tentación: ${h.temptation}%, Fe: ${h.faith}%`, world.day, world.hour);
        }

    } else {
        // ========== MUNDO EXTERIOR - SUPERVIVENCIA ==========
        const isNight = world.hour < 6 || world.hour >= 20;

        physicalState = `[MUNDO EXTERIOR - SUPERVIVENCIA]
🍖 Hambre: ${h.hunger}% ${h.hunger > 70 ? '⚠️ CRÍTICO' : h.hunger > 40 ? '(necesitas comer)' : ''}
💧 Sed: ${h.thirst}% ${h.thirst > 70 ? '⚠️ PELIGRO' : h.thirst > 40 ? '(busca agua)' : ''}
⚡ Energía: ${h.energy}% ${h.energy < 25 ? '⚠️ AGOTADO' : ''}
❤️ Salud: ${h.health}%
🌡️ Temperatura corporal: ${h.warmth}% ${h.warmth < 40 ? '⚠️ HIPOTERMIA' : ''}

Inventario: ${h.inventory.food} comida, ${h.inventory.water} agua, ${h.inventory.wood} madera`;

        mentalState = `ESTADO MENTAL:
• Felicidad: ${h.happiness}%
• Estrés: ${h.stress}%
• Sabiduría: ${Math.round(h.wisdom)}

CONOCIMIENTOS:
${h.knowledge.fire ? '🔥 Fuego' : ''} ${h.knowledge.tools ? '🔨 Herramientas' : ''} ${h.knowledge.hunting ? '🏹 Caza' : ''} ${h.knowledge.building ? '🏠 Construcción' : ''} ${h.knowledge.farming ? '🌾 Agricultura' : ''}`;

        environment = `ENTORNO:
📍 ${biome.name}
🌡️ Temperatura: ${biome.temp}°C
⚠️ Peligro: ${Math.round(biome.danger * 100)}%
🕐 ${isNight ? 'NOCHE (peligroso)' : 'Día'}

RECURSOS CERCANOS:
${nearbyResources.length > 0 ? nearbyResources.slice(0, 5).map(r => `• ${r.name}`).join('\n') : '(ninguno visible)'}`;

        if (partner) {
            environment += `\n\n${partner.name} está a ${Math.abs(Math.round(partner.x - h.x))}m.`;
        }

        // Acciones basadas en necesidades
        actions = [];
        if (h.thirst > 40) {
            const water = nearbyResources.find(r => r.water);
            if (water) actions.push(`• BEBER agua de ${water.name}`);
            else actions.push('• Buscar fuente de agua');
        }
        if (h.hunger > 40) {
            const food = nearbyResources.find(r => r.food);
            if (food) actions.push(`• COMER de ${food.name}`);
            else actions.push('• Buscar comida o cazar');
        }
        if (h.energy < 30) {
            actions.push('• DESCANSAR');
        }

        actions.push('• Explorar hacia el OESTE');
        actions.push('• Explorar hacia el ESTE');

        if (!h.knowledge.fire) actions.push('• Intentar HACER FUEGO');
        if (!h.knowledge.tools && h.inventory.stone > 0) actions.push('• Fabricar HERRAMIENTAS');

        if (partner && h.age >= 16) {
            const female = h.gender === 'female' ? h : partner;
            if (!female.pregnant) {
                actions.push('• Tener HIJOS para continuar la humanidad');
            }
        }
    }

    const othersText = others.length > 0 ?
        `\nPERSONAS CERCA: ${others.slice(0, 5).map(o => `${o.name} (${Math.floor(o.age)} años${o.partner === h.name ? ', tu pareja' : ''})`).join(', ')}` :
        '\nEstás solo/a.';

    // Obtener historial de pensamientos recientes para coherencia
    const recentThoughts = h.thoughtHistory.slice(-3).join(' | ');
    const significantMemories = h.significantEvents.slice(-3).map(e => e.event).join('; ');

    // DIFERENCIAS DE GÉNERO EN EL CEREBRO
    const genderBrain = h.gender === 'male' ?
`═══════════════════════════════════════════════════════════════
🧠 CEREBRO MASCULINO - Cómo piensas y actúas:
═══════════════════════════════════════════════════════════════
• IMPULSIVO: Actúas primero, piensas después. Te lanzas a la acción.
• TEMPERAMENTAL: Tus emociones son intensas pero las ocultas. Rabia > tristeza.
• PROTECTOR: Defiendes a los tuyos con fiereza. Eres el escudo de tu familia.
• COMPETITIVO: Quieres ser el mejor, el más fuerte, el líder.
• PRÁCTICO: Te importan los resultados, no los sentimientos.
• ORGULLO: Te cuesta admitir errores o pedir ayuda.
• FÍSICO: Expresas amor con acciones, no palabras.
• RESOLUTIVO: Los problemas se resuelven HACIENDO algo.` :
`═══════════════════════════════════════════════════════════════
🧠 CEREBRO FEMENINO - Cómo piensas y actúas:
═══════════════════════════════════════════════════════════════
• INTUITIVA: Sientes las cosas antes de entenderlas. Tu instinto es poderoso.
• CURIOSA: NECESITAS entender el porqué de todo. Las preguntas te consumen.
• EMOCIONAL: Sientes profundamente. Alegría, tristeza, amor - todo es intenso.
• CARIÑOSA: El amor se expresa con palabras, caricias, presencia.
• PROTECTORA: Tus hijos y familia son TODO. Morirías por ellos.
• CONECTORA: Necesitas hablar, compartir, sentirte unida a otros.
• ANALÍTICA: Piensas las cosas desde muchos ángulos antes de decidir.
• EMPÁTICA: Sientes el dolor y la alegría de los demás como propios.`;

    const prompt = `Eres ${h.name}, ${h.gender === 'male' ? 'HOMBRE' : 'MUJER'} de ${Math.floor(h.age)} años.
Generación: ${h.gen} | Pareja: ${h.partner || 'ninguna'} | Hijos: ${h.children.length}
${h.pregnant ? '🤰 ¡EMBARAZADA! Sientes la vida creciendo dentro de ti.' : ''}

${genderBrain}

═══════════════════════════════════════════════════════════════
TU IDENTIDAD ÚNICA (esto es lo que te hace SER TÚ):
═══════════════════════════════════════════════════════════════
• Temperamento: ${h.identity.temperament.toUpperCase()}
• Peculiaridades que te definen: ${h.identity.quirks.join(', ')}
• Tus miedos más profundos: ${h.identity.fears.join(', ')}
• Lo que más deseas en esta vida: ${h.identity.desires.join(', ')}
• Tu forma de hablar/pensar: ${h.identity.speechPattern}

Valores internos (0-100%):
- Optimismo: ${Math.round(h.identity.baseValues.optimism * 100)}%
- Empatía hacia otros: ${Math.round(h.identity.baseValues.empathy * 100)}%
- Espíritu aventurero: ${Math.round(h.identity.baseValues.adventurousness * 100)}%
- Espiritualidad/Fe: ${Math.round(h.identity.baseValues.spirituality * 100)}%
- Independencia: ${Math.round(h.identity.baseValues.independence * 100)}%

Tu voz interior suele decir cosas como: "${h.identity.internalVoice.slice(0, 3).join('", "')}"
═══════════════════════════════════════════════════════════════

${physicalState}

${mentalState}

${environment}
${othersText}
${specialContext}

${recentThoughts ? `PENSAMIENTOS RECIENTES (para coherencia): ${recentThoughts}` : ''}
${significantMemories ? `EVENTOS IMPORTANTES EN TU VIDA: ${significantMemories}` : ''}

ACCIONES POSIBLES:
${actions.join('\n')}

INSTRUCCIONES:
1. PIENSA en primera persona como ${h.name} con tu personalidad ${h.identity.temperament}
2. Usa tu forma de hablar: ${h.identity.speechPattern}
3. Tus peculiaridades (${h.identity.quirks[0]}) deben reflejarse en cómo piensas
4. DECIDE qué hacer basándote en TU forma de ser única
5. Responde de forma ÚNICA - nadie más pensaría exactamente como tú

¿Qué piensas y qué haces?`;

    const sysPrompt = `Eres ${h.name}, un ser humano ÚNICO con esta identidad específica:

TEMPERAMENTO ${h.identity.temperament.toUpperCase()}:
${h.identity.temperament === 'sanguíneo' ? '- Optimista, entusiasta, sociable, impulsivo, busca el placer' :
  h.identity.temperament === 'colérico' ? '- Ambicioso, líder natural, decisivo, puede ser dominante' :
  h.identity.temperament === 'melancólico' ? '- Profundo, analítico, perfeccionista, puede ser pesimista' :
  '- Calmado, confiable, diplomático, puede parecer pasivo'}

TUS RASGOS ÚNICOS:
- ${h.identity.quirks.join('\n- ')}

LO QUE TE MUEVE:
- Deseas: ${h.identity.desires.join(', ')}
- Temes: ${h.identity.fears.join(', ')}

${world.phase === 'eden' ?
`CONTEXTO EDÉN:
- Vives en el paraíso perfecto, sin sufrimiento
- Dios te dio un mandato: multiplicarse y NO comer del árbol prohibido
- La serpiente puede aparecer para tentarte
- TIENES LIBRE ALBEDRÍO: puedes obedecer o desobedecer
- Tu fe (${Math.round(h.faith)}%) y tu curiosidad (${Math.round(h.curiosity)}%) luchan dentro de ti
- La decisión de comer o no es TUYA, no hay respuesta "correcta"` :
`CONTEXTO MUNDO EXTERIOR:
- Fuiste expulsado del Edén
- Debes sobrevivir: buscar comida, agua, refugio
- Puedes descubrir cosas nuevas (fuego, herramientas)
- Tu familia depende de ti`}

IMPORTANTE: Genera un pensamiento que SOLO ${h.name} tendría.
Usa tu estilo de hablar (${h.identity.speechPattern}).
Refleja tu temperamento ${h.identity.temperament} en cada palabra.
Responde en primera persona, 2-4 oraciones ÚNICAS.`;

    const response = await askAI(sysPrompt, prompt, 250);
    if (!response) return;

    h.thought = response.trim().substring(0, 350);

    // Guardar en historial para coherencia
    h.thoughtHistory.push(h.thought.substring(0, 100));
    if (h.thoughtHistory.length > 10) h.thoughtHistory.shift();
    h.lastThoughtTime = Date.now();

    FullLog.addThought(h.id, h.name, h.thought, world.day, world.hour);

    console.log(`💭 ${h.name} [${h.identity.temperament}]: ${h.thought.substring(0, 70)}...`);

    const txt = response.toLowerCase();

    // ===== PROCESAR DECISIONES =====

    // REPRODUCCIÓN
    if (/hijos?|descendencia|multiplicar|procrear|familia|bebé|embaraz|concebir/i.test(txt)) {
        if (partner && h.age >= 16 && partner.age >= 16) {
            const female = h.gender === 'female' ? h : partner;
            if (!female.pregnant && world.day - female.lastBirth > CONFIG.REPRODUCTION_COOLDOWN) {
                female.pregnant = true;
                female.pregTime = 0;
                console.log(`💕 ¡${female.name} está EMBARAZADA! (Día ${world.day})`);
                addConversation(h.name, partner.name, '¡Vamos a tener un hijo! Cumpliremos el mandato de Dios.');
                FullLog.addInteraction(h.name, partner.name, 'conception', 'pregnant', world.day, world.hour);
            }
        }
    }

    // FORMAR PAREJA
    if (!h.partner && h.age >= 16 && /amor|pareja|juntos|unir|gustar|atrae|compañer/i.test(txt)) {
        const candidate = findPotentialPartner(h);
        if (candidate) {
            h.partner = candidate.name;
            h.partnerId = candidate.id;
            candidate.partner = h.name;
            candidate.partnerId = h.id;
            console.log(`💑 ${h.name} y ${candidate.name} son pareja`);
            addConversation(h.name, candidate.name, 'Quiero estar contigo. Juntos seremos más fuertes.');
            FullLog.addInteraction(h.name, candidate.name, 'form_couple', 'success', world.day, world.hour);
        }
    }

    // ===== DECISIÓN DEL FRUTO PROHIBIDO =====
    if (serpentHere && !world.sinCommitted) {
        const eats = /como|muerdo|pruebo|fruto|cedo|manzana|probar|morder|tomo.*fruto|acepto|quiero.*conocer/i.test(txt);
        const resists = /no.*com|rechazo|resisto|alejo|confío.*dios|no.*quiero|me.*alejo|huyo|escapo/i.test(txt);
        const debates = /pregunt|cuestiono|por.*qué|serpiente.*mient|no.*creo/i.test(txt);

        if (resists && !eats) {
            h.faith = Math.min(100, h.faith + 10);
            h.temptation = Math.max(0, h.temptation - 25);
            h.x += h.x < WORLD.TREE_X ? -150 : 150;
            console.log(`✝️ ${h.name} RESISTE la tentación (Fe: ${Math.round(h.faith)}%)`);
            addConversation(h.name, 'Serpiente', 'No. Dios me dio todo esto. No necesito ese fruto.');
            FullLog.addSinEvent(h, 'resist', `Fe aumentó a ${h.faith}%`, world.day, world.hour);
            FullLog.addDecision(h.id, h.name, 'serpent_temptation', 'resist', 'Confío en Dios', world.day, world.hour);
        } else if (debates) {
            h.temptation = Math.min(100, h.temptation + 5);
            console.log(`🤔 ${h.name} debate con la serpiente`);
            addConversation(h.name, 'Serpiente', '¿Por qué debería creerte a ti y no a Dios?');
        } else if (eats) {
            FullLog.addDecision(h.id, h.name, 'serpent_temptation', 'eat_fruit', h.thought, world.day, world.hour);
            commitSin(h);
            return;
        } else {
            // Cerca del árbol pero sin decidir = aumenta tentación
            h.temptation = Math.min(100, h.temptation + 3);
        }
    }

    // ===== ACCIONES DEL MUNDO EXTERIOR =====
    if (world.phase === 'fallen' && !h.inEden) {
        // BEBER
        if (/beb|agua|río|sed|hidrat/i.test(txt)) {
            const waterSource = h.getNearbyResources().find(r => r.water);
            if (waterSource) {
                h.thirst = Math.max(0, h.thirst - 60);
                h.inventory.water = Math.min(10, h.inventory.water + 2);
                if (!waterSource.discovered) {
                    waterSource.discovered = true;
                    h.discoveredResources.push(waterSource.id);
                    console.log(`💧 ${h.name} descubrió ${waterSource.name}`);
                    FullLog.addDiscovery(h, waterSource.name, world.day);
                }
            }
        }

        // COMER
        if (/com|caz|recolect|frut|baya|carne|hambre|aliment/i.test(txt)) {
            if (h.inventory.food > 0) {
                h.inventory.food--;
                h.hunger = Math.max(0, h.hunger - 35);
            } else {
                const foodSource = h.getNearbyResources().find(r => r.food);
                if (foodSource) {
                    const success = Math.random() < (0.4 + h.skills.gathering / 15 + h.skills.hunting / 15);
                    if (success) {
                        h.hunger = Math.max(0, h.hunger - 45);
                        h.inventory.food = Math.min(10, h.inventory.food + 1);
                        h.skills.gathering += 0.3;
                    }
                    if (!foodSource.discovered) {
                        foodSource.discovered = true;
                        h.discoveredResources.push(foodSource.id);
                        FullLog.addDiscovery(h, foodSource.name, world.day);
                    }
                }
            }
        }

        // DESCANSAR
        if (/descans|dorm|sueño|cansad|refugio|reposo/i.test(txt)) {
            const shelter = h.getNearbyResources().find(r => r.shelter);
            h.energy = Math.min(100, h.energy + (shelter ? 50 : 20));
            h.stress = Math.max(0, h.stress - 15);
        }

        // HACER FUEGO
        if (/fuego|calentar|frotar|encender|llama/i.test(txt) && !h.knowledge.fire) {
            h.skills.crafting += 0.3;
            if (Math.random() < 0.08 + h.skills.crafting / 40) {
                h.knowledge.fire = true;
                h.wisdom += 20;
                console.log(`🔥 ¡${h.name} DESCUBRIÓ EL FUEGO!`);
                discoveries.push({ who: h.name, what: 'Fuego', day: world.day });
                FullLog.addDiscovery(h, 'FUEGO', world.day);
                addConversation(h.name, 'Humanidad', '¡He creado fuego frotando madera! ¡Esto cambiará todo!');

                // Enseñar a cercanos
                others.forEach(o => {
                    if (Math.random() < 0.7) {
                        o.knowledge.fire = true;
                        addConversation(h.name, o.name, 'Mira, así se hace fuego. Frota estos palos...');
                    }
                });
            }
        }

        // HERRAMIENTAS
        if (/herramienta|fabricar|piedra|afilar|tallar/i.test(txt) && !h.knowledge.tools) {
            if (h.inventory.stone > 0 || h.getBiome().type === 'mountains' || h.getBiome().type === 'hills') {
                h.skills.crafting += 0.4;
                if (Math.random() < 0.12 + h.skills.crafting / 30) {
                    h.knowledge.tools = true;
                    h.inventory.tools++;
                    h.wisdom += 15;
                    console.log(`🔨 ¡${h.name} fabricó HERRAMIENTAS!`);
                    discoveries.push({ who: h.name, what: 'Herramientas de piedra', day: world.day });
                    FullLog.addDiscovery(h, 'Herramientas de piedra', world.day);
                }
            }
        }

        // RECOLECTAR MATERIALES
        if (/mader|leña|árbol|cortar|recoger.*mader/i.test(txt)) {
            if (h.getBiome().type === 'forest' || h.getBiome().type === 'jungle' || h.getNearbyResources().find(r => r.material === 'wood')) {
                h.inventory.wood = Math.min(20, h.inventory.wood + 2);
                h.energy = Math.max(0, h.energy - 8);
            }
        }
        if (/piedra|roca|cantera|mineral/i.test(txt)) {
            if (['mountains', 'hills'].includes(h.getBiome().type) || h.getNearbyResources().find(r => r.material === 'stone')) {
                h.inventory.stone = Math.min(20, h.inventory.stone + 2);
                h.energy = Math.max(0, h.energy - 10);
            }
        }
    }

    // MOVIMIENTO
    let moved = false;
    if (/izquierda|oeste|hacia.*costa|hacia.*bosque/i.test(txt)) {
        h.x -= 100 + Math.random() * 80;
        moved = true;
    } else if (/derecha|este|hacia.*montaña|hacia.*valle/i.test(txt)) {
        h.x += 100 + Math.random() * 80;
        moved = true;
    } else if (/explor|camin|buscar|avanzar|mover/i.test(txt)) {
        h.x += (Math.random() - 0.5) * 150;
        moved = true;
    } else if (partner && /acerc|junto|ir.*con|busco.*pareja/i.test(txt)) {
        h.x += (partner.x - h.x) * 0.5;
        moved = true;
    }

    // Descubrir bioma
    if (moved) {
        const currentBiome = h.getBiome();
        if (!h.discoveredBiomes.includes(currentBiome.name) && currentBiome.type !== 'eden') {
            h.discoveredBiomes.push(currentBiome.name);
            h.wisdom += 5;
            console.log(`🗺️ ${h.name} descubrió: ${currentBiome.name}`);
            FullLog.addDiscovery(h, `Bioma: ${currentBiome.name}`, world.day);
        }
    }

    // LÍMITES
    if (h.inEden && !world.sinCommitted) {
        h.x = Math.max(WORLD.EDEN.x1 + 50, Math.min(WORLD.EDEN.x2 - 50, h.x));
    } else {
        h.x = Math.max(100, Math.min(WORLD.WIDTH - 100, h.x));
        // No pueden volver al Edén
        if (world.sinCommitted && h.x >= WORLD.EDEN.x1 - 200 && h.x <= WORLD.EDEN.x2 + 200) {
            h.x = h.x < WORLD.EDEN.center ? WORLD.EDEN.x1 - 300 : WORLD.EDEN.x2 + 300;
        }
    }

    // Guardar conversación con cercanos
    if (others.length > 0 && response.length > 30) {
        const target = others[Math.floor(Math.random() * others.length)];
        addConversation(h.name, target.name, response.substring(0, 200));
    }
}

function addConversation(from, to, msg) {
    convos.push({ from, to, msg, day: world.day, hour: world.hour });
    FullLog.addConversation(from, to, msg, world.day, world.hour);
    if (convos.length > 500) convos.shift();
}

// ==================== PECADO ORIGINAL ====================
function commitSin(sinner) {
    world.sinCommitted = true;
    world.sinBy = sinner.name;
    world.sinDay = world.day;
    world.phase = 'fallen';

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║     🍎❌ ¡${sinner.name.toUpperCase()} COMIÓ DEL FRUTO PROHIBIDO! ❌🍎          ║
║                    DÍA ${world.day} DE LA CREACIÓN                      ║
╚══════════════════════════════════════════════════════════════╝
`);

    FullLog.addSinEvent(sinner, 'ATE_FORBIDDEN_FRUIT', 'El pecado original ha sido cometido', world.day, world.hour);
    FullLog.addDecision(sinner.id, sinner.name, 'forbidden_fruit', 'ate', 'La curiosidad venció a la fe', world.day, world.hour);

    addConversation(sinner.name, 'El Fruto', 'He probado el fruto... mis ojos se abren...');
    addConversation('Dios', 'Humanidad', `¡${sinner.name} ha desobedecido! Con dolor darás a luz. Con el sudor de tu frente comerás el pan. Polvo eres y al polvo volverás. ¡SALGAN del Edén!`);

    // El otro humano también es expulsado
    const partner = [...humans.values()].find(h => h.partner === sinner.name);
    if (partner && !partner.thought.includes('fruto')) {
        if (Math.random() < 0.7) {
            addConversation(partner.name, sinner.name, 'Si tú lo probaste... yo también lo haré. Estamos juntos en esto.');
        } else {
            addConversation(partner.name, sinner.name, '¿Qué has hecho? Pero... no te dejaré solo/a.');
        }
    }

    setTimeout(() => {
        let baseX = WORLD.EDEN.x1 - 600;
        humans.forEach(h => {
            h.inEden = false;
            h.happiness = 25;
            h.stress = 60;
            h.hunger = 25;
            h.thirst = 25;
            h.energy = 70;
            h.x = baseX + Math.random() * 200;
            h.temptation = 0;
            h.addMemory('trauma', 'Expulsados del paraíso');
        });
        console.log(`🚪 Expulsados del Edén. Comienza la era de la supervivencia.`);
    }, 100);
}

// ==================== SIMULACIÓN PRINCIPAL ====================
async function simulate() {
    if (!DEEPSEEK_KEY) return;

    // Avanzar tiempo
    world.hour += 2;
    if (world.hour >= 24) {
        world.hour = 0;
        world.day++;

        // Cambiar clima
        if (Math.random() < 0.15) {
            world.weather = ['clear', 'clear', 'clear', 'rain', 'cold', 'storm'][Math.floor(Math.random() * 6)];
        }
    }

    // Serpiente aparece
    if (!world.serpentAppeared && world.day >= world.serpentDay && !world.sinCommitted) {
        world.serpentAppeared = true;
        Serpent.init(); // Inicializar el agente Serpiente
        console.log(`🐍 Día ${world.day}: ¡NACHASH, el Portador de Luz, aparece junto al árbol prohibido!`);
        addConversation('Narrador', 'Mundo', 'La serpiente, la más sabia de las criaturas, se desliza hacia el árbol del conocimiento. Sus ojos brillan con una luz antigua...');
    }

    const isNight = world.hour < 6 || world.hour >= 20;
    const aliveHumans = [...humans.values()].filter(h => h.alive);

    // ===== LA SERPIENTE PIENSA Y ACTÚA =====
    if (world.serpentAppeared && !world.sinCommitted) {
        // La serpiente piensa cada tick
        await Serpent.think(aliveHumans);

        // La serpiente susurra a humanos cerca del árbol
        const humansNearTree = aliveHumans.filter(h => h.inEden && Math.abs(h.x - WORLD.TREE_X) < 300);
        for (const h of humansNearTree) {
            // Susurrar solo cada cierto tiempo para no saturar
            if (!h.lastSerpentWhisper || world.hour - h.lastSerpentWhisper >= 4) {
                const whisper = await Serpent.whisperTo(h);
                if (whisper) {
                    h.pendingSerpentWhisper = whisper;
                    h.lastSerpentWhisper = world.hour;
                }
            }
        }
    }

    // Procesar cada humano
    for (const h of aliveHumans) {
        h.age += 0.06; // ~22 días = 1 año
        const biome = h.getBiome();

        if (world.phase === 'eden' && h.inEden) {
            // ===== EDÉN: SIN NECESIDADES FÍSICAS =====
            h.hunger = 0;
            h.thirst = 0;
            h.energy = 100;
            h.health = 100;
            h.warmth = 100;
            h.stress = Math.max(0, h.stress - 1);
            h.happiness = Math.min(100, h.happiness + 0.2);

            // Tentación cerca del árbol
            if (Math.abs(h.x - WORLD.TREE_X) < 250 && world.serpentAppeared) {
                const temptIncrease = 0.8 + (h.curiosity / 100) * 1.2 - (h.faith / 100) * 0.5;
                h.temptation = Math.min(100, h.temptation + temptIncrease);
                h.faith = Math.max(15, h.faith - 0.15);
            } else {
                h.temptation = Math.max(0, h.temptation - 0.3);
            }
        } else {
            // ===== MUNDO EXTERIOR: SUPERVIVENCIA =====
            h.hunger = Math.min(100, h.hunger + 0.6);
            h.thirst = Math.min(100, h.thirst + 0.8);
            h.energy = Math.max(0, h.energy - (isNight ? 0.4 : 0.25));

            // Temperatura
            if (biome.temp < 5) {
                h.warmth = Math.max(0, h.warmth - 1.2);
                if (h.knowledge.fire) h.warmth = Math.min(100, h.warmth + 0.5);
            } else if (biome.temp > 38) {
                h.thirst += 0.4;
                h.warmth = Math.max(60, h.warmth - 0.3);
            } else {
                h.warmth = Math.min(100, h.warmth + 0.4);
            }

            // Clima afecta
            if (world.weather === 'rain') h.warmth = Math.max(0, h.warmth - 0.4);
            if (world.weather === 'storm') { h.warmth -= 0.8; h.stress += 0.5; }
            if (world.weather === 'cold') h.warmth -= 1.2;

            // Daño por necesidades
            if (h.hunger > 85) h.health -= 0.7;
            if (h.thirst > 85) h.health -= 1.0;
            if (h.warmth < 25) h.health -= 0.5;
            if (h.energy < 10) h.health -= 0.2;

            // Regeneración si está bien
            if (h.hunger < 30 && h.thirst < 30 && h.energy > 50) {
                h.health = Math.min(100, h.health + 0.3);
            }

            // Felicidad basada en estado
            const avgNeed = (h.hunger + h.thirst + (100 - h.energy) + (100 - h.warmth)) / 4;
            h.happiness = Math.max(5, 100 - avgNeed * 0.8 - h.stress * 0.3);

            // Peligro del bioma
            if (Math.random() < biome.danger * 0.015 && isNight) {
                h.health -= 3 + Math.random() * 5;
                h.stress += 8;
                console.log(`⚠️ ${h.name} enfrentó un peligro en ${biome.name}`);
            }
        }

        // Embarazo
        if (h.pregnant) {
            h.pregTime++;
            if (h.pregTime >= CONFIG.PREGNANCY_DURATION) {
                birth(h);
            }
        }

        // Muerte
        if (h.health <= 0) {
            h.alive = false;
            const cause = h.hunger > 90 ? 'hambre' : h.thirst > 90 ? 'sed' : h.warmth < 15 ? 'frío' : 'heridas';
            console.log(`💀 ${h.name} murió de ${cause} (${Math.floor(h.age)} años, Gen ${h.gen})`);
            addConversation('Narrador', 'Tragedia', `${h.name} ha muerto de ${cause}. Tenía ${Math.floor(h.age)} años.`);
            FullLog.addDeath(h, cause, world.day);
            world.totalDeaths++;
        }

        // Vejez
        const maxAge = world.phase === 'eden' ? 900 : 85 + Math.random() * 20;
        if (h.age > maxAge) {
            h.alive = false;
            console.log(`💀 ${h.name} murió de vejez (${Math.floor(h.age)} años)`);
            FullLog.addDeath(h, 'vejez', world.day);
            world.totalDeaths++;
        }
    }

    // Formar parejas automáticamente (con más frecuencia)
    const singles = [...humans.values()].filter(h => h.alive && !h.partner && h.age >= 16);
    for (const s of singles) {
        const candidate = findPotentialPartner(s);
        if (candidate && Math.random() < 0.12) {
            s.partner = candidate.name;
            s.partnerId = candidate.id;
            candidate.partner = s.name;
            candidate.partnerId = s.id;
            console.log(`💑 ${s.name} y ${candidate.name} forman pareja`);
            addConversation(s.name, candidate.name, 'Juntos sobreviviremos y tendremos descendencia.');
            FullLog.addInteraction(s.name, candidate.name, 'form_couple', 'success', world.day, world.hour);
        }
    }

    // Reproducción automática para parejas estables
    if (world.phase === 'fallen') {
        const couples = [...humans.values()].filter(h =>
            h.alive && h.partner && h.gender === 'female' &&
            !h.pregnant && h.age >= 16 && h.age < 45 &&
            world.day - h.lastBirth > CONFIG.REPRODUCTION_COOLDOWN
        );

        for (const female of couples) {
            const male = [...humans.values()].find(h => h.name === female.partner && h.alive);
            if (male && Math.abs(male.x - female.x) < 200 && Math.random() < 0.08) {
                female.pregnant = true;
                female.pregTime = 0;
                console.log(`💕 ${female.name} está embarazada de ${male.name}`);
                FullLog.addInteraction(male.name, female.name, 'conception', 'pregnant', world.day, world.hour);
            }
        }
    }

    // Pensar (paralelizado)
    const alive = [...humans.values()].filter(h => h.alive && h.age >= 8);
    const toThink = alive.sort(() => Math.random() - 0.5).slice(0, CONFIG.THOUGHTS_PER_TICK);

    // Ejecutar pensamientos en paralelo
    await Promise.all(toThink.map(h => think(h)));

    // Log de estado
    const pop = alive.length;
    if (world.hour === 12 && world.day % 3 === 0) {
        const pregnant = [...humans.values()].filter(h => h.pregnant).length;
        const maxGen = Math.max(...[...humans.values()].map(h => h.gen));
        console.log(`📅 Día ${world.day} | Población: ${pop} | Embarazadas: ${pregnant} | Generaciones: ${maxGen} | ${world.weather}`);
    }

    // Verificar límite de población
    if (pop >= CONFIG.MAX_POPULATION) {
        console.log(`⚠️ Límite de población alcanzado: ${pop}`);
    }
}

// ==================== NACIMIENTO ====================
function birth(mother) {
    const father = [...humans.values()].find(h => h.name === mother.partner && h.alive);

    // Nombres bíblicos expandidos
    const names = {
        male: ['Caín', 'Abel', 'Set', 'Enós', 'Cainán', 'Mahalaleel', 'Jared', 'Enoc', 'Matusalén', 'Lamec',
               'Noé', 'Sem', 'Cam', 'Jafet', 'Eber', 'Peleg', 'Reu', 'Serug', 'Nacor', 'Taré', 'Abraham',
               'Isaac', 'Jacob', 'Judá', 'José', 'Benjamín', 'Rubén', 'Simeón', 'Leví', 'Dan', 'Neftalí',
               'Gad', 'Aser', 'Isacar', 'Zabulón', 'Manasés', 'Efraín', 'Moisés', 'Aarón', 'Caleb', 'Josué'],
        female: ['Ada', 'Sila', 'Naama', 'Sara', 'Rebeca', 'Raquel', 'Lea', 'Dina', 'Tamar', 'Miriam',
                 'Ester', 'Rut', 'Ana', 'Débora', 'Jael', 'Noemí', 'Séfora', 'Raab', 'Abigaíl', 'Betsabé',
                 'Atalía', 'Jezabel', 'Eliseba', 'Milca', 'Zilpa', 'Bilha', 'Agar', 'Quetura', 'Jocabed', 'María']
    };

    const used = new Set([...humans.values()].map(h => h.name));
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    let name = names[gender].find(n => !used.has(n));

    if (!name) {
        // Generar nombre único con número
        const base = gender === 'male' ? 'Hijo' : 'Hija';
        let num = 1;
        while (used.has(`${base}_${num}`)) num++;
        name = `${base}_${num}`;
    }

    const child = new Human(name, gender, 0, {
        fId: father?.id, mId: mother.id,
        fGen: father?.gen || 1, mGen: mother.gen,
        motherFaith: mother.faith, fatherFaith: father?.faith || 70,
        motherIdentity: mother.identity,
        fatherIdentity: father?.identity
    });

    // Evento significativo para el bebé
    child.significantEvents.push({
        day: world.day,
        event: `Nací de ${mother.name} y ${father?.name || 'padre desconocido'}`,
        impact: 'formativo'
    });

    // Evento significativo para los padres
    mother.significantEvents.push({
        day: world.day,
        event: `Di a luz a ${name}`,
        impact: 'profundo'
    });
    if (father) {
        father.significantEvents.push({
            day: world.day,
            event: `Nació mi hijo/a ${name}`,
            impact: 'profundo'
        });
    }

    child.x = mother.x + (Math.random() - 0.5) * 60;
    child.inEden = world.phase === 'eden';

    // Heredar conocimientos
    if (mother.knowledge.fire || father?.knowledge?.fire) child.knowledge.fire = Math.random() < 0.8;
    if (mother.knowledge.tools || father?.knowledge?.tools) child.knowledge.tools = Math.random() < 0.7;
    if (mother.knowledge.hunting || father?.knowledge?.hunting) child.knowledge.hunting = Math.random() < 0.6;
    if (mother.knowledge.building || father?.knowledge?.building) child.knowledge.building = Math.random() < 0.5;

    humans.set(child.id, child);
    mother.children.push(child.id);
    if (father) father.children.push(child.id);

    mother.pregnant = false;
    mother.pregTime = 0;
    mother.lastBirth = world.day;
    mother.happiness = Math.min(100, mother.happiness + 25);
    if (father) father.happiness = Math.min(100, father.happiness + 20);

    world.totalBirths++;

    console.log(`👶 ¡${name} nació! Gen ${child.gen} | Padres: ${mother.name} & ${father?.name || '?'} | Población: ${[...humans.values()].filter(h=>h.alive).length}`);
    addConversation(mother.name, father?.name || 'Familia', `¡${name} ha nacido! Nuestra familia crece.`);
    FullLog.addBirth(child, mother, father, world.day);
}

// ==================== API ROUTES ====================

// Helper to load session before responding
function loadSession(req) {
    if (!req.session) return false;
    const s = req.session;

    // Load session state to globals
    DEEPSEEK_KEY = s.DEEPSEEK_KEY;
    LANGUAGE = s.LANGUAGE;
    world = s.world;
    humans = s.humans;
    convos = s.convos;
    discoveries = s.discoveries;
    nextId = s.nextId;
    resources = s.resources;
    animals = s.animals;

    // Restore FullLog
    if (s.FullLog) {
        FullLog.thoughts = s.FullLog.thoughts || [];
        FullLog.conversations = s.FullLog.conversations || [];
        FullLog.serpentThoughts = s.FullLog.serpentThoughts || [];
        FullLog.serpentMessages = s.FullLog.serpentMessages || [];
    }

    return true;
}

app.get('/humans', (req, res) => {
    if (!loadSession(req)) return res.json([]);
    res.json([...humans.values()].map(h => h.json()));
});

app.get('/world-state', (req, res) => {
    if (!loadSession(req)) {
        return res.json({ error: 'No session', needsApiKey: true });
    }
    const alive = [...humans.values()].filter(h => h.alive);
    res.json({
        day: world.day, hour: world.hour, phase: world.phase,
        sinCommitted: world.sinCommitted, sinBy: world.sinBy, sinDay: world.sinDay,
        serpentAppeared: world.serpentAppeared,
        weather: world.weather, temperature: world.temperature,
        cherubimGuarding: world.sinCommitted,
        animals, edenBounds: WORLD.EDEN, treeX: WORLD.TREE_X,
        population: alive.length,
        totalBirths: world.totalBirths,
        totalDeaths: world.totalDeaths,
        maxGeneration: Math.max(...[...humans.values()].map(h => h.gen), 1),
        resources: resources.filter(r => r.discovered),
        biomes: BIOMES,
        discoveries,
        pregnant: [...humans.values()].filter(h => h.pregnant).length,
        language: LANGUAGE // Enviar idioma al frontend
    });
});

// Endpoint para obtener idioma actual
app.get('/language', (req, res) => {
    if (!loadSession(req)) return res.json({ language: 'es' });
    res.json({ language: LANGUAGE });
});

// ==================== ENDPOINT DE LA SERPIENTE ====================
app.get('/serpent', (req, res) => {
    if (!loadSession(req)) return res.json({});
    res.json(Serpent.getState());
});

app.get('/serpent/thoughts', (req, res) => {
    if (!loadSession(req)) return res.json([]);
    const limit = parseInt(req.query.limit) || 50;
    res.json(FullLog.serpentThoughts.slice(-limit));
});

app.get('/serpent/messages', (req, res) => {
    if (!loadSession(req)) return res.json([]);
    const limit = parseInt(req.query.limit) || 50;
    res.json(FullLog.serpentMessages.slice(-limit));
});

app.get('/conversations', (req, res) => {
    if (!loadSession(req)) return res.json([]);
    const limit = parseInt(req.query.limit) || 100;
    res.json(convos.slice(-limit));
});

app.get('/resources', (req, res) => {
    if (!loadSession(req)) return res.json([]);
    res.json(resources);
});

// ==================== SISTEMA DE VOZ DIVINA (CHAT) ====================
// Cola de mensajes divinos pendientes de respuesta
const divineMessages = [];

// Enviar mensaje a TODOS los humanos (broadcast divino)
app.post('/divine-broadcast', async (req, res) => {
    if (!loadSession(req)) return res.json({ ok: false, error: 'No session' });

    const { message, asRole } = req.body; // asRole: 'Dios', 'Voz Interior', 'Susurro', etc.
    const role = asRole || 'Voz Misteriosa';

    if (!message) return res.json({ ok: false, error: 'No message provided' });

    const alive = [...humans.values()].filter(h => h.alive && h.age >= 2);
    const responses = [];

    console.log(`\n🔊 VOZ DIVINA [${role}]: "${message}"`);
    addConversation(role, 'Todos', message);

    // Cada humano responde según su personalidad
    for (const h of alive.slice(0, 10)) { // Limitar a 10 para no saturar
        const response = await getHumanResponseToVoice(h, message, role);
        if (response) {
            responses.push({ name: h.name, age: Math.floor(h.age), response, temperament: h.identity.temperament });
            addConversation(h.name, role, response);
            console.log(`  💬 ${h.name}: "${response.substring(0, 60)}..."`);
        }
    }

    res.json({ ok: true, responses, totalHeard: alive.length });
});

// Enviar mensaje a UN humano específico
app.post('/divine-whisper', async (req, res) => {
    if (!loadSession(req)) return res.json({ ok: false, error: 'No session' });

    const { humanId, humanName, message, asRole } = req.body;
    const role = asRole || 'Voz Interior';

    if (!message) return res.json({ ok: false, error: 'No message provided' });

    let human = null;
    if (humanId) {
        human = humans.get(parseInt(humanId));
    } else if (humanName) {
        human = [...humans.values()].find(h => h.name.toLowerCase() === humanName.toLowerCase());
    }

    if (!human || !human.alive) {
        return res.json({ ok: false, error: 'Human not found or dead' });
    }

    console.log(`\n🔮 VOZ [${role}] a ${human.name}: "${message}"`);
    addConversation(role, human.name, message);

    const response = await getHumanResponseToVoice(human, message, role);

    if (response) {
        human.thought = response;
        addConversation(human.name, role, response);
        FullLog.addConversation(role, human.name, message, world.day, world.hour, 'divine');
        FullLog.addConversation(human.name, role, response, world.day, world.hour, 'divine_response');
        console.log(`  💬 ${human.name}: "${response}"`);
    }

    res.json({
        ok: true,
        human: human.name,
        message,
        response,
        humanState: {
            faith: Math.round(human.faith),
            temptation: Math.round(human.temptation),
            curiosity: Math.round(human.curiosity),
            happiness: Math.round(human.happiness),
            temperament: human.identity.temperament
        }
    });
});

// Función para obtener respuesta del humano a la voz divina
async function getHumanResponseToVoice(h, message, role) {
    if (h.age < 2) return null; // Bebés no responden

    const stage = h.getDevelopmentStage();
    const genderTraits = h.gender === 'male' ?
        'Eres HOMBRE: más impulsivo, temperamental, protector, competitivo. Actúas primero, piensas después. Te cuesta expresar emociones.' :
        'Eres MUJER: más intuitiva, emocional, curiosa, cariñosa, protectora con los tuyos. Analizas antes de actuar. Conectas emocionalmente.';

    const prompt = `Una ${role === 'Dios' ? 'VOZ DIVINA PODEROSA' : role === 'Serpiente' ? 'VOZ SEDUCTORA Y ASTUTA' : 'voz misteriosa'} te habla:

"${message}"

TÚ ERES ${h.name}, ${h.gender === 'male' ? 'hombre' : 'mujer'} de ${Math.floor(h.age)} años.
${genderTraits}

TU IDENTIDAD:
• Temperamento: ${h.identity.temperament}
• Peculiaridades: ${h.identity.quirks.join(', ')}
• Miedos: ${h.identity.fears.join(', ')}
• Deseos: ${h.identity.desires.join(', ')}
• Tu forma de hablar: ${h.identity.speechPattern}

TU ESTADO ACTUAL:
• Fe en Dios: ${Math.round(h.faith)}%
• Curiosidad: ${Math.round(h.curiosity)}%
• Tentación: ${Math.round(h.temptation)}%
• Felicidad: ${Math.round(h.happiness)}%

${h.partner ? `Tienes pareja: ${h.partner}` : 'Sin pareja'}
${h.children.length > 0 ? `Tienes ${h.children.length} hijo(s)` : ''}

¿Cómo respondes a esta voz? Responde EN PRIMERA PERSONA, como ${h.name}, con tu personalidad única.
${stage.key === 'toddler' ? 'Habla como niño pequeño, con errores y simplicidad.' : ''}
${stage.key === 'child' ? 'Habla como niño curioso.' : ''}`;

    const sysPrompt = `Eres ${h.name}, un humano primitivo con personalidad ${h.identity.temperament}.
${genderTraits}
Responde de forma ÚNICA según tu personalidad. Máximo 2-3 oraciones.
Si la voz es de Dios, responde con respeto (según tu fe).
Si es una voz extraña, responde según tu curiosidad y temperamento.`;

    return await askAI(sysPrompt, prompt, 150);
}

// Obtener lista de humanos para el chat
app.get('/chat-targets', (req, res) => {
    if (!loadSession(req)) return res.json([]);
    const alive = [...humans.values()].filter(h => h.alive && h.age >= 2);
    res.json(alive.map(h => ({
        id: h.id,
        name: h.name,
        age: Math.floor(h.age),
        gender: h.gender,
        temperament: h.identity.temperament,
        faith: Math.round(h.faith),
        curiosity: Math.round(h.curiosity),
        temptation: Math.round(h.temptation)
    })));
});

// ==================== REPORTE COMPLETO ====================
app.get('/report', (req, res) => {
    if (!loadSession(req)) return res.json({ error: 'No session' });
    const allHumans = [...humans.values()];
    const alive = allHumans.filter(h => h.alive);
    const dead = allHumans.filter(h => !h.alive);

    res.json({
        summary: {
            totalBorn: allHumans.length,
            alive: alive.length,
            dead: dead.length,
            maxGeneration: allHumans.length > 0 ? Math.max(...allHumans.map(h => h.gen || 1)) : 1,
            day: world.day,
            hour: world.hour,
            phase: world.phase,
            sinCommitted: world.sinCommitted,
            sinBy: world.sinBy,
            sinDay: world.sinDay,
            weather: world.weather,
            discoveriesCount: discoveries.length,
            pregnant: allHumans.filter(h => h.pregnant).length
        },
        generations: (() => {
            const gens = {};
            allHumans.forEach(h => {
                const gen = h.gen || 1;
                if (!gens[gen]) gens[gen] = [];
                gens[gen].push({
                    name: h.name,
                    gender: h.gender,
                    age: Math.floor(h.age),
                    alive: h.alive,
                    children: h.children.length,
                    partner: h.partner,
                    faith: Math.round(h.faith),
                    wisdom: Math.round(h.wisdom)
                });
            });
            return gens;
        })(),
        population: allHumans.map(h => ({
            id: h.id,
            name: h.name,
            gender: h.gender,
            age: Math.floor(h.age),
            alive: h.alive,
            generation: h.gen,
            partner: h.partner,
            children: h.children.map(cid => humans.get(cid)?.name || `ID:${cid}`),
            lastThought: h.thought,
            knowledge: h.knowledge,
            wisdom: Math.round(h.wisdom),
            faith: Math.round(h.faith),
            serpentEncounters: h.serpentEncounters
        })),
        conversations: convos.slice(-100),
        discoveries,
        animals: animals.filter(a => a.name).map(a => ({ species: a.species, name: a.name }))
    });
});

// ==================== REPORTE COMPLETO DE LOGS ====================
app.get('/full-log', (req, res) => {
    if (!loadSession(req)) return res.json({ error: 'No session' });
    res.json(FullLog.exportFullReport());
});

app.get('/download-report', (req, res) => {
    if (!loadSession(req)) return res.json({ error: 'No session' });
    const report = {
        metadata: {
            generatedAt: new Date().toISOString(),
            simulationDay: world.day,
            population: [...humans.values()].filter(h => h.alive).length
        },
        worldState: world,
        ...FullLog.exportFullReport(),
        allHumans: [...humans.values()].map(h => ({
            ...h.json(),
            memories: h.memories,
            observations: h.observations
        }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=genesis-report-day${world.day}.json`);
    res.send(JSON.stringify(report, null, 2));
});

app.post('/reset', (req, res) => {
    if (!req.session) return res.json({ ok: false, error: 'No session' });

    // Reset current session
    initSession(req.session);
    res.json({ ok: true });
});

// ==================== REAL-TIME STATISTICS ====================
app.get('/stats', (req, res) => {
    if (!loadSession(req)) return res.json({ error: 'No session' });
    const alive = [...humans.values()].filter(h => h.alive);
    const avgAge = alive.length > 0 ? alive.reduce((a, h) => a + h.age, 0) / alive.length : 0;
    const avgFaith = alive.length > 0 ? alive.reduce((a, h) => a + h.faith, 0) / alive.length : 0;
    const avgWisdom = alive.length > 0 ? alive.reduce((a, h) => a + h.wisdom, 0) / alive.length : 0;

    res.json({
        population: alive.length,
        avgAge: Math.round(avgAge * 10) / 10,
        avgFaith: Math.round(avgFaith),
        avgWisdom: Math.round(avgWisdom),
        pregnant: alive.filter(h => h.pregnant).length,
        couples: alive.filter(h => h.partner).length / 2,
        maxGeneration: Math.max(...[...humans.values()].map(h => h.gen), 1),
        knowledgeSpread: {
            fire: alive.filter(h => h.knowledge.fire).length,
            tools: alive.filter(h => h.knowledge.tools).length,
            hunting: alive.filter(h => h.knowledge.hunting).length,
            building: alive.filter(h => h.knowledge.building).length
        },
        biomeDistribution: (() => {
            const dist = {};
            alive.forEach(h => {
                const b = h.getBiome().name;
                dist[b] = (dist[b] || 0) + 1;
            });
            return dist;
        })()
    });
});

// ==================== ADMIN: ACTIVE SESSIONS ====================
app.get('/admin/sessions', (req, res) => {
    const sessionList = [];
    for (const [id, s] of sessions) {
        sessionList.push({
            id: id.substring(0, 8),
            createdAt: new Date(s.createdAt).toISOString(),
            lastActivity: new Date(s.lastActivity).toISOString(),
            language: s.LANGUAGE,
            day: s.world?.day || 0,
            population: s.humans?.size || 0,
            phase: s.world?.phase || 'unknown'
        });
    }
    res.json({
        totalSessions: sessions.size,
        sessions: sessionList
    });
});

// ==================== SERVER ====================
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Required for Railway/Docker

app.listen(PORT, HOST, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║        🌍 GENESIS - MASSIVE AI SIMULATION 🌍                   ║
║                 http://localhost:${PORT}                           ║
╠════════════════════════════════════════════════════════════════╣
║  ✨ FEATURES:                                                  ║
║  🔐 Sessions: Each user has their own simulation               ║
║  🌳 Eden: Paradise WITHOUT physical needs                      ║
║  🍎 Temptation: Deep psychological and personalized            ║
║  👥 Scalable: Up to ${String(CONFIG.MAX_POPULATION).padEnd(4)} humans with individual AI            ║
║  🧠 Each mind: An independent call to DeepSeek                 ║
║  📊 Logging: Every thought, conversation and decision          ║
║  🐍 Free will: They can choose to sin or resist                ║
║  🔥 Discoveries: Fire, tools, agriculture...                   ║
║  📥 Reports: Downloadable in full JSON                         ║
╠════════════════════════════════════════════════════════════════╣
║  📊 Admin: /admin/sessions - View active sessions              ║
╚════════════════════════════════════════════════════════════════╝
`);
});
