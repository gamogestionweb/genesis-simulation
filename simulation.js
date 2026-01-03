/**
 * Simulación Principal
 * Conecta todos los sistemas y renderiza el mundo
 */

class Simulation {
    constructor() {
        this.canvas = document.getElementById('world-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.physics = new PhysicsEngine();
        this.agent = new Agent(400, 200); // Empieza en el aire
        this.mind = new Mind();

        this.paused = false;
        this.speed = 1;
        this.lastTime = 0;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.init();
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    init() {
        // Iniciar loop de simulación
        requestAnimationFrame((t) => this.loop(t));

        // Actualizar UI cada 100ms
        setInterval(() => this.updateUI(), 100);
    }

    loop(currentTime) {
        if (this.lastTime === 0) this.lastTime = currentTime;

        let dt = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Limitar dt para evitar saltos grandes
        dt = Math.min(dt, 0.05) * this.speed;

        if (!this.paused) {
            this.update(dt);
        }

        this.render();
        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        // Actualizar física del mundo
        this.physics.update(dt);

        // Aplicar física al agente
        this.physics.applyPhysics(this.agent, dt);

        // Actualizar estado del agente
        this.agent.update(dt);

        // El agente percibe el mundo
        const perception = this.agent.sense(this.physics);

        // La mente procesa y decide
        const action = this.mind.process(perception, this.agent);

        // Ejecutar acción decidida
        if (action) {
            this.agent.executeAction(action);
        }
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Limpiar
        ctx.clearRect(0, 0, w, h);

        // Cielo con gradiente dinámico
        this.renderSky(ctx, w, h);

        // Sol/Luna
        this.renderCelestialBodies(ctx);

        // Suelo
        this.renderGround(ctx, w, h);

        // Objetos del mundo
        this.renderWorldObjects(ctx);

        // Partículas de viento
        this.renderParticles(ctx);

        // Hojas
        this.renderLeaves(ctx);

        // Agente
        this.renderAgent(ctx);

        // Indicadores de física
        this.renderPhysicsIndicators(ctx);
    }

    renderSky(ctx, w, h) {
        const skyColor = this.physics.getSkyColor();
        const groundY = h * 0.75;

        const gradient = ctx.createLinearGradient(0, 0, 0, groundY);
        gradient.addColorStop(0, `rgb(${skyColor.r * 0.7}, ${skyColor.g * 0.7}, ${skyColor.b * 0.9})`);
        gradient.addColorStop(1, `rgb(${skyColor.r}, ${skyColor.g}, ${skyColor.b})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, groundY);

        // Estrellas de noche
        if (this.physics.lightIntensity < 0.3) {
            ctx.fillStyle = 'white';
            for (let i = 0; i < 50; i++) {
                const x = (i * 173) % w;
                const y = (i * 89) % (groundY * 0.7);
                const size = 1 + Math.sin(this.physics.time + i) * 0.5;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    renderCelestialBodies(ctx) {
        const sun = this.physics.getSunPosition();
        const h = this.canvas.height;

        // Escalar posición al canvas
        const sunX = (sun.x / 800) * this.canvas.width;
        const sunY = h * 0.75 - (450 - sun.y) * (h * 0.75 / 450);

        if (sun.visible && sunY < h * 0.75) {
            // Sol
            const gradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 40);
            gradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
            gradient.addColorStop(0.3, 'rgba(255, 220, 100, 1)');
            gradient.addColorStop(1, 'rgba(255, 180, 50, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(sunX, sunY, 40, 0, Math.PI * 2);
            ctx.fill();
        } else if (!sun.visible) {
            // Luna
            const moonX = this.canvas.width * 0.7;
            const moonY = h * 0.2;

            ctx.fillStyle = 'rgba(220, 220, 240, 0.9)';
            ctx.beginPath();
            ctx.arc(moonX, moonY, 25, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    renderGround(ctx, w, h) {
        const groundY = h * 0.75;

        // Tierra
        const gradient = ctx.createLinearGradient(0, groundY, 0, h);
        gradient.addColorStop(0, '#4a7c23');
        gradient.addColorStop(0.1, '#3d6b1e');
        gradient.addColorStop(1, '#2d4a15');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, groundY, w, h - groundY);

        // Hierba
        ctx.strokeStyle = '#5a9c33';
        ctx.lineWidth = 2;
        for (let x = 0; x < w; x += 8) {
            const windOffset = Math.sin(this.physics.time * 2 + x * 0.05) *
                              this.physics.windSpeed * 0.5;
            ctx.beginPath();
            ctx.moveTo(x, groundY);
            ctx.quadraticCurveTo(x + windOffset, groundY - 10, x + windOffset * 0.5, groundY - 15);
            ctx.stroke();
        }
    }

    renderWorldObjects(ctx) {
        const h = this.canvas.height;
        const scaleX = this.canvas.width / 800;
        const scaleY = (h * 0.75) / 450;
        const groundY = h * 0.75;

        for (const obj of this.physics.objects) {
            const x = obj.x * scaleX;
            const y = groundY - (450 - obj.y) * scaleY;

            if (obj.type === 'rock') {
                // Roca
                ctx.fillStyle = '#666';
                ctx.beginPath();
                ctx.ellipse(x + obj.width * scaleX / 2, y,
                           obj.width * scaleX / 2, obj.height * scaleY / 2,
                           0, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#888';
                ctx.beginPath();
                ctx.ellipse(x + obj.width * scaleX / 2 - 10, y - 5,
                           10, 8, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            if (obj.type === 'tree') {
                // Tronco
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(x, y - obj.height * scaleY,
                            obj.width * scaleX, obj.height * scaleY);

                // Copa del árbol
                const windOffset = Math.sin(this.physics.time * 1.5) *
                                  this.physics.windSpeed * 2;
                ctx.fillStyle = '#2e7d32';
                ctx.beginPath();
                ctx.arc(x + obj.width * scaleX / 2 + windOffset,
                       y - obj.height * scaleY - 40,
                       60, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#388e3c';
                ctx.beginPath();
                ctx.arc(x + obj.width * scaleX / 2 + windOffset + 20,
                       y - obj.height * scaleY - 20,
                       45, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    renderParticles(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        const scaleX = this.canvas.width / 800;
        const scaleY = (this.canvas.height * 0.75) / 450;

        for (const p of this.physics.particles) {
            ctx.beginPath();
            ctx.arc(p.x * scaleX, p.y * scaleY, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    renderLeaves(ctx) {
        const scaleX = this.canvas.width / 800;
        const scaleY = (this.canvas.height * 0.75) / 450;

        for (const leaf of this.physics.leaves) {
            ctx.save();
            ctx.translate(leaf.x * scaleX, leaf.y * scaleY);
            ctx.rotate(leaf.rotation);

            ctx.fillStyle = '#8bc34a';
            ctx.beginPath();
            ctx.ellipse(0, 0, leaf.size, leaf.size / 2, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    renderAgent(ctx) {
        const h = this.canvas.height;
        const scaleX = this.canvas.width / 800;
        const groundY = h * 0.75;
        const scaleY = groundY / 450;

        const x = this.agent.x * scaleX;
        const y = groundY - (450 - this.agent.y) * scaleY;
        const r = this.agent.radius * scaleX;

        // Sombra
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(x, groundY + 5, r * 1.2, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cuerpo principal
        const bodyGradient = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
        bodyGradient.addColorStop(0, '#6366f1');
        bodyGradient.addColorStop(1, '#4338ca');

        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Brillo
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Ojos (mirando hacia donde se mueve o hacia el sol)
        const lookDir = this.agent.vx !== 0 ? Math.sign(this.agent.vx) :
                       (this.physics.getSunPosition().visible ? 1 : 0);

        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x - 5 + lookDir * 2, y - 5, 6, 0, Math.PI * 2);
        ctx.arc(x + 8 + lookDir * 2, y - 5, 6, 0, Math.PI * 2);
        ctx.fill();

        // Pupilas
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath();
        ctx.arc(x - 4 + lookDir * 4, y - 5, 3, 0, Math.PI * 2);
        ctx.arc(x + 9 + lookDir * 4, y - 5, 3, 0, Math.PI * 2);
        ctx.fill();

        // Expresión basada en estado
        ctx.strokeStyle = '#1e1b4b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (this.agent.pain > 20) {
            // Dolor
            ctx.arc(x + 2, y + 8, 5, 0.2 * Math.PI, 0.8 * Math.PI);
        } else if (this.agent.comfort > 60) {
            // Feliz
            ctx.arc(x + 2, y + 5, 5, 0, Math.PI);
        } else {
            // Neutral/curioso
            ctx.moveTo(x - 3, y + 8);
            ctx.lineTo(x + 7, y + 8);
        }
        ctx.stroke();

        // Indicador de energía
        const energyWidth = r * 2;
        const energyHeight = 4;
        ctx.fillStyle = '#333';
        ctx.fillRect(x - energyWidth / 2, y - r - 15, energyWidth, energyHeight);
        ctx.fillStyle = this.agent.energy > 30 ? '#4ade80' : '#ef4444';
        ctx.fillRect(x - energyWidth / 2, y - r - 15,
                    energyWidth * (this.agent.energy / 100), energyHeight);

        // Vector de velocidad (para visualizar movimiento)
        if (Math.abs(this.agent.vx) > 10 || Math.abs(this.agent.vy) > 10) {
            ctx.strokeStyle = 'rgba(255, 200, 0, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + this.agent.vx * 0.1, y + this.agent.vy * 0.1);
            ctx.stroke();

            // Punta de flecha
            const angle = Math.atan2(this.agent.vy, this.agent.vx);
            ctx.beginPath();
            ctx.moveTo(x + this.agent.vx * 0.1, y + this.agent.vy * 0.1);
            ctx.lineTo(x + this.agent.vx * 0.1 - 8 * Math.cos(angle - 0.5),
                      y + this.agent.vy * 0.1 - 8 * Math.sin(angle - 0.5));
            ctx.moveTo(x + this.agent.vx * 0.1, y + this.agent.vy * 0.1);
            ctx.lineTo(x + this.agent.vx * 0.1 - 8 * Math.cos(angle + 0.5),
                      y + this.agent.vy * 0.1 - 8 * Math.sin(angle + 0.5));
            ctx.stroke();
        }
    }

    renderPhysicsIndicators(ctx) {
        // Flecha de viento
        if (this.physics.windSpeed > 2) {
            const windX = 100;
            const windY = 50;
            const windLength = this.physics.windSpeed * 8;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(windX, windY);
            ctx.lineTo(windX + windLength, windY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(windX + windLength, windY);
            ctx.lineTo(windX + windLength - 10, windY - 5);
            ctx.moveTo(windX + windLength, windY);
            ctx.lineTo(windX + windLength - 10, windY + 5);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '12px monospace';
            ctx.fillText(`Viento: ${this.physics.windSpeed.toFixed(1)} m/s`, windX, windY + 20);
        }
    }

    updateUI() {
        // Tiempo
        document.getElementById('sim-time').textContent =
            this.physics.time.toFixed(1);

        // Sensores
        const perception = this.agent.sensorHistory[this.agent.sensorHistory.length - 1];
        if (perception) {
            document.getElementById('vision-sensor').textContent =
                (perception.vision.brightness * 100).toFixed(0) + '%';
            document.getElementById('vision-sensor').style.color =
                perception.vision.brightness > 0.5 ? '#f1c40f' : '#3498db';

            document.getElementById('temp-sensor').textContent =
                perception.temperature.ambient.toFixed(1) + '°C';
            document.getElementById('temp-sensor').style.color =
                perception.temperature.ambient > 25 ? '#e74c3c' : '#3498db';

            document.getElementById('wind-sensor').textContent =
                perception.wind.feeling;
            document.getElementById('wind-sensor').style.color = '#9b59b6';

            document.getElementById('pressure-sensor').textContent =
                perception.touch.groundContact ? 'Suelo' : 'Aire';
            document.getElementById('pressure-sensor').style.color =
                perception.touch.groundContact ? '#2ecc71' : '#e74c3c';

            document.getElementById('position-sensor').textContent =
                `${perception.body.position.x.toFixed(0)}, ${perception.body.position.y.toFixed(0)}`;

            document.getElementById('energy-sensor').textContent =
                perception.body.energy.toFixed(0) + '%';
            document.getElementById('energy-sensor').style.color =
                perception.body.energy > 30 ? '#2ecc71' : '#e74c3c';

            document.getElementById('velocity-sensor').textContent =
                perception.body.speed.toFixed(1);

            document.getElementById('light-sensor').textContent =
                perception.timePerception.periodDescription;
        }

        // Pensamientos
        const thoughtsDiv = document.getElementById('thoughts');
        const thoughts = this.mind.getThoughts();
        const recentThoughts = thoughts.slice(-15);

        thoughtsDiv.innerHTML = recentThoughts.map(t => `
            <div class="thought ${t.type}">
                ${t.text}
            </div>
        `).join('');

        // Scroll al último pensamiento
        thoughtsDiv.scrollTop = thoughtsDiv.scrollHeight;

        // Leyes descubiertas
        const lawsDiv = document.getElementById('discovered-laws');
        const laws = this.mind.getLaws();

        lawsDiv.innerHTML = laws.map(l => `
            <div class="law">
                <strong>${l.name.toUpperCase()}</strong><br>
                ${l.description}<br>
                <em>${l.formula}</em>
                <span class="confidence">${(l.confidence * 100).toFixed(0)}%</span>
            </div>
        `).join('');
    }

    togglePause() {
        this.paused = !this.paused;
    }

    speedUp() {
        this.speed = this.speed >= 4 ? 1 : this.speed * 2;
    }

    reset() {
        this.physics = new PhysicsEngine();
        this.agent = new Agent(400, 200);
        this.mind = new Mind();
    }
}

// Iniciar simulación cuando la página cargue
let simulation;
window.addEventListener('load', () => {
    simulation = new Simulation();
});
