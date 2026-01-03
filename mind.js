/**
 * La Mente del Agente
 * Sistema de IA que descubre las leyes físicas por sí misma
 * a través de la experiencia y el razonamiento inductivo
 */

class Mind {
    constructor() {
        // Sistema de creencias y conocimiento
        this.beliefs = new Map();
        this.hypotheses = [];
        this.discoveredLaws = [];
        this.memories = [];

        // Estado emocional/motivacional
        this.curiosity = 100;
        this.confusion = 0;
        this.satisfaction = 0;

        // Registro de pensamientos para mostrar al usuario
        this.thoughtStream = [];
        this.maxThoughts = 50;

        // Patrones que está buscando
        this.patterns = {
            position: [],
            velocity: [],
            falling: [],
            impacts: [],
            wind: [],
            light: [],
            temperature: []
        };

        // Contadores de experiencia
        this.experienceCount = {
            jumps: 0,
            falls: 0,
            impacts: 0,
            movementsLeft: 0,
            movementsRight: 0,
            timeInAir: 0,
            timeOnGround: 0
        };

        // Estado de experimentación
        this.experimentPhase = 'observación_inicial';
        this.currentExperiment = null;
        this.experimentResults = [];

        // Umbrales para formación de hipótesis
        this.CONFIDENCE_THRESHOLD = 0.7;
        this.PATTERN_MIN_SAMPLES = 5;

        // Iniciar con pensamientos existenciales
        this.awaken();
    }

    awaken() {
        this.think("¿Dónde... estoy?", "confusion");
        setTimeout(() => {
            this.think("Siento... algo. Hay sensaciones.", "perception");
        }, 1000);
        setTimeout(() => {
            this.think("Debo explorar. Necesito entender.", "hypothesis");
        }, 2500);
    }

    /**
     * Registra un pensamiento en el flujo de consciencia
     */
    think(thought, type = "neutral") {
        const entry = {
            time: Date.now(),
            text: thought,
            type: type // perception, hypothesis, discovery, confusion, action
        };

        this.thoughtStream.push(entry);
        if (this.thoughtStream.length > this.maxThoughts) {
            this.thoughtStream.shift();
        }

        return entry;
    }

    /**
     * Procesa la percepción actual y genera pensamientos
     */
    process(perception, agent) {
        // Guardar en memoria
        this.memories.push({
            time: perception.timestamp,
            data: JSON.parse(JSON.stringify(perception))
        });

        // Limitar memoria
        if (this.memories.length > 200) {
            this.memories = this.memories.slice(-150);
        }

        // Registrar patrones
        this.recordPatterns(perception);

        // Actualizar experiencia
        this.updateExperience(perception);

        // Pensar sobre lo que está pasando
        this.reflect(perception, agent);

        // Intentar descubrir leyes
        this.analyzePatterns();

        // Decidir siguiente acción
        return this.decide(perception, agent);
    }

    recordPatterns(perception) {
        const p = perception;

        this.patterns.position.push({
            t: p.timestamp,
            x: p.body.position.x,
            y: p.body.position.y
        });

        this.patterns.velocity.push({
            t: p.timestamp,
            vx: p.body.velocity.x,
            vy: p.body.velocity.y
        });

        if (!p.body.onGround) {
            this.patterns.falling.push({
                t: p.timestamp,
                vy: p.body.velocity.y,
                y: p.body.position.y
            });
        }

        if (p.touch.impactForce > 0) {
            this.patterns.impacts.push({
                t: p.timestamp,
                force: p.touch.impactForce,
                velocityBefore: this.getLastVelocity()
            });
        }

        this.patterns.wind.push({
            t: p.timestamp,
            speed: p.wind.speed,
            bodyVx: p.body.velocity.x
        });

        this.patterns.light.push({
            t: p.timestamp,
            brightness: p.vision.brightness,
            timeOfDay: p.timePerception.dayProgress
        });

        this.patterns.temperature.push({
            t: p.timestamp,
            temp: p.temperature.ambient,
            light: p.vision.brightness
        });

        // Mantener patrones recientes
        const maxPatterns = 100;
        for (const key of Object.keys(this.patterns)) {
            if (this.patterns[key].length > maxPatterns) {
                this.patterns[key] = this.patterns[key].slice(-maxPatterns);
            }
        }
    }

    getLastVelocity() {
        const vel = this.patterns.velocity;
        if (vel.length >= 2) {
            return vel[vel.length - 2].vy;
        }
        return 0;
    }

    updateExperience(perception) {
        if (perception.body.onGround) {
            this.experienceCount.timeOnGround++;
        } else {
            this.experienceCount.timeInAir++;
        }

        if (perception.touch.impactForce > 50) {
            this.experienceCount.impacts++;
        }
    }

