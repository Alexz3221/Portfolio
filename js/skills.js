// Skills.js - Handles interactive skills visualization

class SkillsVisualizer {
    constructor(scene) {
        this.scene = scene;
        this.skillsGroup = null;
        this.skillObjects = {};
        this.isVisible = false;
        
        // Position for the skills visualization
        this.position = new THREE.Vector3(0, 0, 50);
        
        // Define skills with categories and visual properties
        this.skillsData = {
            languages: [
                { name: 'Java', color: 0xf89820, icon: '☕', animation: 'rotate' },
                { name: 'Python', color: 0x4584b6, icon: '🐍', animation: 'bounce' },
                { name: 'C++', color: 0x00599c, icon: '⚙️', animation: 'pulse' },
                { name: 'JavaScript', color: 0xf7df1e, icon: 'JS', animation: 'orbit' },
                { name: 'Swift', color: 0xff4f2f, icon: '🦅', animation: 'float' }
            ],
            frameworks: [
                { name: 'React', color: 0x61dafb, icon: '⚛️', animation: 'orbit' },
                { name: 'Node.js', color: 0x68a063, icon: 'N', animation: 'pulse' },
                { name: 'Express.js', color: 0x000000, icon: 'E', animation: 'rotate' },
                { name: 'PyTorch', color: 0xee4c2c, icon: '🔥', animation: 'float' },
                { name: 'TensorFlow', color: 0xff6f00, icon: 'TF', animation: 'bounce' }
            ],
            tools: [
                { name: 'AWS', color: 0xff9900, icon: '☁️', animation: 'float' },
                { name: 'Docker', color: 0x2496ed, icon: '🐳', animation: 'bounce' },
                { name: 'Firebase', color: 0xffca28, icon: '🔥', animation: 'pulse' },
                { name: 'Git', color: 0xf05032, icon: 'G', animation: 'rotate' }
            ]
        };
    }
    
    // Load skills visualization
    async load() {
        return new Promise((resolve) => {
            this.createSkillsVisualization();
            resolve();
        });
    }
    
