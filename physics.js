/**
 * Motor de Física Realista
 * Simula las leyes fundamentales del universo
 */

class PhysicsEngine {
    constructor() {
        // Constantes físicas fundamentales
        this.GRAVITY = 9.81;              // m/s²
        this.AIR_DENSITY = 1.225;         // kg/m³
        this.DRAG_COEFFICIENT = 0.47;     // Esfera
        this.FRICTION_GROUND = 0.6;       // Coeficiente de fricción
        this.RESTITUTION = 0.3;           // Elasticidad de colisiones

        // Estado del mundo
        this.time = 0;
        this.dayLength = 120;             // Segundos por día
        this.windSpeed = 0;
        this.windDirection = 0;
        this.temperature = 20;            // Celsius
        this.lightIntensity = 1;

        // Objetos en el mundo
        this.objects = [];
        this.ground = { y: 0, friction: 0.6 };

        // Partículas para efectos visuales
        this.particles = [];
        this.leaves = [];

        this.initializeWorld();
    }

    initializeWorld() {
        // Crear hojas que caen/vuelan con el viento
        for (let i = 0; i < 20; i++) {
            this.leaves.push({
                x: Math.random() * 800,
                y: Math.random() * 400,
                vx: 0,
                vy: 0,
                rotation: Math.random() * Math.PI * 2,
                size: 3 + Math.random() * 5
            });
        }

        // Crear algunos objetos estáticos
        this.objects.push({
            type: 'rock',
            x: 600,
            y: 0,
            width: 80,
            height: 50,
            mass: 1000,
            static: true
        });

        this.objects.push({
            type: 'tree',
            x: 200,
            y: 0,
            width: 30,
            height: 150,
            mass: 500,
            static: true
        });
    }

    update(dt) {
        this.time += dt;

        // Ciclo día/noche
        const dayProgress = (this.time % this.dayLength) / this.dayLength;
        this.updateDayCycle(dayProgress);

        // Simular viento variable
        this.updateWind(dt);

        // Actualizar partículas de viento
        this.updateParticles(dt);

        // Actualizar hojas
        this.updateLeaves(dt);
    }

    updateDayCycle(progress) {
        // 0 = medianoche, 0.25 = amanecer, 0.5 = mediodía, 0.75 = atardecer
        if (progress < 0.25) {
            // Noche a amanecer
            this.lightIntensity = 0.1 + (progress / 0.25) * 0.3;
            this.temperature = 10 + progress * 20;
        } else if (progress < 0.5) {
            // Amanecer a mediodía
            this.lightIntensity = 0.4 + ((progress - 0.25) / 0.25) * 0.6;
            this.temperature = 15 + (progress - 0.25) * 40;
        } else if (progress < 0.75) {
            // Mediodía a atardecer
            this.lightIntensity = 1 - ((progress - 0.5) / 0.25) * 0.4;
            this.temperature = 25 - (progress - 0.5) * 20;
        } else {
            // Atardecer a noche
            this.lightIntensity = 0.6 - ((progress - 0.75) / 0.25) * 0.5;
            this.temperature = 20 - (progress - 0.75) * 40;
        }
    }

    updateWind(dt) {
        // Viento con variación natural (ruido Perlin simplificado)
        const windChange = (Math.sin(this.time * 0.1) + Math.sin(this.time * 0.23) * 0.5) * 0.5;
        this.windSpeed = 2 + windChange * 8; // 0-10 m/s
        this.windDirection = Math.sin(this.time * 0.05) * 0.3; // Variación leve
    }

