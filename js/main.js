// Main.js - Core application functionality

// Global variables
let scene, camera, renderer, clock, mixer;
let stats, controls;
let car, environment;
let loadingManager, loadingScreen, loadingBar, loadingText;
let isLoading = true;
let isMobile = window.innerWidth < 768;

// Initialize the application
function init() {
    initLoading();
    initThree();
    initStats();
    initLights();
    
    // Initialize components
    environment = new Environment(scene);
    car = new Car(scene, camera);
    initProjects();
    initUI();
    
    // Start loading assets
    environment.load().then(() => {
        return car.load();
    }).then(() => {
        loadProjects().then(() => {
            // All assets loaded
            setTimeout(() => {
                isLoading = false;
                document.getElementById('loading-screen').style.display = 'none';
            }, 1000); // Add a small delay for smoother transition
        });
    });
    
    // Start animation loop
    animate();
}

// Initialize loading screen
function initLoading() {
    loadingScreen = document.getElementById('loading-screen');
    loadingBar = document.getElementById('loading-bar');
    loadingText = document.getElementById('loading-text');
    
    loadingManager = new THREE.LoadingManager();
    
    loadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
        const progress = (itemsLoaded / itemsTotal) * 100;
        loadingBar.style.width = progress + '%';
        loadingText.textContent = `Loading assets... ${Math.round(progress)}%`;
    };
    
    loadingManager.onError = function(url) {
        console.error('Error loading: ' + url);
        loadingText.textContent = 'Error loading assets. Please refresh.';
    };
}

// Initialize Three.js core components
function initThree() {
    clock = new THREE.Clock();
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);
    scene.fog = new THREE.FogExp2(0x050510, 0.002);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('scene-canvas'),
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

// Initialize performance stats
function initStats() {
    stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);
    stats.dom.style.cssText = 'position:absolute;top:0;right:0;cursor:pointer;opacity:0.9;z-index:10000';
}

// Initialize scene lighting
function initLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x333333, 0.5);
    scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    
    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.bias = -0.0005;
    
    scene.add(directionalLight);
    
    // Add some colored point lights for the techno/neon effect
    const colors = [0x00ffff, 0xff00ff, 0xffff00];
    const positions = [
        new THREE.Vector3(-10, 5, 10),
        new THREE.Vector3(10, 5, -10),
        new THREE.Vector3(0, 5, -15)
    ];
    
    for (let i = 0; i < colors.length; i++) {
        const pointLight = new THREE.PointLight(colors[i], 1, 50);
        pointLight.position.copy(positions[i]);
        scene.add(pointLight);
        
        // Add light helper for debugging (comment out in production)
        // const pointLightHelper = new THREE.PointLightHelper(pointLight, 1);
        // scene.add(pointLightHelper);
    }
}

// Handle window resize
function onWindowResize() {
    isMobile = window.innerWidth < 768;
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    stats.begin();
    
    const delta = clock.getDelta();
    
    // Update components if loading is complete
    if (!isLoading) {
        car.update(delta);
        environment.update(delta);
        updateProjects(delta);
    }
    
    // Render scene
    renderer.render(scene, camera);
    
    stats.end();
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', init);