    // Create skills visualization
    createSkillsVisualization() {
        // Create a group to hold all elements
        this.skillsGroup = new THREE.Group();
        this.skillsGroup.position.copy(this.position);
        this.scene.add(this.skillsGroup);
        
        // Create platform
        const platformGeometry = new THREE.CylinderGeometry(15, 15, 1, 32);
        const platformMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.8,
            roughness: 0.2
        });
        
        const platform = new THREE.Mesh(platformGeometry, platformMaterial);
        platform.position.y = 0.5;
        platform.receiveShadow = true;
        this.skillsGroup.add(platform);
        
        // Add grid pattern to platform
        const gridHelper = new THREE.GridHelper(30, 30, 0x00ffff, 0x00ffff);
        gridHelper.position.y = 0.51;
        gridHelper.material.opacity = 0.2;
        gridHelper.material.transparent = true;
        this.skillsGroup.add(gridHelper);
        
        // Create category labels
        this.createCategoryLabels();
        
        // Create skill objects
        this.createSkillObjects();
        
        // Add lighting
        this.addLighting();
        
        // Initially hide the visualization
        this.skillsGroup.visible = false;
    }
    
    // Create category labels
    createCategoryLabels() {
        const categories = Object.keys(this.skillsData);
        const categoryPositions = [
            new THREE.Vector3(-10, 5, 0),  // Languages
            new THREE.Vector3(0, 5, 0),    // Frameworks
            new THREE.Vector3(10, 5, 0)    // Tools
        ];
        
        categories.forEach((category, index) => {
            const position = categoryPositions[index];
            this.createFloatingText(category.toUpperCase(), position, 0x00ffff);
        });
    }
    
    // Create floating text for category labels
    createFloatingText(text, position, color) {
        // Create canvas for text texture
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        // Draw text
        context.fillStyle = 'rgba(0, 0, 0, 0)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'bold 72px Orbitron';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Glow effect
        context.shadowBlur = 15;
        context.shadowColor = `rgb(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255})`;
        
        // Text color
        context.fillStyle = `rgb(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255})`;
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        
        // Create material
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // Create plane
        const geometry = new THREE.PlaneGeometry(8, 2);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        
        // Always face camera
        mesh.userData.isFloatingText = true;
        
        this.skillsGroup.add(mesh);
        return mesh;
    }
    
    // Create skill objects
    createSkillObjects() {
        const categories = Object.keys(this.skillsData);
        const categoryPositions = [
            new THREE.Vector3(-10, 0, 0),  // Languages
            new THREE.Vector3(0, 0, 0),    // Frameworks
            new THREE.Vector3(10, 0, 0)    // Tools
        ];
        
        categories.forEach((category, categoryIndex) => {
            const skills = this.skillsData[category];
            const basePosition = categoryPositions[categoryIndex];
            
            skills.forEach((skill, skillIndex) => {
                // Calculate position in a circular pattern around the category center
                const angle = (skillIndex / skills.length) * Math.PI * 2;
                const radius = 5;
                const x = basePosition.x + Math.cos(angle) * radius;
                const z = basePosition.z + Math.sin(angle) * radius;
                const y = basePosition.y + 2;
                
                const position = new THREE.Vector3(x, y, z);
                
                // Create skill object
                this.createSkillObject(skill, position);
            });
        });
    }
    
    // Create individual skill object
    createSkillObject(skill, position) {
        // Create group for this skill
        const skillGroup = new THREE.Group();
        skillGroup.position.copy(position);
        
        // Create base platform for skill
        const baseGeometry = new THREE.CylinderGeometry(1, 1, 0.2, 16);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.8,
            roughness: 0.2
        });
        
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = -0.1;
        base.receiveShadow = true;
        skillGroup.add(base);
        
        // Create skill icon/object based on animation type
        let skillObject;
        
        switch (skill.animation) {
            case 'rotate':
                skillObject = this.createRotatingCube(skill);
                break;
            case 'bounce':
                skillObject = this.createBouncingSphere(skill);
                break;
            case 'pulse':
                skillObject = this.createPulsingObject(skill);
                break;
            case 'orbit':
                skillObject = this.createOrbitingObject(skill);
                break;
            case 'float':
                skillObject = this.createFloatingObject(skill);
                break;
            default:
                skillObject = this.createRotatingCube(skill);
        }
        
        skillGroup.add(skillObject);
        
        // Create skill name label
        const labelPosition = new THREE.Vector3(0, -1, 0);
        const label = this.createSkillLabel(skill.name, labelPosition, skill.color);
        skillGroup.add(label);
        
        // Add to scene
        this.skillsGroup.add(skillGroup);
        
        // Store reference
        this.skillObjects[skill.name] = {
            group: skillGroup,
            object: skillObject,
            animation: skill.animation,
            data: skill
        };
    }
    
    // Create rotating cube skill object
    createRotatingCube(skill) {
        const group = new THREE.Group();
        
        // Create cube
        const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const material = new THREE.MeshStandardMaterial({
            color: skill.color,
            metalness: 0.5,
            roughness: 0.5,
            emissive: skill.color,
            emissiveIntensity: 0.2
        });
        
        const cube = new THREE.Mesh(geometry, material);
        cube.castShadow = true;
        group.add(cube);
        
        // Add icon text to faces
        this.addTextToObject(cube, skill.icon);
        
        // Animation properties
        group.userData.rotationSpeed = {
            x: 0.01,
            y: 0.02,
            z: 0.005
        };
        
        return group;
    }
    
    // Create bouncing sphere skill object
    createBouncingSphere(skill) {
        const group = new THREE.Group();
        
        // Create sphere
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = new THREE.MeshStandardMaterial({
            color: skill.color,
            metalness: 0.5,
            roughness: 0.5,
            emissive: skill.color,
            emissiveIntensity: 0.2
        });
        
        const sphere = new THREE.Mesh(geometry, material);
        sphere.castShadow = true;
        group.add(sphere);
        
        // Add icon text
        this.addTextToObject(sphere, skill.icon);
        
        // Animation properties
        group.userData.bounceHeight = 1;
        group.userData.bounceSpeed = 0.5 + Math.random() * 0.5;
        group.userData.bounceOffset = Math.random() * Math.PI * 2;
        
        return group;
    }
    
    // Create pulsing object
    createPulsingObject(skill) {
        const group = new THREE.Group();
        
        // Create octahedron
        const geometry = new THREE.OctahedronGeometry(1, 0);
        const material = new THREE.MeshStandardMaterial({
            color: skill.color,
            metalness: 0.5,
            roughness: 0.5,
            emissive: skill.color,
            emissiveIntensity: 0.2
        });
        
        const object = new THREE.Mesh(geometry, material);
        object.castShadow = true;
        group.add(object);
        
        // Add icon text
        this.addTextToObject(object, skill.icon);
        
        // Animation properties
        group.userData.pulseSpeed = 0.5 + Math.random() * 0.5;
        group.userData.pulseOffset = Math.random() * Math.PI * 2;
        group.userData.minScale = 0.8;
        group.userData.maxScale = 1.2;
        
        return group;
    }
    
    // Create orbiting object
    createOrbitingObject(skill) {
        const group = new THREE.Group();
        
        // Create center sphere
        const centerGeometry = new THREE.SphereGeometry(0.7, 16, 16);
        const centerMaterial = new THREE.MeshStandardMaterial({
            color: skill.color,
            metalness: 0.5,
            roughness: 0.5,
            emissive: skill.color,
            emissiveIntensity: 0.2
        });
        
        const centerSphere = new THREE.Mesh(centerGeometry, centerMaterial);
        centerSphere.castShadow = true;
        group.add(centerSphere);
        
        // Add icon text to center
        this.addTextToObject(centerSphere, skill.icon);
        
        // Create orbiting satellites
        const satelliteCount = 3;
        const satelliteGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const satelliteMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: skill.color,
            emissiveIntensity: 0.5
        });
        
        for (let i = 0; i < satelliteCount; i++) {
            const satellite = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
            
            // Create orbit path
            const orbitGroup = new THREE.Group();
            group.add(orbitGroup);
            
            // Position satellite
            satellite.position.x = 1.2;
            satellite.castShadow = true;
            orbitGroup.add(satellite);
            
            // Set random rotation for orbit path
            orbitGroup.rotation.x = Math.random() * Math.PI;
            orbitGroup.rotation.y = Math.random() * Math.PI;
            
            // Animation properties
            orbitGroup.userData.rotationSpeed = 0.5 + Math.random() * 0.5;
            orbitGroup.userData.isOrbit = true;
        }
        
        return group;
    }
    
    // Create floating object
    createFloatingObject(skill) {
        const group = new THREE.Group();
        
        // Create torus
        const geometry = new THREE.TorusGeometry(0.7, 0.3, 16, 32);
        const material = new THREE.MeshStandardMaterial({
            color: skill.color,
            metalness: 0.5,
            roughness: 0.5,
            emissive: skill.color,
            emissiveIntensity: 0.2
        });
        
        const torus = new THREE.Mesh(geometry, material);
        torus.castShadow = true;
        group.add(torus);
        
        // Create center for icon
        const centerGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const centerMaterial = new THREE.MeshStandardMaterial({
            color: skill.color,
            metalness: 0.5,
            roughness: 0.5
        });
        
        const center = new THREE.Mesh(centerGeometry, centerMaterial);
        center.castShadow = true;
        group.add(center);
        
        // Add icon text to center
        this.addTextToObject(center, skill.icon);
        
        // Animation properties
        group.userData.floatHeight = 0.5;
        group.userData.floatSpeed = 0.3 + Math.random() * 0.3;
        group.userData.floatOffset = Math.random() * Math.PI * 2;
        group.userData.rotationSpeed = {
            x: 0.01,
            y: 0.01,
            z: 0.01
        };
        
        return group;
    }
    
    // Add text to object faces
    addTextToObject(object, text) {
        // Create canvas for text texture
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 128;
        
        // Draw text
        context.fillStyle = 'rgba(0, 0, 0, 0)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'bold 64px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#ffffff';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        
        // Create material
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // Create plane
        const geometry = new THREE.PlaneGeometry(1, 1);
        
        // Add to each face for cubes
        if (object.geometry.type === 'BoxGeometry') {
            const positions = [
                { pos: [0, 0, 0.76], rot: [0, 0, 0] },
                { pos: [0, 0, -0.76], rot: [0, Math.PI, 0] },
                { pos: [0.76, 0, 0], rot: [0, Math.PI / 2, 0] },
                { pos: [-0.76, 0, 0], rot: [0, -Math.PI / 2, 0] },
                { pos: [0, 0.76, 0], rot: [-Math.PI / 2, 0, 0] },
                { pos: [0, -0.76, 0], rot: [Math.PI / 2, 0, 0] }
            ];
            
            positions.forEach(({ pos, rot }) => {
                const plane = new THREE.Mesh(geometry, material);
                plane.position.set(pos[0], pos[1], pos[2]);
                plane.rotation.set(rot[0], rot[1], rot[2]);
                object.add(plane);
            });
        } else {
            // For non-cube objects, just add a floating label
            const plane = new THREE.Mesh(geometry, material);
            plane.position.set(0, 0, 0);
            plane.lookAt(0, 0, 1); // Face forward
            object.add(plane);
        }
    }
    
    // Create skill name label
    createSkillLabel(text, position, color) {
        // Create canvas for text texture
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        // Draw text
        context.fillStyle = 'rgba(0, 0, 0, 0)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'bold 32px Orbitron';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Glow effect
        context.shadowBlur = 10;
        context.shadowColor = `rgb(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255})`;
        
        // Text color
        context.fillStyle = `rgb(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255})`;
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        
        // Create material
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // Create plane
        const geometry = new THREE.PlaneGeometry(2, 0.5);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        
        // Always face camera
        mesh.userData.isFloatingText = true;
        
        return mesh;
    }
    
    // Add lighting specific to the skills visualization
    addLighting() {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x333333, 0.5);
        this.skillsGroup.add(ambientLight);
        
        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        
        // Configure shadow properties
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        
        this.skillsGroup.add(directionalLight);
        
        // Add colored point lights
        const colors = [0x00ffff, 0xff00ff, 0xffff00];
        const positions = [
            new THREE.Vector3(-10, 5, 0),
            new THREE.Vector3(0, 5, 0),
            new THREE.Vector3(10, 5, 0)
        ];
        
        for (let i = 0; i < colors.length; i++) {
            const pointLight = new THREE.PointLight(colors[i], 1, 15);
            pointLight.position.copy(positions[i]);
            this.skillsGroup.add(pointLight);
        }
    }
    
    // Show skills visualization
    show() {
        if (this.skillsGroup) {
            this.skillsGroup.visible = true;
            this.isVisible = true;
        }
    }
    
    // Hide skills visualization
    hide() {
        if (this.skillsGroup) {
            this.skillsGroup.visible = false;
            this.isVisible = false;
        }
    }
    
    // Update skills visualization
    update(delta) {
        if (!this.isVisible) return;
        
        // Update all skill objects based on their animation type
        Object.values(this.skillObjects).forEach(skillObj => {
            const { object, animation, group } = skillObj;
            
            switch (animation) {
                case 'rotate':
                    this.updateRotatingObject(object, delta);
                    break;
                case 'bounce':
                    this.updateBouncingObject(group, delta);
                    break;
                case 'pulse':
                    this.updatePulsingObject(object, delta);
                    break;
                case 'orbit':
                    this.updateOrbitingObject(group, delta);
                    break;
                case 'float':
                    this.updateFloatingObject(group, delta);
                    break;
            }
        });
        
        // Update text elements to face camera
        this.skillsGroup.traverse(object => {
            if (object.userData.isFloatingText) {
                object.lookAt(camera.position);
            }
        });
    }
    
    // Update rotating object
    updateRotatingObject(object, delta) {
        if (!object.userData.rotationSpeed) return;
        
        object.rotation.x += object.userData.rotationSpeed.x;
        object.rotation.y += object.userData.rotationSpeed.y;
        object.rotation.z += object.userData.rotationSpeed.z;
    }
    
    // Update bouncing object
    updateBouncingObject(group, delta) {
        if (!group.userData.bounceSpeed) return;
        
        const time = Date.now() * 0.001;
        const height = Math.sin((time + group.userData.bounceOffset) * group.userData.bounceSpeed) * group.userData.bounceHeight;
        
        group.position.y = height;
    }
    
    // Update pulsing object
    updatePulsingObject(object, delta) {
        if (!object.userData.pulseSpeed) return;
        
        const time = Date.now() * 0.001;
        const scale = object.userData.minScale + (Math.sin((time + object.userData.pulseOffset) * object.userData.pulseSpeed) + 1) * 0.5 * (object.userData.maxScale - object.userData.minScale);
        
        object.scale.set(scale, scale, scale);
    }
    
    // Update orbiting object
    updateOrbitingObject(group, delta) {
        group.children.forEach(child => {
            if (child.userData.isOrbit) {
                child.rotation.y += child.userData.rotationSpeed * delta;
            }
        });
    }
    
    // Update floating object
    updateFloatingObject(group, delta) {
        if (!group.userData.floatSpeed) return;
        
        const time = Date.now() * 0.001;
        const height = Math.sin((time + group.userData.floatOffset) * group.userData.floatSpeed) * group.userData.floatHeight;
        
        group.position.y = height;
        
        // Also rotate
        if (group.userData.rotationSpeed) {
            group.rotation.x += group.userData.rotationSpeed.x;
            group.rotation.y += group.userData.rotationSpeed.y;
            group.rotation.z += group.userData.rotationSpeed.z;
        }
    }
}
