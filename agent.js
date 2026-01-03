/**
 * El Cuerpo del Agente
 * Una entidad física que puede sentir y actuar en el mundo
 */

class Agent {
    constructor(x, y) {
        // Propiedades físicas
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 20;
        this.mass = 70; // kg (como un humano)
        this.onGround = false;
        this.impactForce = 0;

        // Energía y estado
        this.energy = 100;
        this.maxEnergy = 100;
        this.pain = 0;
        this.comfort = 50;

        // Historial sensorial (memoria a corto plazo)
        this.sensorHistory = [];
        this.maxHistoryLength = 100;

        // Acciones disponibles
        this.actions = {
            JUMP: 'jump',
            MOVE_LEFT: 'move_left',
            MOVE_RIGHT: 'move_right',
            STOP: 'stop',
            CROUCH: 'crouch',
            WAIT: 'wait',
            LOOK_AROUND: 'look_around'
        };

        // Estado actual de acción
        this.currentAction = null;
        this.actionCooldown = 0;

        // Lo que el agente "ve"
        this.vision = {
            objects: [],
            ground: null,
            sky: null,
            distanceToGround: 0
        };
    }

    /**
     * Lee todos los sensores del cuerpo
     */
    sense(physics) {
        const sensoryData = physics.getSensoryData(this);

        // Visión: qué objetos ve
        this.vision.objects = this.scanEnvironment(physics);
        this.vision.distanceToGround = 450 - this.y - this.radius;
        this.vision.sky = physics.getSkyColor();
        this.vision.sunPosition = physics.getSunPosition();

        // Construir percepción completa
        const perception = {
            timestamp: physics.time,

            // Propiocepción (sentido del propio cuerpo)
            body: {
                position: { x: this.x, y: this.y },
                velocity: { x: this.vx, y: this.vy },
                speed: Math.sqrt(this.vx * this.vx + this.vy * this.vy),
                onGround: this.onGround,
                energy: this.energy,
                pain: this.pain
            },

            // Sentidos externos
            touch: {
                groundContact: this.onGround,
                pressure: sensoryData.pressure,
                impactForce: this.impactForce,
                windOnSkin: sensoryData.windSpeed * 0.3
            },

            vision: {
                brightness: sensoryData.light,
                nearbyObjects: this.vision.objects,
                distanceToGround: this.vision.distanceToGround,
                canSeeSun: this.vision.sunPosition.visible,
                skyColor: this.vision.sky
            },

            temperature: {
                ambient: sensoryData.temperature,
                feeling: this.interpretTemperature(sensoryData.temperature)
            },

            wind: {
                speed: sensoryData.windSpeed,
                direction: sensoryData.windDirection > 0 ? 'derecha' : 'izquierda',
                feeling: this.interpretWind(sensoryData.windSpeed)
            },

            // Sentido interno del tiempo
            timePerception: {
                dayProgress: sensoryData.timeOfDay,
                isDay: sensoryData.light > 0.5,
                periodDescription: this.getTimePeriod(sensoryData.timeOfDay)
            }
        };

        // Guardar en historial
        this.sensorHistory.push(perception);
        if (this.sensorHistory.length > this.maxHistoryLength) {
            this.sensorHistory.shift();
        }

        // Resetear impacto después de sentirlo
        this.impactForce = 0;

        return perception;
    }

    /**
     * Escanea el entorno visual
     */
    scanEnvironment(physics) {
        const visible = [];

        for (const obj of physics.objects) {
            const dx = obj.x - this.x;
            const dy = obj.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 400) { // Rango de visión
                visible.push({
                    type: obj.type,
                    distance: distance,
                    direction: dx > 0 ? 'derecha' : 'izquierda',
                    relativeHeight: dy < 0 ? 'arriba' : 'abajo',
                    size: obj.width * obj.height
                });
            }
        }

        return visible;
    }

    interpretTemperature(temp) {
        if (temp < 5) return 'muy frío';
        if (temp < 15) return 'frío';
        if (temp < 22) return 'agradable';
        if (temp < 30) return 'cálido';
        return 'caluroso';
    }

    interpretWind(speed) {
        if (speed < 1) return 'calma';
        if (speed < 3) return 'brisa suave';
        if (speed < 6) return 'brisa moderada';
        if (speed < 10) return 'viento fuerte';
        return 'vendaval';
    }

    getTimePeriod(progress) {
        if (progress < 0.2) return 'noche';
        if (progress < 0.3) return 'amanecer';
        if (progress < 0.5) return 'mañana';
        if (progress < 0.65) return 'mediodía';
        if (progress < 0.75) return 'tarde';
        if (progress < 0.85) return 'atardecer';
        return 'noche';
    }

    /**
     * Ejecuta una acción física
     */
    executeAction(action) {
        if (this.actionCooldown > 0) return false;

        const energyCost = {
            jump: 10,
            move_left: 2,
            move_right: 2,
            stop: 0,
            crouch: 1,
            wait: 0,
            look_around: 1
        };

        const cost = energyCost[action] || 0;
        if (this.energy < cost) return false;

        this.energy -= cost;
        this.currentAction = action;

        switch (action) {
            case 'jump':
                if (this.onGround) {
                    this.vy = -350; // Fuerza de salto
                    this.onGround = false;
                    this.actionCooldown = 0.3;
                    return true;
                }
                break;

            case 'move_left':
                this.vx -= 50;
                this.vx = Math.max(this.vx, -200);
                this.actionCooldown = 0.05;
                return true;

            case 'move_right':
                this.vx += 50;
                this.vx = Math.min(this.vx, 200);
                this.actionCooldown = 0.05;
                return true;

            case 'stop':
                this.vx *= 0.5;
                return true;

            case 'wait':
                // Recuperar energía
                this.energy = Math.min(this.maxEnergy, this.energy + 0.1);
                return true;
        }

        return false;
    }

    /**
     * Actualiza el estado del agente
     */
    update(dt) {
        // Cooldown de acciones
        if (this.actionCooldown > 0) {
            this.actionCooldown -= dt;
        }

        // Recuperación pasiva de energía
        if (this.onGround && this.currentAction === 'wait') {
            this.energy = Math.min(this.maxEnergy, this.energy + dt * 2);
        }

        // Reducción del dolor
        this.pain = Math.max(0, this.pain - dt * 5);

        // Dolor por impacto
        if (this.impactForce > 100) {
            this.pain = Math.min(100, this.pain + this.impactForce * 0.1);
        }

        // Cálculo de confort
        this.calculateComfort();
    }

    calculateComfort() {
        let comfort = 50;

        // Más cómodo en el suelo
        if (this.onGround) comfort += 10;

        // Dolor reduce confort
        comfort -= this.pain * 0.5;

        // Energía baja reduce confort
        if (this.energy < 20) comfort -= 20;

        this.comfort = Math.max(0, Math.min(100, comfort));
    }

    /**
     * Obtiene el historial reciente de un sensor específico
     */
    getRecentHistory(sensorPath, count = 10) {
        const recent = this.sensorHistory.slice(-count);
        return recent.map(reading => {
            const parts = sensorPath.split('.');
            let value = reading;
            for (const part of parts) {
                value = value?.[part];
            }
            return { time: reading.timestamp, value };
        });
    }
}

window.Agent = Agent;
