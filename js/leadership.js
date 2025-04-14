// Leadership.js - Handles the leadership throne scene

class LeadershipScene {
    constructor(scene) {
        this.scene = scene;
        this.model = null;
        this.throneModel = null;
        this.crowdModels = [];
        this.animationMixer = null;
        this.clock = new THREE.Clock();
        this.isVisible = false;
        
        // Position for the leadership scene
        this.position = new THREE.Vector3(0, 0, -50);
    }
    
    // Load leadership scene
    async load() {
        return new Promise((resolve) => {
            this.createThroneScene();
            resolve();
        });
    }
    
    // Create throne scene
    createThroneScene() {
        // Create a group to hold all elements
        this.model = new THREE.Group();
        this.model.position.copy(this.position);
        this.scene.add(this.model);
        
        // Create platform/stage
        const platformGeometry = new THREE.BoxGeometry(20, 1, 20);
        const platformMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.8,
            roughness: 0.2
        });
        
        const platform = new THREE.Mesh(platformGeometry, platformMaterial);
        platform.position.y = 0.5;
        platform.receiveShadow = true;
        this.model.add(platform);
        
        // Create steps leading to throne
        const stepsGroup = new THREE.Group();
        const stepMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.7,
            roughness: 0.3
        });
        
        for (let i = 0; i < 3; i++) {
            const stepGeometry = new THREE.BoxGeometry(8 - i * 1.5, 0.5, 3);
            const step = new THREE.Mesh(stepGeometry, stepMaterial);
            step.position.y = 1 + i * 0.5;
            step.position.z = -5 + i * 1;
            step.receiveShadow = true;
            step.castShadow = true;
            stepsGroup.add(step);
        }
        
        this.model.add(stepsGroup);
        
        // Create throne
        this.createThrone();
        
        // Create person model
        this.createPersonModel();
        
        // Create crowd
        this.createCrowd();
        
        // Add lighting for the scene
        this.addLighting();
        
        // Initially hide the scene
        this.model.visible = false;
    }
    
    // Create throne
    createThrone() {
        // Throne base
        const throneBaseGeometry = new THREE.BoxGeometry(4, 0.5, 3);
        const throneMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4af37, // Gold color
            metalness: 1.0,
            roughness: 0.2
        });
        
        const throneBase = new THREE.Mesh(throneBaseGeometry, throneMaterial);
        throneBase.position.y = 2.5;
        throneBase.position.z = -7;
        throneBase.receiveShadow = true;
        throneBase.castShadow = true;
        this.model.add(throneBase);
        
        // Throne back
        const throneBackGeometry = new THREE.BoxGeometry(4, 5, 0.5);
        const throneBack = new THREE.Mesh(throneBackGeometry, throneMaterial);
        throneBack.position.y = 5;
        throneBack.position.z = -8.25;
        throneBack.receiveShadow = true;
        throneBack.castShadow = true;
        this.model.add(throneBack);
        
        // Throne armrests
        const armrestGeometry = new THREE.BoxGeometry(0.5, 1, 3);
        
        const leftArmrest = new THREE.Mesh(armrestGeometry, throneMaterial);
        leftArmrest.position.set(2, 3.25, -7);
        leftArmrest.receiveShadow = true;
        leftArmrest.castShadow = true;
        this.model.add(leftArmrest);
        
        const rightArmrest = new THREE.Mesh(armrestGeometry, throneMaterial);
        rightArmrest.position.set(-2, 3.25, -7);
        rightArmrest.receiveShadow = true;
        rightArmrest.castShadow = true;
        this.model.add(rightArmrest);
        
        // Throne decorations
        const sphereGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        
        // Add decorative spheres to the throne
        const positions = [
            new THREE.Vector3(2, 7.5, -8.25), // Top left
            new THREE.Vector3(-2, 7.5, -8.25), // Top right
            new THREE.Vector3(2, 3, -8.25), // Bottom left
            new THREE.Vector3(-2, 3, -8.25), // Bottom right
        ];
        
        positions.forEach(position => {
            const sphere = new THREE.Mesh(sphereGeometry, throneMaterial);
            sphere.position.copy(position);
            sphere.castShadow = true;
            this.model.add(sphere);
        });
        
        // Add glowing effect to throne
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffcc00,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });
        
        const throneBackGlow = new THREE.Mesh(
            new THREE.BoxGeometry(4.5, 5.5, 1),
            glowMaterial
        );
        throneBackGlow.position.copy(throneBack.position);
        this.model.add(throneBackGlow);
        
        // Store reference
        this.throneModel = throneBase;
    }
    
    // Create simplified person model
    createPersonModel() {
        const personGroup = new THREE.Group();
        
        // Materials
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a3b4c,
            metalness: 0.1,
            roughness: 0.8
        });
        
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0xf1c27d,
            metalness: 0.1,
            roughness: 0.8
        });
        
        // Body parts
        const torsoGeometry = new THREE.BoxGeometry(1, 1.5, 0.5);
        const torso = new THREE.Mesh(torsoGeometry, bodyMaterial);
        torso.position.y = 0.75;
        torso.castShadow = true;
        personGroup.add(torso);
        
        const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.85;
        head.castShadow = true;
        personGroup.add(head);
        
        // Arms
        const armGeometry = new THREE.BoxGeometry(0.25, 1, 0.25);
        
        const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
        leftArm.position.set(0.625, 0.75, 0);
        leftArm.rotation.z = -Math.PI / 4; // Raised arm
        leftArm.castShadow = true;
        personGroup.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
        rightArm.position.set(-0.625, 0.75, 0);
        rightArm.rotation.z = Math.PI / 4; // Raised arm
        rightArm.castShadow = true;
        personGroup.add(rightArm);
        
        // Legs
        const legGeometry = new THREE.BoxGeometry(0.35, 1, 0.35);
        
        const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        leftLeg.position.set(0.3, -0.5, 0);
        leftLeg.castShadow = true;
        personGroup.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        rightLeg.position.set(-0.3, -0.5, 0);
        rightLeg.castShadow = true;
        personGroup.add(rightLeg);
        
        // Add crown
        const crownGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.3, 8);
        const crownMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4af37,
            metalness: 1.0,
            roughness: 0.2
        });
        
        const crown = new THREE.Mesh(crownGeometry, crownMaterial);
        crown.position.y = 2.25;
        crown.castShadow = true;
        personGroup.add(crown);
        
        // Position the person on the throne
        personGroup.position.set(0, 2.5, -7);
        
        // Add to scene
        this.model.add(personGroup);
        
        // Add animation mixer for the person
        this.animationMixer = new THREE.AnimationMixer(personGroup);
        
        // Create a simple animation for arm waving
        const leftArmTrack = new THREE.KeyframeTrack(
            '.children[2].rotation[z]', // Target property
            [0, 1, 2], // Times
            [-Math.PI / 4, -Math.PI / 2, -Math.PI / 4] // Values
        );
        
        const rightArmTrack = new THREE.KeyframeTrack(
            '.children[3].rotation[z]', // Target property
            [0, 1, 2], // Times
            [Math.PI / 4, Math.PI / 2, Math.PI / 4] // Values
        );
        
        const headRotationTrack = new THREE.KeyframeTrack(
            '.children[1].rotation[y]', // Target property
            [0, 1, 2, 3, 4], // Times
            [0, Math.PI / 6, 0, -Math.PI / 6, 0] // Values
        );
        
        const clip = new THREE.AnimationClip('wave', 4, [leftArmTrack, rightArmTrack, headRotationTrack]);
        const action = this.animationMixer.clipAction(clip);
        action.play();
    }
    
    // Create crowd of people
    createCrowd() {
        const crowdGroup = new THREE.Group();
        
        // Materials
        const bodyMaterials = [
            new THREE.MeshStandardMaterial({ color: 0x2a3b4c, roughness: 0.8 }),
            new THREE.MeshStandardMaterial({ color: 0x4c2a3b, roughness: 0.8 }),
            new THREE.MeshStandardMaterial({ color: 0x3b4c2a, roughness: 0.8 })
        ];
        
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0xf1c27d,
            roughness: 0.8
        });
        
        // Create 20 people for the crowd
        for (let i = 0; i < 20; i++) {
            const personGroup = new THREE.Group();
            
            // Randomize body material
            const bodyMaterial = bodyMaterials[Math.floor(Math.random() * bodyMaterials.length)];
            
            // Body parts - simplified for performance
            const bodyGeometry = new THREE.BoxGeometry(0.6, 1.5, 0.3);
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            body.position.y = 0.75;
            body.castShadow = true;
            personGroup.add(body);
            
            const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
            const head = new THREE.Mesh(headGeometry, headMaterial);
            head.position.y = 1.65;
            head.castShadow = true;
            personGroup.add(head);
            
            // Position randomly in front of throne
            const angle = Math.random() * Math.PI - Math.PI / 2;
            const radius = 5 + Math.random() * 7;
            
            personGroup.position.set(
                Math.sin(angle) * radius,
                0,
                Math.cos(angle) * radius
            );
            
            // Random rotation to face throne
            personGroup.rotation.y = Math.atan2(-personGroup.position.x, -personGroup.position.z);
            
            crowdGroup.add(personGroup);
            this.crowdModels.push(personGroup);
        }
        
        this.model.add(crowdGroup);
    }
    
    // Add lighting specific to the leadership scene
    addLighting() {
        // Spotlight on the throne
        const spotlight = new THREE.SpotLight(0xffffff, 2, 30, Math.PI / 6, 0.5, 2);
        spotlight.position.set(0, 15, 0);
        spotlight.target.position.set(0, 0, -7);
        spotlight.castShadow = true;
        
        // Configure shadow properties
        spotlight.shadow.mapSize.width = 1024;
        spotlight.shadow.mapSize.height = 1024;
        spotlight.shadow.camera.near = 1;
        spotlight.shadow.camera.far = 30;
        
        this.model.add(spotlight);
        this.model.add(spotlight.target);
        
        // Add some colored rim lights
        const colors = [0x00ffff, 0xff00ff];
        const positions = [
            new THREE.Vector3(-10, 5, -5),
            new THREE.Vector3(10, 5, -5)
        ];
        
        for (let i = 0; i < colors.length; i++) {
            const pointLight = new THREE.PointLight(colors[i], 1, 20);
            pointLight.position.copy(positions[i]);
            this.model.add(pointLight);
        }
    }
    
    // Show leadership scene
    show() {
        if (this.model) {
            this.model.visible = true;
            this.isVisible = true;
        }
    }
    
    // Hide leadership scene
    hide() {
        if (this.model) {
            this.model.visible = false;
            this.isVisible = false;
        }
    }
    
    // Update leadership scene
    update(delta) {
        if (!this.isVisible) return;
        
        // Update animation mixer
        if (this.animationMixer) {
            this.animationMixer.update(delta);
        }
        
        // Add some subtle movement to the crowd
        this.crowdModels.forEach((person, index) => {
            person.position.y = Math.sin((Date.now() + index * 100) * 0.002) * 0.1;
        });
    }
}
