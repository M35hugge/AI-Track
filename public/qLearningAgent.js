class QLearningAgent {
    constructor(actionSpace, learningRate = 0.1, discountFactor = 0.9, explorationRate = 1.0, explorationDecay = 0.995) {
        this.actionSpace = actionSpace;
        this.learningRate = learningRate;  // How quickly the agent updates its Q-values
        this.discountFactor = discountFactor;  // How much to discount future rewards
        this.explorationRate = explorationRate;  // Probability of taking a random action (exploration vs exploitation)
        this.explorationDecay = explorationDecay;  // How much to decay the exploration rate

        this.qTable = {};  // A table to store Q-values: { state: { action: value } }
    }
    getState(car) {
        // Create a state based on the car's position and velocity
        return `${Math.floor(car.x / 50)}-${Math.floor(car.y / 50)}-${Math.floor(car.vx)}-${Math.floor(car.vy)}`;
    }
    getQValue(state, action) {
        if (!this.qTable[state]) {
            this.qTable[state] = {};  // Initialize the state in Q-table if it's not there
        }
        return this.qTable[state][action] || 0;  // Return Q-value, defaulting to 0 if not yet learned
    }

    updateQValue(state, action, reward, nextState) {
        const nextStateQValues = this.qTable[nextState] || {};  // Ensure nextState is defined
        const maxNextQ = Math.max(...Object.values(nextStateQValues));  // Max Q-value for next state
        const currentQ = this.getQValue(state, action);
        const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
    
        if (!this.qTable[state]) {
            this.qTable[state] = {};
        }
        this.qTable[state][action] = newQ;  // Update the Q-value in the table
        console.log(`State: ${state}, Action: ${action}, Q-value: ${this.qTable[state]?.[action]}`);

    }

    selectAction(state) {
        if (Math.random() < this.explorationRate) {
            // Exploration: choose a random action
            return this.actionSpace[Math.floor(Math.random() * this.actionSpace.length)];
        } else {
            // Exploitation: choose the best action based on current Q-values
            const actions = this.qTable[state] || {};
            return Object.keys(actions).reduce((a, b) => (actions[a] > actions[b] ? a : b), null);
        }
    }

    decayExploration() {
        this.explorationRate *= this.explorationDecay;  // Decay the exploration rate
    }
}
