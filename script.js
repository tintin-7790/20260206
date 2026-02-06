// Three.js is loaded via CDN

class CeramicApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.composer = null;
        this.clayModel = null;
        this.wheelModel = null;
        this.currentStage = 'intro';
        this.touchState = {
            isTouching: false,
            lastTouch: { x: 0, y: 0 },
            currentTouch: { x: 0, y: 0 },
            touchVelocity: 0,
            pinchDistance: 0,
            lastPinchDistance: 0
        };
        this.clayState = {
            height: 2,
            radius: 0.5,
            thickness: 0.1,
            opening: 0.2,
            rotation: 0,
            deformationSpeed: 0.01,
            smoothness: 0.95
        };
        this.glazeState = {
            currentColor: { r: 0.5, g: 0.7, b: 0.9 },
            colors: [
                { name: '天青', color: { r: 0.5, g: 0.7, b: 0.9 } },
                { name: '梅子青', color: { r: 0.3, g: 0.8, b: 0.6 } },
                { name: '釉里红', color: { r: 0.9, g: 0.3, b: 0.4 } },
                { name: '豆青', color: { r: 0.7, g: 0.8, b: 0.6 } },
                { name: '白釉', color: { r: 0.9, g: 0.9, b: 0.9 } }
            ],
            texture: null
        };
        this.firingState = {
            temperature: 0,
            maxTemperature: 1300,
            atmosphere: 'reduction', // reduction or oxidation
            isFiring: false,
            firingProgress: 0
        };
        this.particles = [];
        this.audioContext = null;
        this.wheelSound = null;
        this.init();
    }

    init() {
        this.setupScene();
        this.setupRenderer();
        this.setupCamera();
        this.setupControls();
        this.setupLighting();
        this.setupPostProcessing();
        this.setupEventListeners();
        this.setupUI();
        this.startLoading();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
    }

    setupRenderer() {
        const container = document.getElementById('canvas-container');
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 2, 5);
        this.camera.lookAt(0, 0, 0);
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = false;
        this.controls.enablePan = false;
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);

        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(-5, 5, -5);
        this.scene.add(pointLight);
    }

    setupPostProcessing() {
        const renderScene = new RenderPass(this.scene, this.camera);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        window.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        window.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        window.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    }

    setupUI() {
        this.updateStageUI('intro');
    }

    startLoading() {
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
            this.enterStage('pulling');
        }, 2000);
    }

    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    handleTouchStart(event) {
        this.touchState.isTouching = true;
        if (event.touches.length === 1) {
            this.touchState.lastTouch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
            this.touchState.currentTouch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        } else if (event.touches.length === 2) {
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            this.touchState.lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
            this.touchState.pinchDistance = this.touchState.lastPinchDistance;
        }
    }

    handleTouchMove(event) {
        if (!this.touchState.isTouching) return;
        
        if (event.touches.length === 1) {
            this.touchState.currentTouch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
            const dx = this.touchState.currentTouch.x - this.touchState.lastTouch.x;
            const dy = this.touchState.currentTouch.y - this.touchState.lastTouch.y;
            this.touchState.touchVelocity = Math.sqrt(dx * dx + dy * dy) * 0.01;
            
            switch (this.currentStage) {
                case 'pulling':
                    this.handlePullingGesture(dy);
                    break;
                case 'trimming':
                    this.handleTrimmingGesture(this.touchState.currentTouch);
                    break;
                case 'glazing':
                    this.handleGlazingGesture(this.touchState.currentTouch);
                    break;
            }
            
            this.touchState.lastTouch = { ...this.touchState.currentTouch };
        } else if (event.touches.length === 2) {
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            this.touchState.pinchDistance = Math.sqrt(dx * dx + dy * dy);
            
            if (this.currentStage === 'pulling') {
                this.handlePinchGesture();
            }
            
            this.touchState.lastPinchDistance = this.touchState.pinchDistance;
        }
    }

    handleTouchEnd(event) {
        this.touchState.isTouching = false;
        this.touchState.touchVelocity = 0;
    }

    handleMouseDown(event) {
        this.touchState.isTouching = true;
        this.touchState.lastTouch = { x: event.clientX, y: event.clientY };
        this.touchState.currentTouch = { x: event.clientX, y: event.clientY };
    }

    handleMouseMove(event) {
        if (!this.touchState.isTouching) return;
        
        this.touchState.currentTouch = { x: event.clientX, y: event.clientY };
        const dx = this.touchState.currentTouch.x - this.touchState.lastTouch.x;
        const dy = this.touchState.currentTouch.y - this.touchState.lastTouch.y;
        this.touchState.touchVelocity = Math.sqrt(dx * dx + dy * dy) * 0.01;
        
        switch (this.currentStage) {
            case 'pulling':
                this.handlePullingGesture(dy);
                break;
            case 'trimming':
                this.handleTrimmingGesture(this.touchState.currentTouch);
                break;
            case 'glazing':
                this.handleGlazingGesture(this.touchState.currentTouch);
                break;
        }
        
        this.touchState.lastTouch = { ...this.touchState.currentTouch };
    }

    handleMouseUp(event) {
        this.touchState.isTouching = false;
        this.touchState.touchVelocity = 0;
    }

    handlePullingGesture(dy) {
        const normalizedDY = dy / window.innerHeight;
        const deformationAmount = normalizedDY * this.clayState.deformationSpeed * (1 + this.touchState.touchVelocity * 5);
        
        this.clayState.height = Math.max(0.5, Math.min(3, this.clayState.height - deformationAmount));
        
        if (this.touchState.touchVelocity > 0.5) {
            this.clayState.smoothness = Math.max(0.8, this.clayState.smoothness - 0.01);
            if (this.clayState.smoothness < 0.85) {
                this.showFeedback('泥坯即将塌陷！');
            }
        } else {
            this.clayState.smoothness = Math.min(0.99, this.clayState.smoothness + 0.005);
        }
        
        this.updateClayModel();
    }

    handlePinchGesture() {
        const pinchDelta = this.touchState.pinchDistance - this.touchState.lastPinchDistance;
        const openingChange = pinchDelta / window.innerWidth * 0.5;
        this.clayState.opening = Math.max(0, Math.min(this.clayState.radius * 0.8, this.clayState.opening + openingChange));
        this.updateClayModel();
    }

    handleTrimmingGesture(touchPos) {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        mouse.x = (touchPos.x / window.innerWidth) * 2 - 1;
        mouse.y = -(touchPos.y / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, this.camera);
        
        const intersects = raycaster.intersectObject(this.clayModel, true);
        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.trimClayAtPoint(point);
            this.createTrimParticles(point);
        }
    }

    handleGlazingGesture(touchPos) {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        mouse.x = (touchPos.x / window.innerWidth) * 2 - 1;
        mouse.y = -(touchPos.y / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, this.camera);
        
        const intersects = raycaster.intersectObject(this.clayModel, true);
        if (intersects.length > 0) {
            const point = intersects[0].point;
            const face = intersects[0].face;
            this.applyGlazeAtPoint(point, face);
        }
    }

    enterStage(stage) {
        this.currentStage = stage;
        this.clearScene();
        this.updateStageUI(stage);
        
        switch (stage) {
            case 'pulling':
                this.setupPullingStage();
                break;
            case 'trimming':
                this.setupTrimmingStage();
                break;
            case 'glazing':
                this.setupGlazingStage();
                break;
            case 'firing':
                this.setupFiringStage();
                break;
        }
    }

    setupPullingStage() {
        this.createWheelModel();
        this.createClayModel();
        this.playWheelSound();
    }

    setupTrimmingStage() {
        this.createClayModel();
        this.clayModel.rotation.y = Math.PI / 4;
    }

    setupGlazingStage() {
        this.createClayModel();
        this.createGlazeTexture();
        this.setupGlazeUI();
    }

    setupFiringStage() {
        this.createClayModel();
        this.setupFiringUI();
    }

    createWheelModel() {
        const wheelGeometry = new THREE.CylinderGeometry(2, 2, 0.2, 32);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        this.wheelModel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        this.wheelModel.position.y = -1;
        this.scene.add(this.wheelModel);
    }

    createClayModel() {
        const clayGeometry = this.generateClayGeometry();
        const clayMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xD2B48C,
            roughness: 0.9,
            metalness: 0.1
        });
        this.clayModel = new THREE.Mesh(clayGeometry, clayMaterial);
        this.clayModel.position.y = this.clayState.height / 2 - 0.5;
        this.scene.add(this.clayModel);
    }

    generateClayGeometry() {
        const points = [];
        const segments = 32;
        const heightSegments = 64;
        
        for (let i = 0; i <= heightSegments; i++) {
            const y = (i / heightSegments) * this.clayState.height;
            const radius = this.clayState.radius * (1 - (y / this.clayState.height) * 0.2) * this.clayState.smoothness;
            points.push(new THREE.Vector2(radius, y));
        }
        
        const latheGeometry = new THREE.LatheGeometry(points, segments);
        return latheGeometry;
    }

    updateClayModel() {
        if (!this.clayModel) return;
        
        const newGeometry = this.generateClayGeometry();
        this.clayModel.geometry.dispose();
        this.clayModel.geometry = newGeometry;
        this.clayModel.position.y = this.clayState.height / 2 - 0.5;
    }

    trimClayAtPoint(point) {
        const localPoint = this.clayModel.worldToLocal(point);
        const distanceFromCenter = Math.sqrt(localPoint.x * localPoint.x + localPoint.z * localPoint.z);
        
        if (distanceFromCenter < this.clayState.radius * 0.9) {
            this.clayState.thickness = Math.max(0.02, this.clayState.thickness - 0.005);
            if (this.clayState.thickness < 0.03) {
                this.showFeedback('泥坯太薄了！');
            }
        }
    }

    createTrimParticles(point) {
        const particleGeometry = new THREE.SphereGeometry(0.02, 8, 8);
        const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xD2B48C });
        
        for (let i = 0; i < 5; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.copy(point);
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                Math.random() * 0.1 + 0.05,
                (Math.random() - 0.5) * 0.1
            );
            this.scene.add(particle);
            this.particles.push(particle);
        }
    }

    createGlazeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#D2B48C';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        this.glazeState.texture = new THREE.CanvasTexture(canvas);
        this.glazeState.texture.needsUpdate = true;
        
        if (this.clayModel) {
            this.clayModel.material.map = this.glazeState.texture;
            this.clayModel.material.needsUpdate = true;
        }
    }

    applyGlazeAtPoint(point, face) {
        if (!this.glazeState.texture) return;
        
        const canvas = this.glazeState.texture.image;
        const ctx = canvas.getContext('2d');
        const uv = face.vertexNormals[0];
        
        const x = Math.floor((uv.x + 1) / 2 * canvas.width);
        const y = Math.floor((1 - uv.y) * canvas.height);
        
        ctx.fillStyle = `rgb(${Math.floor(this.glazeState.currentColor.r * 255)}, ${Math.floor(this.glazeState.currentColor.g * 255)}, ${Math.floor(this.glazeState.currentColor.b * 255)})`;
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fill();
        
        this.glazeState.texture.needsUpdate = true;
    }

    setupGlazeUI() {
        const controlContent = document.getElementById('control-content');
        controlContent.innerHTML = `
            <h3>选择釉色</h3>
            <div class="glaze-colors">
                ${this.glazeState.colors.map((color, index) => `
                    <div class="glaze-color" style="background-color: rgb(${Math.floor(color.color.r * 255)}, ${Math.floor(color.color.g * 255)}, ${Math.floor(color.color.b * 255)})" data-index="${index}"></div>
                `).join('')}
            </div>
            <button class="btn" onclick="app.enterStage('firing')">下一步：烧制</button>
        `;
        
        document.querySelectorAll('.glaze-color').forEach(element => {
            element.addEventListener('click', () => {
                const index = parseInt(element.dataset.index);
                this.glazeState.currentColor = this.glazeState.colors[index].color;
                document.querySelectorAll('.glaze-color').forEach(el => el.classList.remove('selected'));
                element.classList.add('selected');
            });
        });
    }

    setupFiringUI() {
        const controlContent = document.getElementById('control-content');
        controlContent.innerHTML = `
            <h3>选择烧成气氛</h3>
            <div class="atmosphere-selector">
                <button class="atmosphere-btn active" data-atmosphere="reduction">还原焰</button>
                <button class="atmosphere-btn" data-atmosphere="oxidation">氧化焰</button>
            </div>
            <div id="center-feedback">
                <div class="feedback-icon"><span class="emoji emoji1f525"></span></div>
                <div class="feedback-val" id="feedback-text">0°C</div>
            </div>
            <button class="btn" onclick="app.startFiring()">点火烧制</button>
        `;
        
        document.querySelectorAll('.atmosphere-btn').forEach(element => {
            element.addEventListener('click', () => {
                this.firingState.atmosphere = element.dataset.atmosphere;
                document.querySelectorAll('.atmosphere-btn').forEach(el => el.classList.remove('active'));
                element.classList.add('active');
            });
        });
    }

    startFiring() {
        this.firingState.isFiring = true;
        this.firingState.temperature = 0;
        this.firingState.firingProgress = 0;
    }

    updateFiring() {
        if (!this.firingState.isFiring) return;
        
        this.firingState.firingProgress += 0.005;
        this.firingState.temperature = this.firingState.maxTemperature * this.easeInOutCubic(this.firingState.firingProgress);
        
        document.getElementById('feedback-text').textContent = `${Math.floor(this.firingState.temperature)}°C`;
        
        if (this.firingState.firingProgress >= 1) {
            this.completeFiring();
        }
    }

    completeFiring() {
        this.firingState.isFiring = false;
        this.showFiringResult();
    }

    showFiringResult() {
        const result = this.calculateFiringResult();
        this.showFeedback(result.message);
        
        if (result.success) {
            const firedColor = this.calculateFiredColor();
            if (this.clayModel) {
                this.clayModel.material.color.setRGB(firedColor.r, firedColor.g, firedColor.b);
            }
        }
    }

    calculateFiringResult() {
        const random = Math.random();
        if (random < 0.7) {
            return { success: true, message: '烧制成功！' };
        } else if (random < 0.9) {
            return { success: true, message: '窑变效果惊艳！' };
        } else {
            return { success: false, message: '烧制失败，泥坯开裂。' };
        }
    }

    calculateFiredColor() {
        const baseColor = this.glazeState.currentColor;
        if (this.firingState.atmosphere === 'reduction') {
            return {
                r: Math.max(0, Math.min(1, baseColor.r * 0.9)),
                g: Math.max(0, Math.min(1, baseColor.g * 1.1)),
                b: Math.max(0, Math.min(1, baseColor.b * 0.8))
            };
        } else {
            return {
                r: Math.max(0, Math.min(1, baseColor.r * 1.1)),
                g: Math.max(0, Math.min(1, baseColor.g * 0.9)),
                b: Math.max(0, Math.min(1, baseColor.b * 1.1))
            };
        }
    }

    playWheelSound() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.value = 50;
            gainNode.gain.value = 0.1;
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.start();
            this.wheelSound = { oscillator, gainNode };
        } catch (error) {
            console.log('Audio not supported:', error);
        }
    }

    updateWheelSound() {
        if (this.wheelSound) {
            const frequency = 50 + this.clayState.rotation * 10;
            this.wheelSound.oscillator.frequency.value = frequency;
        }
    }

    showFeedback(message) {
        const centerFeedback = document.getElementById('center-feedback');
        const feedbackText = document.getElementById('feedback-text');
        feedbackText.textContent = message;
        centerFeedback.classList.remove('hidden');
        
        setTimeout(() => {
            centerFeedback.classList.add('hidden');
        }, 2000);
    }

    updateParticles() {
        this.particles.forEach((particle, index) => {
            particle.position.add(particle.velocity);
            particle.velocity.y -= 0.005;
            particle.scale.multiplyScalar(0.98);
            
            if (particle.scale.x < 0.1) {
                this.scene.remove(particle);
                this.particles.splice(index, 1);
            }
        });
    }

    updateStageUI(stage) {
        const stageName = document.getElementById('stage-name');
        const masterText = document.getElementById('master-text');
        const controlContent = document.getElementById('control-content');
        
        const stageInfo = {
            intro: { name: '序章', text: '瓷之魂，在于土与火的共舞。' },
            pulling: { name: '拉坯', text: '用手触摸泥柱，上下拖动调整形状，双指捏合控制开口大小。' },
            trimming: { name: '利坯', text: '用虚拟修坯刀刮去多余的泥料，塑造完美形状。' },
            glazing: { name: '上釉', text: '选择喜欢的釉色，在坯体上涂抹均匀。' },
            firing: { name: '烧制', text: '选择烧成气氛，体验窑火淬炼的神奇过程。' }
        };
        
        stageName.textContent = stageInfo[stage].name;
        masterText.textContent = stageInfo[stage].text;
        
        if (stage === 'intro') {
            controlContent.innerHTML = `<button class="btn" onclick="app.enterStage('pulling')">开始制瓷</button>`;
        } else if (stage === 'pulling') {
            controlContent.innerHTML = `<button class="btn" onclick="app.enterStage('trimming')">下一步：利坯</button>`;
        } else if (stage === 'trimming') {
            controlContent.innerHTML = `<button class="btn" onclick="app.enterStage('glazing')">下一步：上釉</button>`;
        }
    }

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.wheelModel) {
            this.wheelModel.rotation.y += 0.02;
        }
        
        if (this.clayModel && this.currentStage === 'pulling') {
            this.clayModel.rotation.y += 0.02;
            this.clayState.rotation += 0.02;
            this.updateWheelSound();
        }
        
        if (this.currentStage === 'firing') {
            this.updateFiring();
        }
        
        this.updateParticles();
        this.controls.update();
        this.composer.render();
    }

    clearScene() {
        if (this.wheelModel) {
            this.scene.remove(this.wheelModel);
            this.wheelModel = null;
        }
        
        if (this.clayModel) {
            this.scene.remove(this.clayModel);
            this.clayModel = null;
        }
        
        this.particles.forEach(particle => {
            this.scene.remove(particle);
        });
        this.particles = [];
        
        if (this.wheelSound) {
            this.wheelSound.oscillator.stop();
            this.wheelSound = null;
        }
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);

        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(-5, 5, -5);
        this.scene.add(pointLight);
    }

    setupPostProcessing() {
        const renderScene = new RenderPass(this.scene, this.camera);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 2, 5);
        this.camera.lookAt(0, 0, 0);
    }

    setupRenderer() {
        const container = document.getElementById('canvas-container');
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = false;
        this.controls.enablePan = false;
    }
}

let app;
window.addEventListener('DOMContentLoaded', () => {
    app = new CeramicApp();
    app.animate();
});