    /**
     * Reflexiona sobre las percepciones actuales
     */
    reflect(perception, agent) {
        const p = perception;

        // Primeras observaciones básicas
        if (this.memories.length < 10) {
            if (p.body.onGround) {
                this.think("Siento presión debajo de mí. Algo me sostiene.", "perception");
            }
            if (p.vision.brightness > 0.5) {
                this.think("Hay luminosidad. Puedo... ¿ver?", "perception");
            }
            return;
        }

        // Observaciones sobre caída
        if (!p.body.onGround && p.body.velocity.y > 100) {
            if (!this.beliefs.has('gravity_noticed')) {
                this.think("¡Me muevo hacia abajo! ¿Por qué? No hice nada...", "confusion");
                this.beliefs.set('gravity_noticed', true);
            }
        }

        // Observaciones sobre impacto
        if (p.touch.impactForce > 100) {
            this.think(`¡Dolor! Impacto fuerte. Algo me detuvo abruptamente.`, "perception");

            if (this.experienceCount.impacts > 3 && !this.beliefs.has('impact_correlation')) {
                this.think("Noto que caer rápido causa más dolor al detenerse...", "hypothesis");
                this.beliefs.set('impact_correlation', true);
            }
        }

        // Observaciones sobre viento
        if (p.wind.speed > 5 && !this.beliefs.has('wind_felt')) {
            this.think("Siento algo empujándome. Es invisible pero real.", "perception");
            this.beliefs.set('wind_felt', true);
        }

        // Observaciones sobre luz y tiempo
        if (this.patterns.light.length > 30) {
            const recentLight = this.patterns.light.slice(-10);
            const avgLight = recentLight.reduce((a, b) => a + b.brightness, 0) / 10;

            if (avgLight < 0.3 && !this.beliefs.has('darkness_experienced')) {
                this.think("La luminosidad ha disminuido. ¿Se apaga el mundo?", "confusion");
                this.beliefs.set('darkness_experienced', true);
            }
        }

        // Observaciones sobre temperatura
        if (Math.abs(p.temperature.ambient - 20) > 10) {
            const feeling = p.temperature.feeling;
            if (!this.beliefs.has(`temp_${feeling}`)) {
                this.think(`Mi cuerpo siente ${feeling}. Nueva sensación.`, "perception");
                this.beliefs.set(`temp_${feeling}`, true);
            }
        }

        // Reflexiones sobre el propio movimiento
        if (this.experienceCount.jumps > 2 && !this.beliefs.has('jump_reflection')) {
            this.think("Cuando impulso hacia arriba, logro elevarme... pero siempre vuelvo abajo.", "hypothesis");
            this.beliefs.set('jump_reflection', true);
        }
    }

    /**
     * Analiza patrones para descubrir leyes
     */
    analyzePatterns() {
        this.checkGravityLaw();
        this.checkMomentumLaw();
        this.checkWindLaw();
        this.checkDayNightCycle();
        this.checkTemperatureLightCorrelation();
        this.checkFrictionLaw();
    }

    checkGravityLaw() {
        if (this.hasLaw('gravedad')) return;

        const falling = this.patterns.falling;
        if (falling.length < this.PATTERN_MIN_SAMPLES) return;

        // Analizar si la velocidad aumenta constantemente al caer
        let accelerationSamples = [];

        for (let i = 1; i < falling.length; i++) {
            const dt = falling[i].t - falling[i-1].t;
            if (dt > 0 && dt < 0.1) {
                const dv = falling[i].vy - falling[i-1].vy;
                accelerationSamples.push(dv / dt);
            }
        }

        if (accelerationSamples.length >= 3) {
            const avgAccel = accelerationSamples.reduce((a, b) => a + b, 0) / accelerationSamples.length;
            const variance = accelerationSamples.reduce((a, b) => a + Math.pow(b - avgAccel, 2), 0) / accelerationSamples.length;

            // Si la aceleración es consistente
            if (variance < 100 && avgAccel > 100) {
                this.think("¡DESCUBRIMIENTO! Cuando no estoy sostenido, mi velocidad hacia abajo AUMENTA constantemente.", "discovery");
                this.think(`Parece que hay una fuerza invisible que me atrae hacia abajo con aceleración constante.`, "discovery");

                this.addLaw({
                    name: 'gravedad',
                    description: 'Existe una fuerza constante que atrae todo hacia abajo',
                    formula: 'Al caer, la velocidad aumenta constantemente (~9.8 unidades por momento)',
                    confidence: Math.min(0.95, 0.5 + accelerationSamples.length * 0.05),
                    evidence: accelerationSamples.length
                });
            }
        }
    }

