class OneLinePuzzleGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentLevel = 1;
        this.levels = [];
        this.gameState = {
            path: [],
            visitedNodes: new Set(),
            visitedEdges: new Map(),
            currentNode: null,
            isDrawing: false,
            mousePos: null
        };
        this.history = [];
        this.audioContext = null;
        
        this.init();
    }
    
    async init() {
        await this.loadLevels();
        this.setupEventListeners();
        this.setupAudio();
        this.startLevel(1);
        this.render();
    }
    
    async loadLevels() {
        try {
            const response = await fetch('/api/levels');
            const data = await response.json();
            this.levels = data.levels;
            this.populateLevelSelect();
        } catch (error) {
            console.error('Failed to load levels:', error);
            this.loadFallbackLevels();
        }
    }
    
    loadFallbackLevels() {
        this.levels = [
            {
                id: 1,
                name: "初识一笔",
                description: "连接所有节点，完成一笔画",
                nodes: [
                    {id: "n1", x: 150, y: 200, type: "normal"},
                    {id: "n2", x: 350, y: 200, type: "normal"},
                    {id: "n3", x: 250, y: 350, type: "normal"}
                ],
                connections: [
                    {from: "n1", to: "n2", type: "straight"},
                    {from: "n2", to: "n3", type: "straight"},
                    {from: "n3", to: "n1", type: "straight"}
                ],
                startNode: "n1",
                requiredVisits: {"n1": 1, "n2": 1, "n3": 1}
            }
        ];
        this.populateLevelSelect();
    }
    
    populateLevelSelect() {
        const levelList = document.getElementById('level-list');
        levelList.innerHTML = '';
        
        this.levels.forEach(level => {
            const levelItem = document.createElement('div');
            levelItem.className = 'level-item';
            levelItem.textContent = level.id;
            levelItem.dataset.levelId = level.id;
            levelItem.addEventListener('click', () => {
                this.startLevel(level.id);
                document.getElementById('level-modal').classList.add('hidden');
            });
            levelList.appendChild(levelItem);
        });
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
        
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        document.getElementById('reset-btn').addEventListener('click', this.resetLevel.bind(this));
        document.getElementById('undo-btn').addEventListener('click', this.undo.bind(this));
        document.getElementById('level-select-btn').addEventListener('click', () => {
            document.getElementById('level-modal').classList.remove('hidden');
        });
        document.getElementById('close-modal-btn').addEventListener('click', () => {
            document.getElementById('level-modal').classList.add('hidden');
        });
        document.getElementById('next-level-btn').addEventListener('click', () => {
            document.getElementById('win-overlay').classList.add('hidden');
            if (this.currentLevel < this.levels.length) {
                this.startLevel(this.currentLevel + 1);
            } else {
                this.showAllLevelsComplete();
            }
        });
    }
    
    setupAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }
    
    playSound(type) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        switch(type) {
            case 'click':
                oscillator.frequency.value = 440;
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.1);
                break;
            case 'success':
                oscillator.frequency.value = 523.25;
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                oscillator.start();
                setTimeout(() => {
                    const osc2 = this.audioContext.createOscillator();
                    const gain2 = this.audioContext.createGain();
                    osc2.connect(gain2);
                    gain2.connect(this.audioContext.destination);
                    osc2.frequency.value = 659.25;
                    gain2.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    osc2.start();
                    osc2.stop(this.audioContext.currentTime + 0.2);
                }, 150);
                oscillator.stop(this.audioContext.currentTime + 0.15);
                break;
            case 'error':
                oscillator.frequency.value = 200;
                oscillator.type = 'sawtooth';
                gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.2);
                break;
        }
    }
    
    startLevel(levelId) {
        const level = this.levels.find(l => l.id === levelId);
        if (!level) return;
        
        this.currentLevel = levelId;
        this.gameState = {
            path: [],
            visitedNodes: new Set([level.startNode]),
            visitedEdges: new Map(),
            currentNode: level.startNode,
            isDrawing: false,
            mousePos: null
        };
        this.history = [];
        
        document.getElementById('current-level').textContent = `关卡 ${level.id}`;
        document.getElementById('level-name').textContent = level.name;
        this.updateInfo();
        
        document.getElementById('error-overlay').classList.add('hidden');
        document.getElementById('win-overlay').classList.add('hidden');
        
        this.playSound('click');
    }
    
    resetLevel() {
        this.startLevel(this.currentLevel);
    }
    
    undo() {
        if (this.gameState.path.length === 0) return;
        
        const lastStep = this.gameState.path.pop();
        this.history.push(lastStep);
        
        const fromNode = lastStep.from;
        const toNode = lastStep.to;
        
        const edgeKey = this.getEdgeKey(fromNode, toNode);
        const revEdgeKey = this.getEdgeKey(toNode, fromNode);
        
        if (this.gameState.visitedEdges.has(edgeKey)) {
            const count = this.gameState.visitedEdges.get(edgeKey);
            if (count <= 1) {
                this.gameState.visitedEdges.delete(edgeKey);
            } else {
                this.gameState.visitedEdges.set(edgeKey, count - 1);
            }
        }
        
        if (this.gameState.visitedEdges.has(revEdgeKey)) {
            const count = this.gameState.visitedEdges.get(revEdgeKey);
            if (count <= 1) {
                this.gameState.visitedEdges.delete(revEdgeKey);
            } else {
                this.gameState.visitedEdges.set(revEdgeKey, count - 1);
            }
        }
        
        this.gameState.visitedNodes = new Set([lastStep.from]);
        this.gameState.path.forEach(step => {
            this.gameState.visitedNodes.add(step.to);
        });
        
        this.gameState.currentNode = lastStep.from;
        this.updateInfo();
        this.playSound('click');
    }
    
    getEdgeKey(from, to) {
        return `${from}-${to}`;
    }
    
    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        const clickedNode = this.getNodeAtPosition(pos);
        
        if (clickedNode) {
            if (this.gameState.currentNode === null) {
                const level = this.levels.find(l => l.id === this.currentLevel);
                if (clickedNode.id === level.startNode) {
                    this.gameState.currentNode = clickedNode.id;
                    this.gameState.isDrawing = true;
                    this.playSound('click');
                }
            } else if (clickedNode.id === this.gameState.currentNode) {
                this.gameState.isDrawing = true;
                this.gameState.mousePos = pos;
            }
        }
    }
    
    handleMouseMove(e) {
        if (this.gameState.isDrawing) {
            this.gameState.mousePos = this.getMousePos(e);
        }
    }
    
    handleMouseUp(e) {
        if (!this.gameState.isDrawing) return;
        
        const pos = this.getMousePos(e);
        const targetNode = this.getNodeAtPosition(pos);
        
        if (targetNode && targetNode.id !== this.gameState.currentNode) {
            this.tryConnectNode(targetNode.id);
        }
        
        this.gameState.isDrawing = false;
        this.gameState.mousePos = null;
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.handleMouseDown(mouseEvent);
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.handleMouseMove(mouseEvent);
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        const mouseEvent = new MouseEvent('mouseup', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.handleMouseUp(mouseEvent);
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    getNodeAtPosition(pos) {
        const level = this.levels.find(l => l.id === this.currentLevel);
        if (!level) return null;
        
        for (const node of level.nodes) {
            const distance = Math.sqrt(
                Math.pow(pos.x - node.x, 2) + 
                Math.pow(pos.y - node.y, 2)
            );
            
            if (distance < 25) {
                return node;
            }
        }
        return null;
    }
    
    tryConnectNode(targetNodeId) {
        const level = this.levels.find(l => l.id === this.currentLevel);
        const currentNodeId = this.gameState.currentNode;
        
        const connection = this.findConnection(currentNodeId, targetNodeId, level);
        
        if (!connection) {
            this.showError('两个节点之间没有连接！');
            return;
        }
        
        if (!this.canTraverseConnection(connection, currentNodeId, targetNodeId)) {
            this.showError('无法通过此连接！检查方向或次数限制。');
            return;
        }
        
        if (this.isNodeVisited(targetNodeId, level)) {
            this.showError('此节点已经访问过！');
            return;
        }
        
        this.connectNode(targetNodeId, connection, level);
    }
    
    findConnection(from, to, level) {
        for (const conn of level.connections) {
            if ((conn.from === from && conn.to === to) || 
                (conn.from === to && conn.to === from && conn.type !== 'oneway')) {
                return conn;
            }
        }
        return null;
    }
    
    canTraverseConnection(connection, from, to) {
        if (connection.type === 'oneway') {
            if (connection.direction === 'forward' && connection.from !== from) {
                return false;
            }
            if (connection.direction === 'backward' && connection.to !== from) {
                return false;
            }
        }
        
        if (connection.type === 'repeatable') {
            const edgeKey = this.getEdgeKey(from, to);
            const revEdgeKey = this.getEdgeKey(to, from);
            
            const forwardCount = this.gameState.visitedEdges.get(edgeKey) || 0;
            const backwardCount = this.gameState.visitedEdges.get(revEdgeKey) || 0;
            
            if (forwardCount + backwardCount >= connection.maxUses) {
                return false;
            }
        }
        
        if (connection.type === 'straight' || connection.type === 'bezier' || connection.type === 'oneway') {
            const edgeKey = this.getEdgeKey(from, to);
            const revEdgeKey = this.getEdgeKey(to, from);
            
            if (this.gameState.visitedEdges.has(edgeKey) || 
                this.gameState.visitedEdges.has(revEdgeKey)) {
                return false;
            }
        }
        
        return true;
    }
    
    isNodeVisited(nodeId, level) {
        const node = level.nodes.find(n => n.id === nodeId);
        
        if (node.type === 'phantom') {
            return this.gameState.visitedNodes.has(nodeId);
        }
        
        return this.gameState.visitedNodes.has(nodeId);
    }
    
    connectNode(targetNodeId, connection, level) {
        const currentNodeId = this.gameState.currentNode;
        
        const edgeKey = this.getEdgeKey(currentNodeId, targetNodeId);
        if (this.gameState.visitedEdges.has(edgeKey)) {
            this.gameState.visitedEdges.set(edgeKey, this.gameState.visitedEdges.get(edgeKey) + 1);
        } else {
            this.gameState.visitedEdges.set(edgeKey, 1);
        }
        
        this.gameState.visitedNodes.add(targetNodeId);
        this.gameState.path.push({
            from: currentNodeId,
            to: targetNodeId,
            connection: connection
        });
        this.gameState.currentNode = targetNodeId;
        
        this.history = [];
        
        this.playSound('click');
        this.updateInfo();
        this.checkWinCondition();
    }
    
    updateInfo() {
        const level = this.levels.find(l => l.id === this.currentLevel);
        if (!level) return;
        
        document.getElementById('connections-count').textContent = this.gameState.path.length;
        
        const remaining = level.nodes.length - this.gameState.visitedNodes.size;
        document.getElementById('remaining-nodes').textContent = remaining;
    }
    
    checkWinCondition() {
        const level = this.levels.find(l => l.id === this.currentLevel);
        if (!level) return;
        
        const allNodesVisited = level.nodes.every(node => 
            this.gameState.visitedNodes.has(node.id)
        );
        
        if (allNodesVisited) {
            this.playWinAnimation();
        }
    }
    
    async playWinAnimation() {
        this.playSound('success');
        
        document.getElementById('win-overlay').classList.remove('hidden');
        
        const level = this.levels.find(l => l.id === this.currentLevel);
        if (level) {
            await this.drawIllustration(level.id);
        }
    }
    
    async drawIllustration(levelId) {
        const illustrations = {
            1: {
                type: 'star',
                points: [[250, 50], [270, 90], [310, 90], [280, 120], [290, 160], [250, 140], [210, 160], [220, 120], [190, 90], [230, 90]]
            },
            2: {
                type: 'heart',
                points: [[250, 100], [290, 60], [330, 60], [350, 80], [350, 120], [310, 170], [250, 220], [190, 170], [150, 120], [150, 80], [170, 60], [210, 60]]
            },
            3: {
                type: 'diamond',
                points: [[250, 50], [350, 150], [250, 250], [150, 150]]
            },
            4: {
                type: 'flower',
                points: [[250, 80], [280, 100], [300, 70], [290, 100], [320, 110], [290, 120], [300, 150], [280, 120], [250, 130], [220, 120], [200, 150], [210, 120], [180, 110], [210, 100], [200, 70], [220, 100]]
            },
            5: {
                type: 'moon',
                points: [[300, 80], [320, 100], [330, 130], [330, 170], [320, 200], [300, 220], [280, 200], [290, 180], [295, 150], [290, 120], [280, 100]]
            },
            6: {
                type: 'crown',
                points: [[150, 200], [170, 120], [210, 160], [250, 80], [290, 160], [330, 120], [350, 200], [330, 200], [310, 220], [190, 220], [170, 200]]
            }
        };
        
        const illustration = illustrations[levelId] || illustrations[1];
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const gradient = this.ctx.createLinearGradient(0, 0, 500, 400);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        this.ctx.fillStyle = gradient;
        
        this.ctx.beginPath();
        this.ctx.moveTo(illustration.points[0][0], illustration.points[0][1]);
        
        for (let i = 1; i < illustration.points.length; i++) {
            this.ctx.lineTo(illustration.points[i][0], illustration.points[i][1]);
        }
        
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.shadowColor = '#fff';
        this.ctx.shadowBlur = 20;
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
    }
    
    showError(message) {
        this.playSound('error');
        
        const errorText = document.getElementById('error-text');
        errorText.textContent = message;
        
        const errorOverlay = document.getElementById('error-overlay');
        errorOverlay.classList.remove('hidden');
        
        this.canvas.classList.add('shake');
        setTimeout(() => {
            this.canvas.classList.remove('shake');
            errorOverlay.classList.add('hidden');
        }, 1500);
    }
    
    showAllLevelsComplete() {
        this.playSound('success');
        
        const winMessage = document.querySelector('#win-overlay .win-message h2');
        const winText = document.querySelector('#win-overlay .win-message p');
        const nextBtn = document.getElementById('next-level-btn');
        
        winMessage.textContent = '🏆 恭喜通关所有关卡！';
        winText.textContent = '你已经完成了所有挑战，真是太棒了！';
        nextBtn.textContent = '重新开始';
        nextBtn.onclick = () => {
            document.getElementById('win-overlay').classList.add('hidden');
            winMessage.textContent = '🎉 恭喜通关!';
            winText.textContent = '你成功完成了一笔画!';
            nextBtn.textContent = '下一关';
            this.startLevel(1);
        };
        
        document.getElementById('win-overlay').classList.remove('hidden');
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const level = this.levels.find(l => l.id === this.currentLevel);
        if (!level) {
            requestAnimationFrame(this.render.bind(this));
            return;
        }
        
        this.drawConnections(level);
        this.drawPath(level);
        
        if (this.gameState.isDrawing && this.gameState.mousePos) {
            this.drawTemporaryLine(level);
        }
        
        this.drawNodes(level);
        
        requestAnimationFrame(this.render.bind(this));
    }
    
    drawConnections(level) {
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([]);
        
        for (const conn of level.connections) {
            const fromNode = level.nodes.find(n => n.id === conn.from);
            const toNode = level.nodes.find(n => n.id === conn.to);
            
            if (!fromNode || !toNode) continue;
            
            const edgeKey = this.getEdgeKey(conn.from, conn.to);
            const revEdgeKey = this.getEdgeKey(conn.to, conn.from);
            
            const isVisited = this.gameState.visitedEdges.has(edgeKey) || 
                             this.gameState.visitedEdges.has(revEdgeKey);
            
            if (isVisited) continue;
            
            this.ctx.strokeStyle = '#e0e0e0';
            this.ctx.setLineDash([]);
            
            this.ctx.beginPath();
            
            if (conn.type === 'bezier' && conn.controlPoints) {
                this.ctx.moveTo(fromNode.x, fromNode.y);
                this.ctx.bezierCurveTo(
                    conn.controlPoints[0][0], conn.controlPoints[0][1],
                    conn.controlPoints[0][0], conn.controlPoints[0][1],
                    toNode.x, toNode.y
                );
            } else {
                this.ctx.moveTo(fromNode.x, fromNode.y);
                this.ctx.lineTo(toNode.x, toNode.y);
            }
            
            this.ctx.stroke();
            
            if (conn.type === 'oneway') {
                this.drawArrow(fromNode, toNode, '#e0e0e0');
            }
            
            if (conn.type === 'repeatable') {
                this.ctx.setLineDash([]);
                this.ctx.fillStyle = '#9e9e9e';
                this.ctx.font = 'bold 14px Arial';
                this.ctx.textAlign = 'center';
                const midX = (fromNode.x + toNode.x) / 2;
                const midY = (fromNode.y + toNode.y) / 2;
                this.ctx.fillText(`×${conn.maxUses}`, midX, midY - 10);
            }
        }
    }
    
    drawArrow(from, to, color) {
        const headLength = 15;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(to.x, to.y);
        this.ctx.lineTo(
            to.x - headLength * Math.cos(angle - Math.PI / 6),
            to.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.lineTo(
            to.x - headLength * Math.cos(angle + Math.PI / 6),
            to.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    drawPath(level) {
        if (this.gameState.path.length === 0) return;
        
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = '#27ae60';
        this.ctx.setLineDash([]);
        this.ctx.shadowColor = '#27ae60';
        this.ctx.shadowBlur = 15;
        
        this.ctx.beginPath();
        
        const firstNode = level.nodes.find(n => n.id === this.gameState.path[0].from);
        if (firstNode) {
            this.ctx.moveTo(firstNode.x, firstNode.y);
        }
        
        for (const step of this.gameState.path) {
            const toNode = level.nodes.find(n => n.id === step.to);
            
            if (!toNode) continue;
            
            if (step.connection.type === 'bezier' && step.connection.controlPoints) {
                const fromNode = level.nodes.find(n => n.id === step.from);
                this.ctx.bezierCurveTo(
                    step.connection.controlPoints[0][0], step.connection.controlPoints[0][1],
                    step.connection.controlPoints[0][0], step.connection.controlPoints[0][1],
                    toNode.x, toNode.y
                );
            } else {
                this.ctx.lineTo(toNode.x, toNode.y);
            }
        }
        
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }
    
    drawTemporaryLine(level) {
        const currentNode = level.nodes.find(n => n.id === this.gameState.currentNode);
        if (!currentNode || !this.gameState.mousePos) return;
        
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.6)';
        this.ctx.setLineDash([10, 5]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(currentNode.x, currentNode.y);
        this.ctx.lineTo(this.gameState.mousePos.x, this.gameState.mousePos.y);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
    }
    
    drawNodes(level) {
        for (const node of level.nodes) {
            const isVisited = this.gameState.visitedNodes.has(node.id);
            const isCurrent = this.gameState.currentNode === node.id;
            
            let radius = 20;
            let color = '#667eea';
            
            if (node.type === 'phantom') {
                color = isVisited ? 'transparent' : '#9b59b6';
                if (isVisited) radius = 0;
            }
            
            if (isVisited && node.type !== 'phantom') {
                color = '#27ae60';
            }
            
            if (isCurrent) {
                color = '#e74c3c';
                radius = 25;
                
                this.ctx.shadowColor = '#e74c3c';
                this.ctx.shadowBlur = 20;
            }
            
            if (radius > 0) {
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
                this.ctx.fillStyle = color;
                this.ctx.fill();
                
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
                
                this.ctx.shadowBlur = 0;
                
                this.ctx.fillStyle = '#fff';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(node.id.replace('n', ''), node.x, node.y);
            }
            
            if (node.type === 'phantom' && !isVisited) {
                this.ctx.fillStyle = '#9b59b6';
                this.ctx.font = '10px Arial';
                this.ctx.fillText('👻', node.x, node.y + 30);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new OneLinePuzzleGame();
});