    updateParticles(dt) {
        // Crear nuevas partículas de polvo/aire si hay viento
        if (this.windSpeed > 3 && Math.random() < 0.1) {
            this.particles.push({
                x: 0,
                y: 100 + Math.random() * 300,
                vx: this.windSpeed * 10,
                vy: (Math.random() - 0.5) * 2,
                life: 5,
                size: 1 + Math.random() * 2
            });
        }

        // Actualizar partículas existentes
        this.particles = this.particles.filter(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            return p.life > 0 && p.x < 900;
        });
    }

    updateLeaves(dt) {
        for (const leaf of this.leaves) {
            // Aplicar viento
            const windForce = this.windSpeed * 0.5;
            leaf.vx += windForce * dt;
            leaf.vy += this.GRAVITY * 0.1 * dt; // Caída lenta

            // Resistencia del aire
            leaf.vx *= 0.99;
            leaf.vy *= 0.99;

            // Movimiento oscilante natural
            leaf.vx += Math.sin(this.time * 3 + leaf.x * 0.1) * 0.5 * dt;

            // Actualizar posición
            leaf.x += leaf.vx;
            leaf.y += leaf.vy;
            leaf.rotation += leaf.vx * 0.1 * dt;

            // Rebote en el suelo
            if (leaf.y > 450) {
                leaf.y = 450;
                leaf.vy = -leaf.vy * 0.3;
            }

            // Wrap horizontal
            if (leaf.x > 850) leaf.x = -10;
            if (leaf.x < -10) leaf.x = 850;
        }
    }

    /**
     * Aplica física a un cuerpo dinámico
     */
    applyPhysics(body, dt) {
        // Guardar estado anterior
        const prevVy = body.vy;

        // 1. GRAVEDAD
        if (!body.onGround) {
            body.vy += this.GRAVITY * dt * 50; // Escala para pixeles
        }

        // 2. RESISTENCIA DEL AIRE (Drag)
        const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
        if (speed > 0) {
            const dragForce = 0.5 * this.AIR_DENSITY * this.DRAG_COEFFICIENT *
                             (body.radius * 0.01) * (body.radius * 0.01) * speed * speed;
            const dragAccel = dragForce / body.mass;

            body.vx -= (body.vx / speed) * dragAccel * dt * 10;
            body.vy -= (body.vy / speed) * dragAccel * dt * 10;
        }

        // 3. VIENTO
        if (!body.onGround) {
            body.vx += this.windSpeed * 0.5 * dt;
        }

        // 4. FRICCIÓN EN EL SUELO
        if (body.onGround) {
            body.vx *= (1 - this.FRICTION_GROUND * dt * 5);
        }

        // 5. ACTUALIZAR POSICIÓN
        body.x += body.vx * dt;
        body.y += body.vy * dt;

        // 6. COLISIÓN CON EL SUELO
        const groundY = 450 - body.radius;
        if (body.y >= groundY) {
            body.y = groundY;

            // Impacto
            if (prevVy > 50) {
                body.impactForce = prevVy * body.mass * 0.01;
            }

            // Rebote
            if (Math.abs(body.vy) > 10) {
                body.vy = -body.vy * this.RESTITUTION;
            } else {
                body.vy = 0;
                body.onGround = true;
            }
        } else {
            body.onGround = false;
        }

        // 7. LÍMITES DEL MUNDO
        if (body.x < body.radius) {
            body.x = body.radius;
            body.vx = -body.vx * 0.5;
        }
        if (body.x > 800 - body.radius) {
            body.x = 800 - body.radius;
            body.vx = -body.vx * 0.5;
        }

        // 8. COLISIONES CON OBJETOS
        for (const obj of this.objects) {
            if (this.checkCollision(body, obj)) {
                this.resolveCollision(body, obj);
            }
        }

        return {
            gravity: this.GRAVITY,
            airResistance: speed > 0 ? dragForce : 0,
            windForce: this.windSpeed,
            friction: body.onGround ? this.FRICTION_GROUND : 0,
            onGround: body.onGround,
            impactForce: body.impactForce || 0
        };
    }

    checkCollision(body, obj) {
        return body.x + body.radius > obj.x &&
               body.x - body.radius < obj.x + obj.width &&
               body.y + body.radius > obj.y &&
               body.y - body.radius < obj.y + obj.height;
    }

    resolveCollision(body, obj) {
        // Encontrar el lado de colisión más cercano
        const overlapLeft = (body.x + body.radius) - obj.x;
        const overlapRight = (obj.x + obj.width) - (body.x - body.radius);
        const overlapTop = (body.y + body.radius) - obj.y;
        const overlapBottom = (obj.y + obj.height) - (body.y - body.radius);

        const minOverlapX = Math.min(overlapLeft, overlapRight);
        const minOverlapY = Math.min(overlapTop, overlapBottom);

        if (minOverlapX < minOverlapY) {
            if (overlapLeft < overlapRight) {
                body.x = obj.x - body.radius;
            } else {
                body.x = obj.x + obj.width + body.radius;
            }
            body.vx = -body.vx * this.RESTITUTION;
        } else {
            if (overlapTop < overlapBottom) {
                body.y = obj.y - body.radius;
                body.onGround = true;
                if (body.vy > 0) body.vy = 0;
            } else {
                body.y = obj.y + obj.height + body.radius;
                body.vy = -body.vy * this.RESTITUTION;
            }
        }
    }

    /**
     * Calcula lo que "siente" un cuerpo en su posición
     */
    getSensoryData(body) {
        // Calcular luz basada en posición y hora
        let localLight = this.lightIntensity;

        // Sombras de objetos (simplificado)
        for (const obj of this.objects) {
            if (obj.type === 'tree' &&
                body.x > obj.x - 50 && body.x < obj.x + 80 &&
                body.y > obj.y - obj.height) {
                localLight *= 0.5; // En sombra
            }
        }

        // Temperatura afectada por luz y altura
        let localTemp = this.temperature;
        localTemp -= (450 - body.y) * 0.01; // Más frío arriba
        if (localLight < 0.5) localTemp -= 5; // Más frío en sombra

        // Presión en el cuerpo
        const pressure = body.onGround ? body.mass * this.GRAVITY : 0;

        return {
            light: localLight,
            temperature: localTemp,
            windSpeed: this.windSpeed,
            windDirection: this.windDirection,
            pressure: pressure,
            altitude: 450 - body.y,
            timeOfDay: (this.time % this.dayLength) / this.dayLength
        };
    }

    getSkyColor() {
        const dayProgress = (this.time % this.dayLength) / this.dayLength;

        if (dayProgress < 0.2 || dayProgress > 0.85) {
            // Noche
            return { r: 10, g: 10, b: 40 };
        } else if (dayProgress < 0.3) {
            // Amanecer
            const t = (dayProgress - 0.2) / 0.1;
            return {
                r: 10 + t * 245,
                g: 10 + t * 150,
                b: 40 + t * 100
            };
        } else if (dayProgress < 0.7) {
            // Día
            return { r: 135, g: 206, b: 235 };
        } else {
            // Atardecer
            const t = (dayProgress - 0.7) / 0.15;
            return {
                r: 255 - t * 100,
                g: 160 - t * 80,
                b: 140 - t * 60
            };
        }
    }

    getSunPosition() {
        const dayProgress = (this.time % this.dayLength) / this.dayLength;
        const angle = (dayProgress - 0.25) * Math.PI; // 0.25 = amanecer en horizonte
        return {
            x: 400 + Math.cos(angle) * 350,
            y: 400 - Math.sin(angle) * 350,
            visible: dayProgress > 0.2 && dayProgress < 0.8
        };
    }
}

// Exportar para uso global
window.PhysicsEngine = PhysicsEngine;
