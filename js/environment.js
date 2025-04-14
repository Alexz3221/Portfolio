// Environment.js - Handles the 3D world environment

class Environment {
    constructor(scene) {
        this.scene = scene;
        this.assets = {};
        this.loadingManager = new THREE.LoadingManager();
        this.gltfLoader = new THREE.GLTFLoader(this.loadingManager);
        this.textureLoader = new THREE.TextureLoader(this.loadingManager);
        
        // Configure DRACO loader for compressed models
        const dracoLoader = new THREE.DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        this.gltfLoader.setDRACOLoader(dracoLoader);
        
        // Environment settings
        this.gridSize = 100;
        this.gridDivisions = 100;
        this.floorSize = 200;
    }
    
    // Load all environment assets
    async load() {
        return new Promise((resolve) => {
            // Create floor
            this.createFloor();
            
            // Create grid
            this.createGrid();
            
            // Create skybox
            this.createSkybox();
            
            // Add ambient environment elements
            this.createAmbientElements();
            
            // Resolve when all assets are loaded
            resolve();
        });
    }
    
    // Create floor plane
    createFloor() {
        // Create reflective floor material
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x050510,
            metalness: 0.8,
            roughness: 0.2,
            envMapIntensity: 0.5
        });
        
        // Create floor geometry
        const floorGeometry = new THREE.PlaneGeometry(this.floorSize, this.floorSize);
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        
        // Add floor reflection
        const reflectionGeometry = new THREE.PlaneGeometry(this.floorSize, this.floorSize);
        const reflectionMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                baseColor: { value: new THREE.Color(0x050510) },
                glowColor: { value: new THREE.Color(0x00ffff) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 baseColor;
                uniform vec3 glowColor;
                varying vec2 vUv;
                
                void main() {
                    // Create grid pattern
                    float gridSize = 0.05;
                    vec2 grid = abs(fract(vUv / gridSize - 0.5) - 0.5) / fwidth(vUv / gridSize);
                    float gridLine = min(grid.x, grid.y);
                    
                    // Pulse effect
                    float pulse = 0.5 + 0.5 * sin(time * 0.5);
                    
                    // Distance from center for radial effect
                    vec2 center = vUv - 0.5;
                    float dist = length(center);
                    
                    // Grid line intensity with distance falloff
                    float lineIntensity = 1.0 - smoothstep(0.05, 0.1, gridLine) * (0.2 + 0.8 * smoothstep(0.0, 0.5, dist));
                    
                    // Combine effects
                    vec3 color = mix(baseColor, glowColor, lineIntensity * (0.2 + 0.8 * pulse));
                    
                    // Add glow at center
                    float centerGlow = smoothstep(0.5, 0.0, dist) * 0.5 * pulse;
                    color = mix(color, glowColor, centerGlow);
                    
                    gl_FragColor = vec4(color, 0.7 * lineIntensity + centerGlow);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        
        const reflection = new THREE.Mesh(reflectionGeometry, reflectionMaterial);
        reflection.rotation.x = -Math.PI / 2;
        reflection.position.y = 0.01; // Slightly above the floor
        this.scene.add(reflection);
        
        this.reflectionMaterial = reflectionMaterial;
    }
    
    // Create grid
    createGrid() {
        const gridHelper = new THREE.GridHelper(this.gridSize, this.gridDivisions, 0x00ffff, 0x00ffff);
        gridHelper.material.opacity = 0.2;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
        
        // Add vertical grid lines for a more immersive environment
        const verticalGridGeometry = new THREE.BufferGeometry();
        const verticalGridMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.1
        });
        
        const vertices = [];
        const gridStep = this.gridSize / this.gridDivisions;
        const halfGrid = this.gridSize / 2;
        
        // Create vertical lines at grid intersections
        for (let i = -halfGrid; i <= halfGrid; i += gridStep) {
            for (let j = -halfGrid; j <= halfGrid; j += gridStep) {
                // Only create lines at some intersections for performance
                if (Math.random() > 0.9) {
                    const height = 5 + Math.random() * 15;
                    vertices.push(i, 0, j);
                    vertices.push(i, height, j);
                }
            }
        }
        
        verticalGridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const verticalGrid = new THREE.LineSegments(verticalGridGeometry, verticalGridMaterial);
        this.scene.add(verticalGrid);
    }
    
    // Create skybox
    createSkybox() {
        // Create a simple gradient background using a large sphere
        const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x000020) },
                bottomColor: { value: new THREE.Color(0x050510) },
                offset: { value: 400 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });
        
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(sky);
        
        // Add stars
        const starGeometry = new THREE.BufferGeometry();
        const starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.5,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        const starVertices = [];
        for (let i = 0; i < 10000; i++) {
            const x = THREE.MathUtils.randFloatSpread(1000);
            const y = THREE.MathUtils.randFloatSpread(1000);
            const z = THREE.MathUtils.randFloatSpread(1000);
            
            // Keep stars above horizon
            if (y > 0) {
                starVertices.push(x, y, z);
            }
        }
        
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(stars);
    }
    
    // Create ambient environment elements
    createAmbientElements() {
        // Add some floating neon cubes for decoration
        const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
        const cubeMaterials = [
            new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.5 }),
            new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 0.5 }),
            new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.5 })
        ];
        
        this.decorativeCubes = [];
        
        for (let i = 0; i < 20; i++) {
            const material = cubeMaterials[Math.floor(Math.random() * cubeMaterials.length)];
            const cube = new THREE.Mesh(cubeGeometry, material);
            
            // Random position
            cube.position.x = THREE.MathUtils.randFloatSpread(100);
            cube.position.y = 5 + Math.random() * 20;
            cube.position.z = THREE.MathUtils.randFloatSpread(100);
            
            // Random rotation
            cube.rotation.x = Math.random() * Math.PI;
            cube.rotation.y = Math.random() * Math.PI;
            cube.rotation.z = Math.random() * Math.PI;
            
            // Random scale
            const scale = 0.2 + Math.random() * 0.8;
            cube.scale.set(scale, scale, scale);
            
            // Add animation properties
            cube.userData.rotationSpeed = {
                x: THREE.MathUtils.randFloatSpread(0.01),
                y: THREE.MathUtils.randFloatSpread(0.01),
                z: THREE.MathUtils.randFloatSpread(0.01)
            };
            
            cube.userData.floatSpeed = 0.2 + Math.random() * 0.5;
            cube.userData.floatHeight = Math.random() * Math.PI * 2;
            
            this.scene.add(cube);
            this.decorativeCubes.push(cube);
        }
    }
    
    // Update environment elements
    update(delta) {
        // Update reflection shader time
        if (this.reflectionMaterial) {
            this.reflectionMaterial.uniforms.time.value += delta;
        }
        
        // Update decorative cubes
        if (this.decorativeCubes) {
            this.decorativeCubes.forEach(cube => {
                // Rotate cubes
                cube.rotation.x += cube.userData.rotationSpeed.x;
                cube.rotation.y += cube.userData.rotationSpeed.y;
                cube.rotation.z += cube.userData.rotationSpeed.z;
                
                // Float up and down
                cube.userData.floatHeight += delta * cube.userData.floatSpeed;
                cube.position.y += Math.sin(cube.userData.floatHeight) * 0.01;
            });
        }
    }
}