    checkMomentumLaw() {
        if (this.hasLaw('inercia')) return;

        const impacts = this.patterns.impacts;
        if (impacts.length < 3) return;

        // Correlación entre velocidad antes del impacto y fuerza
        let correlationData = impacts.filter(i => i.velocityBefore !== undefined);

        if (correlationData.length >= 3) {
            // Calcular correlación simple
            const velocities = correlationData.map(d => Math.abs(d.velocityBefore));
            const forces = correlationData.map(d => d.force);

            const avgV = velocities.reduce((a, b) => a + b, 0) / velocities.length;
            const avgF = forces.reduce((a, b) => a + b, 0) / forces.length;

            let correlation = 0;
            let vVar = 0, fVar = 0;

            for (let i = 0; i < velocities.length; i++) {
                correlation += (velocities[i] - avgV) * (forces[i] - avgF);
                vVar += Math.pow(velocities[i] - avgV, 2);
                fVar += Math.pow(forces[i] - avgF, 2);
            }

            const r = vVar > 0 && fVar > 0 ? correlation / Math.sqrt(vVar * fVar) : 0;

            if (r > 0.6) {
                this.think("¡DESCUBRIMIENTO! La fuerza del impacto está relacionada con qué tan rápido iba.", "discovery");
                this.think("A mayor velocidad, mayor es la fuerza al chocar. Como si el movimiento 'acumulara' algo.", "discovery");

                this.addLaw({
                    name: 'inercia',
                    description: 'Los objetos en movimiento resisten cambiar su estado',
                    formula: 'Fuerza de impacto ∝ Velocidad',
                    confidence: Math.min(0.9, r),
                    evidence: correlationData.length
                });
            }
        }
    }

    checkWindLaw() {
        if (this.hasLaw('viento_empuje')) return;

        const windData = this.patterns.wind;
        if (windData.length < 20) return;

        // Ver si hay correlación entre viento y movimiento
        let correlations = 0;
        let samples = 0;

        for (let i = 5; i < windData.length; i++) {
            if (windData[i].speed > 3) {
                // ¿Mi velocidad x tiende hacia la dirección del viento?
                if (windData[i].bodyVx > windData[i-5].bodyVx) {
                    correlations++;
                }
                samples++;
            }
        }

        if (samples >= 5 && correlations / samples > 0.6) {
            this.think("¡DESCUBRIMIENTO! Esa fuerza invisible que siento... me empuja en una dirección.", "discovery");
            this.think("Es como si el aire mismo pudiera ejercer fuerza sobre mí.", "discovery");

            this.addLaw({
                name: 'viento_empuje',
                description: 'El aire en movimiento ejerce fuerza sobre los objetos',
                formula: 'El viento empuja objetos en su dirección',
                confidence: correlations / samples,
                evidence: samples
            });
        }
    }

    checkDayNightCycle() {
        if (this.hasLaw('ciclo_día_noche')) return;

        const lightData = this.patterns.light;
        if (lightData.length < 50) return;

        // Buscar patrón cíclico
        let increases = 0;
        let decreases = 0;
        let maxLight = -1;
        let minLight = 2;

        for (let i = 1; i < lightData.length; i++) {
            if (lightData[i].brightness > lightData[i-1].brightness) increases++;
            else decreases++;

            maxLight = Math.max(maxLight, lightData[i].brightness);
            minLight = Math.min(minLight, lightData[i].brightness);
        }

        // Si hay variación significativa y ambos incrementos y decrementos
        if (maxLight - minLight > 0.5 && increases > 10 && decreases > 10) {
            this.think("¡DESCUBRIMIENTO! La luz no es constante. Aumenta y disminuye en un patrón.", "discovery");
            this.think("Hay períodos de luz intensa y períodos de oscuridad. Un ciclo se repite.", "discovery");

            this.addLaw({
                name: 'ciclo_día_noche',
                description: 'La luz sigue un ciclo regular de aumento y disminución',
                formula: 'Luz = f(tiempo), donde f es periódica',
                confidence: 0.85,
                evidence: lightData.length
            });
        }
    }

    checkTemperatureLightCorrelation() {
        if (this.hasLaw('luz_temperatura')) return;

        const tempData = this.patterns.temperature;
        if (tempData.length < 30) return;

        // Correlación luz-temperatura
        let correlation = 0;
        let n = tempData.length;

        const temps = tempData.map(d => d.temp);
        const lights = tempData.map(d => d.light);

        const avgT = temps.reduce((a, b) => a + b, 0) / n;
        const avgL = lights.reduce((a, b) => a + b, 0) / n;

        let num = 0, denT = 0, denL = 0;

        for (let i = 0; i < n; i++) {
            num += (temps[i] - avgT) * (lights[i] - avgL);
            denT += Math.pow(temps[i] - avgT, 2);
            denL += Math.pow(lights[i] - avgL, 2);
        }

        const r = denT > 0 && denL > 0 ? num / Math.sqrt(denT * denL) : 0;

        if (r > 0.5) {
            this.think("¡DESCUBRIMIENTO! Cuando hay más luz, siento más calor.", "discovery");
            this.think("La luz y la temperatura están conectadas. ¿La luz trae calor?", "discovery");

            this.addLaw({
                name: 'luz_temperatura',
                description: 'La intensidad de luz está correlacionada con la temperatura',
                formula: 'Temperatura ↑ cuando Luz ↑',
                confidence: r,
                evidence: n
            });
        }
    }

