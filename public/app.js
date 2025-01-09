// Initialize the canvas and context
const canvas = document.getElementById('trackCanvas');
const ctx = canvas.getContext('2d');
const socket = io();

canvas.width = 800;
canvas.height = 600;

// Track and simulation variables
let trackData = [];
let isDrawing = false;
let raceStarted = false;
let raceFinished = false;
let cumulativeReward = 0;
let collisions = 0;

// Exploration/Exploitation counters
let explorationCount = 0;
let exploitationCount = 0;

// Create a QLearningAgent with possible actions: 'left', 'right', 'straight'
const actionSpace = ['left', 'right', 'straight'];
const agent = new QLearningAgent(actionSpace);
let brake=false;
// Car class
class Car {
    constructor(x, y, color, agent) {
        this.x = x;
        this.y = y;
        this.vx = 0;  // Velocity in x direction
        this.vy = 0;  // Velocity in y direction
        this.acceleration = 0.3; // Rate of acceleration
       
        this.maxSpeed = 10;  // Maximum speed
        this.angle = 0;
        this.maxSteeringAngle = 0.1;
        this.color = color;
        this.startX = x;
        this.startY = y;
        this.agent = agent;
        this.friction = 0.98;  // Friction coefficient to simulate drag
    }

    move(trackData) {
        if (trackData.length > 0) {
            const target = trackData[0];  // Get the first point of the track
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            this.angle = Math.atan2(dy, dx);

            // Apply physics: calculate acceleration based on action and friction
            this.vx += Math.cos(this.angle) * this.acceleration;
            this.vy += Math.sin(this.angle) * this.acceleration;
            // Apply friction: reduce speed over time
            this.vx *= this.friction;
            this.vy *= this.friction;

            // Limit speed
            const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
            if (speed > this.maxSpeed) {
                this.vx = (this.vx / speed) * this.maxSpeed;
                this.vy = (this.vy / speed) * this.maxSpeed;
            }
            if (brake) {
                this.vx *= 0.5;  // Apply a braking factor, decelerating the car
                this.vy *= 0.5;  // Apply the same braking factor to vertical velocity
            }
            // Update position
            this.x += this.vx;
            this.y += this.vy;

            // Check if the car hits the wall
            const hitboxRadius = 20;
            if (this.x-hitboxRadius< 0 || this.x+hitboxRadius > canvas.width || this.y-hitboxRadius < 0 || this.y+hitboxRadius > canvas.height) {
                console.log(`${this.color} car hit the wall! Restarting...`);
                this.resetPosition();
                return;
            }
            const tolerance=20;
            if (Math.abs(dx) < tolerance && Math.abs(dy) < tolerance) {
                trackData.shift();  // Remove the point we've passed
            }
        }

        // Q-learning decision-making
        const currentState = this.getState();
        const action = this.agent.selectAction(currentState);
        this.performAction(action);

        // After moving, update Q-values
        const nextState = this.getNextState(action);
        const reward = this.getReward(nextState);
        this.agent.updateQValue(currentState, action, reward, nextState);

        this.agent.decayExploration();  // Reduce exploration over time
    }

    resetPosition() {
        this.x = this.startX;
        this.y = this.startY;
        this.vx = 0;
        this.vy = 0;
    }

    performAction(action) {
        switch (action) {
            case 'left':
                this.angle -= this.maxSteeringAngle;
                break;
            case 'right':
                this.angle += this.maxSteeringAngle;
                break;
            case 'straight':
                // Accelerate forward by modifying vx, vy
                break;
        }
    }

    resetPosition() {
        this.x = this.startX;
        this.y = this.startY;
    }

    // Get the current state representation (position and angle)
    getState() {
        return `${Math.floor(this.x / 50)}-${Math.floor(this.y / 50)}-${Math.floor(this.angle / Math.PI * 180)}`;
    }

