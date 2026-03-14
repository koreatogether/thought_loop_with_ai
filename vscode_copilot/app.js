const canvas = document.getElementById('thought-canvas');
const container = document.getElementById('canvas-container');
const svgLayer = document.getElementById('svg-layer');
const addRootBtn = document.getElementById('add-root');
const resetViewBtn = document.getElementById('reset-view');

let nodes = [];
let connections = [];
let isDraggingCanvas = false;
let startX, startY;
let scrollLeft, scrollTop;

// Physics Constants
const REPULSION_STRENGTH = 2000;
const SPRING_LENGTH = 180;
const SPRING_STRENGTH = 0.04;
const DAMPING = 0.8;
const MAX_SPEED = 15; // Stability: Prevents nodes from exploding
const EPSILON = 20;   // Stability: Min distance for repulsion

// Initialize
window.onload = () => {
    container.scrollLeft = 2500 - container.offsetWidth / 2;
    container.scrollTop = 2500 - container.offsetHeight / 2;
    createNode(2500, 2500, "핵심 주제를 적어보세요");
    updatePhysics();
};

// Physics Loop
function updatePhysics() {
    nodes.forEach(node => {
        if (node.isDragging) return;

        // 1. Repulsion
        nodes.forEach(other => {
            if (node.id === other.id) return;
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const distSq = dx * dx + dy * dy || EPSILON;
            const dist = Math.sqrt(distSq);
            
            // Limit force when very close (prevent explosion)
            const force = REPULSION_STRENGTH / Math.max(distSq, EPSILON * EPSILON);
            node.vx += (dx / dist) * force;
            node.vy += (dy / dist) * force;
        });

        // 2. Spring (Connections)
        connections.forEach(conn => {
            let otherId = null;
            if (conn.from === node.id) otherId = conn.to;
            else if (conn.to === node.id) otherId = conn.from;
            
            if (otherId) {
                const other = nodes.find(n => n.id === otherId);
                if (other) {
                    const dx = other.x - node.x;
                    const dy = other.y - node.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH;
                    node.vx += (dx / dist) * force;
                    node.vy += (dy / dist) * force;
                }
            }
        });

        // 3. Center Gravity (Gentle pull)
        const cdx = 2500 - node.x;
        const cdy = 2500 - node.y;
        node.vx += cdx * 0.0005;
        node.vy += cdy * 0.0005;

        // Apply Speed Limit for Stability
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (speed > MAX_SPEED) {
            node.vx = (node.vx / speed) * MAX_SPEED;
            node.vy = (node.vy / speed) * MAX_SPEED;
        }

        // Apply movement
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= DAMPING;
        node.vy *= DAMPING;

        // Update DOM
        node.element.style.left = `${node.x}px`;
        node.element.style.top = `${node.y}px`;
    });

    drawConnections();
    requestAnimationFrame(updatePhysics);
}

// Node Interaction State
let draggedNode = null;

// Create Node function
function createNode(x, y, content = "", parentId = null) {
    const id = Date.now().toString();
    const nodeEl = document.createElement('div');
    nodeEl.className = 'node bloom-anim';
    nodeEl.id = `node-${id}`;
    
    nodeEl.innerHTML = `
        <textarea placeholder="생각을 채워 넣으세요...">${content}</textarea>
        <div class="node-controls">
            <button class="icon-btn branch-btn" title="가지 뻗기">🌱</button>
            <button class="icon-btn delete-btn" title="삭제">🗑️</button>
        </div>
    `;

    canvas.appendChild(nodeEl);
    const textarea = nodeEl.querySelector('textarea');
    
    const updateSize = () => {
        const textLength = textarea.value.length;
        const targetWidth = Math.min(400, 150 + textLength * 2);
        nodeEl.style.width = `${targetWidth}px`;
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    };

    textarea.addEventListener('input', (e) => {
        updateSize();
        e.stopPropagation();
    });
    
    // Prevent dragging when typing
    textarea.addEventListener('mousedown', (e) => e.stopPropagation());

    // Drag Logic for Node
    nodeEl.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'TEXTAREA' || e.target.closest('.node-controls')) return;
        draggedNode = nodes.find(n => n.id === id);
        draggedNode.isDragging = true;
        nodeEl.classList.add('dragging');
        e.preventDefault();
    });

    // Branch logic
    nodeEl.querySelector('.branch-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        createNode(newNode.x + (Math.random()-0.5)*100, newNode.y + (Math.random()-0.5)*100, "", id);
    });

    // Delete logic
    nodeEl.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        nodeEl.remove();
        nodes = nodes.filter(n => n.id !== id);
        connections = connections.filter(c => c.from !== id && c.to !== id);
    });

    const newNode = { 
        id, x, y, vx: 0, vy: 0, 
        parentId, element: nodeEl,
        isDragging: false 
    };
    nodes.push(newNode);
    if (parentId) connections.push({ from: parentId, to: id });

    setTimeout(updateSize, 10);
    return id;
}

// Global Mouse Handlers for Dragging
window.addEventListener('mousemove', (e) => {
    if (draggedNode) {
        const rect = container.getBoundingClientRect();
        // Calculate position relative to the 5000x5000 canvas
        const canvasX = e.pageX - rect.left + container.scrollLeft;
        const canvasY = e.pageY - rect.top + container.scrollTop;
        draggedNode.x = canvasX;
        draggedNode.y = canvasY;
        draggedNode.vx = 0;
        draggedNode.vy = 0;
    } else if (isDraggingCanvas) {
        container.scrollLeft = scrollLeft - (e.pageX - startX);
        container.scrollTop = scrollTop - (e.pageY - startY);
    }
});

window.addEventListener('mouseup', () => {
    if (draggedNode) {
        draggedNode.isDragging = false;
        draggedNode.element.classList.remove('dragging');
        draggedNode = null;
    }
    isDraggingCanvas = false;
    container.style.cursor = 'grab';
});

// Canvas Panning
container.addEventListener('mousedown', (e) => {
    if (e.target.id !== 'canvas-container' && e.target.id !== 'thought-canvas') return;
    isDraggingCanvas = true;
    container.style.cursor = 'grabbing';
    startX = e.pageX;
    startY = e.pageY;
    scrollLeft = container.scrollLeft;
    scrollTop = container.scrollTop;
});

function drawConnections() {
    svgLayer.innerHTML = '';
    connections.forEach(conn => {
        const fromNode = nodes.find(n => n.id === conn.from);
        const toNode = nodes.find(n => n.id === conn.to);
        if (fromNode && toNode) {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${fromNode.x} ${fromNode.y} L ${toNode.x} ${toNode.y}`;
            path.setAttribute('d', d);
            path.setAttribute('class', 'connection');
            svgLayer.appendChild(path);
        }
    });
}

addRootBtn.addEventListener('click', () => {
    createNode(container.scrollLeft + container.offsetWidth/2, container.scrollTop + container.offsetHeight/2);
});

resetViewBtn.addEventListener('click', () => {
    container.scrollTo({
        left: 2500 - container.offsetWidth/2,
        top: 2500 - container.offsetHeight/2,
        behavior: 'smooth'
    });
});