    checkFrictionLaw() {
        if (this.hasLaw('fricción')) return;

        // Observar desaceleración en el suelo
        const vel = this.patterns.velocity;
        let decelerations = [];

        for (let i = 1; i < vel.length; i++) {
            // Si estaba moviéndose en x y la velocidad disminuyó
            if (Math.abs(vel[i-1].vx) > 50 && Math.abs(vel[i].vx) < Math.abs(vel[i-1].vx)) {
                const decel = Math.abs(vel[i-1].vx) - Math.abs(vel[i].vx);
                if (decel > 0) decelerations.push(decel);
            }
        }

        if (decelerations.length >= 10) {
            const avgDecel = decelerations.reduce((a, b) => a + b, 0) / decelerations.length;

            if (avgDecel > 1) {
                this.think("¡DESCUBRIMIENTO! Cuando me muevo, algo me frena gradualmente.", "discovery");
                this.think("El movimiento no se mantiene solo. Una resistencia lo reduce.", "discovery");

                this.addLaw({
                    name: 'fricción',
                    description: 'El movimiento se reduce gradualmente por resistencia',
                    formula: 'Velocidad disminuye con el tiempo al moverse',
                    confidence: 0.75,
                    evidence: decelerations.length
                });
            }
        }
    }

    hasLaw(name) {
        return this.discoveredLaws.some(l => l.name === name);
    }

    addLaw(law) {
        if (!this.hasLaw(law.name)) {
            this.discoveredLaws.push(law);
            this.satisfaction += 20;
            this.curiosity = Math.min(100, this.curiosity + 10);
        }
    }

    /**
     * Decide qué acción tomar basándose en el conocimiento actual
     */
    decide(perception, agent) {
        const p = perception;

        // Fase 1: Observación inicial (primeros segundos)
        if (this.memories.length < 20) {
            this.experimentPhase = 'observación_inicial';
            this.think("Observando... absorbiendo información.", "action");
            return 'wait';
        }

        // Fase 2: Experimentación básica
        if (!this.hasLaw('gravedad') && this.experienceCount.jumps < 5) {
            if (p.body.onGround && agent.energy > 30) {
                this.experienceCount.jumps++;
                this.think("Voy a intentar impulsarme hacia arriba. ¿Qué pasará?", "action");
                return 'jump';
            }
        }

        // Fase 3: Exploración de movimiento
        if (!this.hasLaw('fricción') && p.body.onGround) {
            if (this.experienceCount.movementsRight < 10) {
                this.experienceCount.movementsRight++;
                if (this.experienceCount.movementsRight === 1) {
                    this.think("Intentaré moverme hacia un lado.", "action");
                }
                return 'move_right';
            } else if (this.experienceCount.movementsLeft < 10) {
                this.experienceCount.movementsLeft++;
                return 'move_left';
            }
        }

        // Fase 4: Experimentación avanzada
        if (this.discoveredLaws.length >= 3) {
            // Comportamiento más complejo basado en conocimiento
            if (p.body.energy < 30) {
                this.think("Energía baja. Debo descansar.", "action");
                return 'wait';
            }

            // Explorar el espacio
            if (Math.random() < 0.3) {
                const dir = Math.random() > 0.5 ? 'move_right' : 'move_left';
                this.think("Explorando más del espacio...", "action");
                return dir;
            }

            // Experimentar con alturas
            if (Math.random() < 0.2 && p.body.onGround) {
                this.think("Probando los límites de mi elevación.", "action");
                return 'jump';
            }
        }

        // Por defecto, observar
        if (Math.random() < 0.1) {
            this.think("Contemplando el mundo...", "perception");
        }
        return 'wait';
    }

    getThoughts() {
        return this.thoughtStream;
    }

    getLaws() {
        return this.discoveredLaws;
    }

    getState() {
        return {
            curiosity: this.curiosity,
            confusion: this.confusion,
            satisfaction: this.satisfaction,
            phase: this.experimentPhase,
            lawsDiscovered: this.discoveredLaws.length,
            totalExperiences: this.memories.length
        };
    }
}

window.Mind = Mind;
