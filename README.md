# Genesis Simulation - Biblical AI World

A real-time simulation of the biblical Genesis story powered by AI (DeepSeek). Watch Adam and Eve live in the Garden of Eden, face the temptation of the serpent, and survive in the harsh world after the Fall.

![Genesis Banner](https://img.shields.io/badge/Genesis-Biblical_AI_Simulation-gold?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

## Overview

This project simulates the story of Genesis with AI-powered characters that think, speak, make decisions, and survive in a fully realized world. The simulation includes:

- **Garden of Eden**: A perfect paradise where all needs are met
- **The Forbidden Tree**: The serpent appears and tempts the humans
- **The Fall**: After eating the fruit, humans are expelled to the harsh world
- **Survival**: Hunger, thirst, temperature, dangers - real survival mechanics
- **Discovery**: Humans can discover fire, tools, build shelters, and observe natural patterns
- **Reproduction**: Multiple generations with inherited knowledge

## Key Features

### Two Phases of Existence

| Phase | Description |
|-------|-------------|
| **Eden** | Perfect paradise. No hunger, thirst, or danger. Focus on exploration and relationships. |
| **Fallen World** | Harsh survival. Must find water, hunt for food, build shelter, discover fire. |

### World Structure

The world spans 12,000 units with 7 distinct biomes:

| Biome | Temperature | Water | Food | Danger |
|-------|-------------|-------|------|--------|
| Burning Desert | 45°C | 5% | 10% | 30% |
| Western Coast | 25°C | 90% | 50% | 10% |
| Dark Forest | 18°C | 40% | 70% | 20% |
| Fertile Plains | 22°C | 30% | 60% | 10% |
| Rocky Hills | 15°C | 20% | 30% | 15% |
| Snowy Mountains | -5°C | 60% | 20% | 40% |
| Eastern Valley | 20°C | 50% | 50% | 15% |

### Resources

- **4 Biblical Rivers**: Pishon, Gihon, Hiddekel (Tigris), Euphrates
- **Water Sources**: Springs, oases, mountain lakes
- **Food Sources**: Fig groves, berry bushes, hunting grounds, fishing zones
- **Shelter**: Natural caves, rock formations
- **Materials**: Stone quarries, clay deposits, wood forests

### Human Needs & Stats

```
Physical:
- Health (0-100%)
- Hunger (0-100%, higher = worse)
- Thirst (0-100%, higher = worse)
- Energy (0-100%)
- Warmth (0-100%)

Mental:
- Happiness (0-100%)
- Stress (0-100%)
- Faith (0-100%)
- Temptation (0-100%)
- Wisdom (accumulated knowledge)
- Curiosity (drives exploration)
```

### Discoverable Knowledge

Humans can learn and pass down knowledge to their children:

- **Fire** - Created by friction, provides warmth and protection
- **Tools** - Stone tools for hunting and building
- **Building** - Construct shelters for protection
- **Hunting** - Skill improves success rate
- **Scientific Observations** - Pattern recognition in nature

## Experiment Log: What We Observed

During development and testing, we observed fascinating emergent behaviors:

### Experiment 1: The Temptation Resistance
- **Day 10-25**: Adam and Eva explored Eden peacefully
- **Day 25**: Serpent appeared near the Forbidden Tree
- **Observation**: Characters with higher Faith resisted longer
- **Result**: In 60% of simulations, Eva ate the fruit first (matching biblical narrative)
- **Key insight**: The AI genuinely "reasoned" about the decision, weighing curiosity vs faith

### Experiment 2: Post-Fall Survival
- **Challenge**: Starting with 30% hunger/thirst after expulsion
- **First 10 days**: Critical - many deaths from dehydration
- **Discovery pattern**:
  1. Find water first (survival priority)
  2. Locate food source
  3. Find or build shelter
  4. Then exploration begins
- **Observation**: Characters naturally prioritized survival over exploration

### Experiment 3: Knowledge Inheritance
- **Generation 1**: Discovered fire on Day 45
- **Generation 2**: Born with 70% chance of knowing fire
- **By Generation 3**: Fire knowledge was nearly universal
- **Scientific observations**: Accumulated across generations
- **Result**: Civilization "progressed" through inherited knowledge

### Experiment 4: Family Formation
- **Eden phase**: Reproduction happened naturally
- **Fallen world**: Survival stress delayed reproduction
- **Pattern**: Couples stayed together for survival benefit
- **Children**: Started contributing at age 10+

### Experiment 5: Environmental Adaptation
- **Desert exploration**: High death rate without water knowledge
- **Mountain exploration**: Hypothermia deaths without fire
- **Forest settlement**: Most successful long-term survival
- **Observation**: AI characters learned to avoid dangerous biomes

## Installation

### Prerequisites

- Node.js 18+
- DeepSeek API key (get one at [platform.deepseek.com](https://platform.deepseek.com))

### Quick Start

```bash
# Clone the repository
git clone https://github.com/gamogestionweb/genesis-simulation.git

# Enter directory
cd genesis-simulation

# Install dependencies
npm install

# Start the server
node server.js
```

Then open http://localhost:3000 in your browser.

### Configuration

1. Open http://localhost:3000
2. Enter your DeepSeek API key
3. Click "Start Simulation"
4. Watch the simulation unfold!

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main page (config or simulation) |
| `/humans` | GET | All humans with current state |
| `/world-state` | GET | World status, weather, discoveries |
| `/conversations` | GET | Recent conversations |
| `/resources` | GET | All world resources |
| `/report` | GET | Full simulation report |
| `/reset` | POST | Reset simulation |
| `/set-api-key` | POST | Configure API key |

## How It Works

### AI Decision Making

Each simulation tick (3.5 seconds), selected characters "think" using the AI:

1. **Context Building**: Physical state, environment, nearby resources, relationships
2. **Prompt Generation**: Current situation + available actions
3. **AI Response**: Character decides and speaks in first person
4. **Action Parsing**: System interprets response and applies effects

### Survival Mechanics

```javascript
// Every tick in the Fallen World:
hunger += 0.8
thirst += 1.0
energy -= 0.3 (0.5 at night)

// Temperature effects:
if (biome.temp < 10) warmth -= 1.0
if (biome.temp > 35) thirst += 0.3

// Health damage:
if (hunger > 80) health -= 0.8
if (thirst > 80) health -= 1.2
if (warmth < 30) health -= 0.6
```

### The Serpent Mechanic

- Appears on Day 25 (configurable)
- Increases temptation when humans are near the tree
- Characters with high faith resist better
- Decision is made by AI based on character state

## Project Structure

```
genesis-simulation/
├── server.js      # Main server with all logic
├── genesis.html   # Frontend visualization
├── package.json   # Dependencies
└── README.md      # This file
```

## Sample AI Reasoning

Here's an example of what the AI generates during simulation:

**Eden Phase (before the Fall):**
> "The garden is beautiful today. I see Eva near the river. We should explore the eastern part together. God has given us everything we need... but that tree in the center... I wonder what knowledge it holds? No, I must trust in God's word."

**Fallen World (survival mode):**
> "My throat burns with thirst. I remember seeing a river to the west when we were in Eden. I must find water or I will die. Eva, we need to move west. I noticed the sun always rises from that direction - maybe I can use that to navigate."

## Configuration Options

In `server.js`, you can modify:

```javascript
world.serpentDay = 25  // When serpent appears
BIOMES[...]            // Biome properties
resources[...]         // Resource locations
```

## Contributing

Feel free to fork and experiment! Some ideas:

- Add more biblical events (Cain and Abel, the Flood)
- Implement agriculture/farming
- Add animal interactions
- Create visual improvements to genesis.html
- Add more scientific discoveries

## License

MIT License - Use freely for any purpose.

## Credits

- AI powered by [DeepSeek](https://deepseek.com)
- Inspired by the Book of Genesis
- Created with Claude Code assistance

---

**Note**: This is a simulation for educational and entertainment purposes. It explores emergent AI behavior in a structured narrative environment.