    getNextState(action) {
        let nextAngle = this.angle;

        switch (action) {
            case 'left':
                nextAngle -= this.maxSteeringAngle;
                break;
            case 'right':
                nextAngle += this.maxSteeringAngle;
                break;
        }

        const nextX = this.x + Math.cos(nextAngle) * this.speed;
        const nextY = this.y + Math.sin(nextAngle) * this.speed;

        return `${Math.floor(nextX / 50)}-${Math.floor(nextY / 50)}-${Math.floor(nextAngle / Math.PI * 180)}`;
    }

    getReward(nextState) {
        if (nextState.includes('out-of-bounds')) {
            collisions++;
            return -1;  // Penalty for hitting the wall
        }
        cumulativeReward++;
        return 1;  // Reward for making progress
    }
}

// Create car instances
const cars = [new Car(150, 150, 'red', agent)];

// Draw the background and track
function drawBackground() {
    let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#21b54c');
    gradient.addColorStop(1, '#259345');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Draw the walls (boundaries of the canvas)
function drawWall() {
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
}

// Draw the track from the track data
function drawTrack(trackData) {
    if (!trackData || trackData.length === 0) return;

    ctx.setLineDash([10, 5]);
    ctx.lineWidth = 15;
    ctx.strokeStyle = 'darkgray';

    ctx.beginPath();
    ctx.moveTo(trackData[0].x, trackData[0].y);
    for (let i = 1; i < trackData.length; i++) {
        ctx.lineTo(trackData[i].x, trackData[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
}

// Function to visualize Q-values for debugging
function drawQValues(car) {
    const state = car.getState();
    const qValues = agent.qTable[state] || {};  // Get Q-values for the current state (or empty object if none)
    const actions = Object.entries(qValues);  // Extract the action-value pairs

    ctx.font = '12px Arial';
    ctx.fillStyle = 'black';

    let yOffset = -15;
    actions.forEach(([action, value]) => {
        if (!isFinite(value)) {  // If the Q-value is NaN or Infinity, don't display it
            value = 0;  // Default to 0 for invalid Q-values
        }
        ctx.fillText(`${action}: ${value.toFixed(2)}`, car.x + 15, car.y + yOffset);
        yOffset -= 15;
    });
}


// Main update function to draw cars and update their movement
function updateCars() {
    if (raceStarted && !raceFinished && trackData && trackData.length > 0) {
        drawBackground();
        drawTrack(trackData);
        drawWall();

        cars.forEach((car) => {
            if (Math.abs(car.dx) < 50 && Math.abs(car.dy) < 50) {  // The car is near the target
                car.move(trackData, true);  // Apply braking as the car approaches the target
            } else {
                car.move(trackData);  // Move normally
            }
            ctx.beginPath();
            ctx.arc(car.x, car.y, 20, 0, Math.PI * 2);
            ctx.fillStyle = car.color;
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();

            drawQValues(car);  // Visualize Q-values for debugging
        });
    } else if (raceStarted && !raceFinished && trackData.length === 0) {
        console.log("Cars have finished the track.");
        raceFinished = true;
    }
}

// Set an interval to update the car's movements
setInterval(updateCars, 30);

// Track drawing event listeners
canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
});

canvas.addEventListener('mousemove', (e) => {
    if (isDrawing) {
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        trackData.push({ x: e.offsetX, y: e.offsetY });
    }
});

canvas.addEventListener('mouseup', () => {
    isDrawing = false;
    socket.emit('trackData', trackData);

    if (trackData && trackData.length > 0) {
        cars.forEach(car => {
            car.x = trackData[0].x;
            car.y = trackData[0].y;
        });
        raceStarted = true;
    }
});

// Export Q-table as a JSON file
function exportQTable() {
    const qTableJSON = JSON.stringify(agent.qTable, null, 2);
    const blob = new Blob([qTableJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'qTable.json';
    link.click();
}

// Log exploration vs exploitation count periodically
setInterval(() => {
    console.log(`Exploration: ${explorationCount}, Exploitation: ${exploitationCount}`);
}, 1000);

// Allow Q-table export through keyboard (press 'e' to export)
document.addEventListener('keydown', (e) => {
    if (e.key === 'e') {
        exportQTable();
    }
});
