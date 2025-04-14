// Car.js - Handles the luxury car avatar for navigation

class Car {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.model = null;
        this.mixer = null;
        this.actions = {};
        
        // Car movement properties
        this.position = new THREE.Vector3(0, 0, 0);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.speed = 0;
        this.maxSpeed = 0.5;
        this.acceleration = 0.01;
        this.deceleration = 0.05;
        this.rotationSpeed = 0.05;
        
        // Control states
        this.controls = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            brake: false
        };
        
        // Camera follow properties
        this.cameraOffset = new THREE.Vector3(0, 5, 10);
        this.cameraLookAt = new THREE.Vector3(0, 0, 0);
        this.cameraLerpFactor = 0.05;
        
        // Setup input handlers
        this.setupInputHandlers();
        
        // Mobile controls
        this.joystickActive = false;
        this.joystickPosition = { x: 0, y: 0 };
        this.setupMobileControls();
    }
    
    // Load car model
    async load() {
        return new Promise((resolve, reject) => {
            // Use a placeholder car model for now
            // In a real implementation, you would load a GLTF model
            this.createPlaceholderCar();
            
            // Add car lights
            this.addCarLights();
            
            resolve();
        });
    }
    
    // Create a placeholder luxury car model
    createPlaceholderCar() {
        // Create a group to hold all car parts
        this.model = new THREE.Group();
        
        // Car body material with metallic finish
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.9,
            roughness: 0.2,
            envMapIntensity: 1.0
        });
        
        // Window material
        const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x000000,
            metalness: 0.9,
            roughness: 0.1,
            transmission: 0.9,
            transparent: true
        });
        
        // Headlight material
        const headlightMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 1.0
        });
        
        // Taillight material
        const taillightMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 1.0
        });
        
        // Wheel material
        const wheelMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.5,
            roughness: 0.7
        });
        
        // Create car body (main chassis)
        const bodyGeometry = new THREE.BoxGeometry(4, 1, 8);
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1;
        body.castShadow = true;
        body.receiveShadow = true;
        this.model.add(body);
        
        // Create car roof
        const roofGeometry = new THREE.BoxGeometry(3.5, 1, 4);
        const roof = new THREE.Mesh(roofGeometry, bodyMaterial);
        roof.position.y = 2;
        roof.position.z = -0.5;
        roof.castShadow = true;
        roof.receiveShadow = true;
        this.model.add(roof);
        
        // Create windshield
        const windshieldGeometry = new THREE.BoxGeometry(3.4, 1, 0.1);
        const windshield = new THREE.Mesh(windshieldGeometry, glassMaterial);
        windshield.position.y = 1.5;
        windshield.position.z = 1.5;
        windshield.rotation.x = Math.PI / 6;
        this.model.add(windshield);
        
        // Create rear window
        const rearWindowGeometry = new THREE.BoxGeometry(3.4, 1, 0.1);
        const rearWindow = new THREE.Mesh(rearWindowGeometry, glassMaterial);
        rearWindow.position.y = 1.5;
        rearWindow.position.z = -2.5;
        rearWindow.rotation.x = -Math.PI / 6;
        this.model.add(rearWindow);
        
        // Create side windows
        const sideWindowGeometry = new THREE.BoxGeometry(0.1, 0.8, 4);
        
        const leftWindow = new THREE.Mesh(sideWindowGeometry, glassMaterial);
        leftWindow.position.x = 1.75;
        leftWindow.position.y = 1.5;
        leftWindow.position.z = -0.5;
        this.model.add(leftWindow);
        
        const rightWindow = new THREE.Mesh(sideWindowGeometry, glassMaterial);
        rightWindow.position.x = -1.75;
        rightWindow.position.y = 1.5;
        rightWindow.position.z = -0.5;
        this.model.add(rightWindow);
        
        // Create wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.7, 0.7, 0.5, 32);
        wheelGeometry.rotateZ(Math.PI / 2);
        
        // Front left wheel
        const frontLeftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        frontLeftWheel.position.set(2, 0.7, 2);
        frontLeftWheel.castShadow = true;
        this.model.add(frontLeftWheel);
        
        // Front right wheel
        const frontRightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        frontRightWheel.position.set(-2, 0.7, 2);
        frontRightWheel.castShadow = true;
        this.model.add(frontRightWheel);
        
        // Rear left wheel
        const rearLeftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        rearLeftWheel.position.set(2, 0.7, -2);
        rearLeftWheel.castShadow = true;
        this.model.add(rearLeftWheel);
        
        // Rear right wheel
        const rearRightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        rearRightWheel.position.set(-2, 0.7, -2);
        rearRightWheel.castShadow = true;
        this.model.add(rearRightWheel);
        
        // Create headlights
        const headlightGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        
        const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        leftHeadlight.position.set(1.5, 1, 4);
        this.model.add(leftHeadlight);
        
        const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        rightHeadlight.position.set(-1.5, 1, 4);
        this.model.add(rightHeadlight);
        
        // Create taillights
        const taillightGeometry = new THREE.BoxGeometry(1, 0.3, 0.1);
        
        const leftTaillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
        leftTaillight.position.set(1.5, 1, -4);
        this.model.add(leftTaillight);
        
        const rightTaillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
        rightTaillight.position.set(-1.5, 1, -4);
        this.model.add(rightTaillight);
        
        // Add car to scene
        this.scene.add(this.model);
        
        // Set initial position
        this.model.position.y = 0.7; // Adjust to sit on ground
    }
    
    // Add car lights (for night effect)
    addCarLights() {
        // Add headlight beams
        const headlightBeamGeometry = new THREE.CylinderGeometry(0.1, 3, 15, 32, 1, true);
        const headlightBeamMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        
        // Left headlight beam
        const leftHeadlightBeam = new THREE.Mesh(headlightBeamGeometry, headlightBeamMaterial);
        leftHeadlightBeam.position.set(1.5, 1, 4);
        leftHeadlightBeam.rotation.x = Math.PI / 2;
        leftHeadlightBeam.position.z += 7.5; // Position in front of car
        this.model.add(leftHeadlightBeam);
        
        // Right headlight beam
        const rightHeadlightBeam = new THREE.Mesh(headlightBeamGeometry, headlightBeamMaterial);
        rightHeadlightBeam.position.set(-1.5, 1, 4);
        rightHeadlightBeam.rotation.x = Math.PI / 2;
        rightHeadlightBeam.position.z += 7.5; // Position in front of car
        this.model.add(rightHeadlightBeam);
        
        // Add actual light sources
        const leftLight = new THREE.SpotLight(0xffffff, 1, 50, Math.PI / 6, 0.5, 2);
        leftLight.position.set(1.5, 1, 4);
        leftLight.target.position.set(1.5, 0, 20);
        this.model.add(leftLight);
        this.model.add(leftLight.target);
        
        const rightLight = new THREE.SpotLight(0xffffff, 1, 50, Math.PI / 6, 0.5, 2);
        rightLight.position.set(-1.5, 1, 4);
        rightLight.target.position.set(-1.5, 0, 20);
        this.model.add(rightLight);
        this.model.add(rightLight.target);
    }
    
    // Setup keyboard and mouse input handlers
    setupInputHandlers() {
        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event.code);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event.code);
        });
        
        // Mouse controls for looking around
        document.addEventListener('mousemove', (event) => {
            // Only implement if needed
        });
    }
    
    // Setup mobile controls
    setupMobileControls() {
        const joystickBase = document.getElementById('joystick-base');
        const joystickThumb = document.getElementById('joystick-thumb');
        const interactButton = document.getElementById('interact-button');
        
        if (!joystickBase || !joystickThumb) return;
        
        // Joystick touch events
        joystickBase.addEventListener('touchstart', (event) => {
            this.joystickActive = true;
            this.updateJoystickPosition(event);
        });
        
        document.addEventListener('touchmove', (event) => {
            if (this.joystickActive) {
                this.updateJoystickPosition(event);
                event.preventDefault();
            }
        });
        
        document.addEventListener('touchend', () => {
            this.joystickActive = false;
            this.joystickPosition = { x: 0, y: 0 };
            
            // Reset joystick thumb position
            if (joystickThumb) {
                joystickThumb.style.transform = `translate(0px, 0px)`;
            }
            
            // Reset controls
            this.controls.forward = false;
            this.controls.backward = false;
            this.controls.left = false;
            this.controls.right = false;
        });
        
        // Interact button
        if (interactButton) {
            interactButton.addEventListener('touchstart', () => {
                // Trigger interaction
                document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
            });
            
            interactButton.addEventListener('touchend', () => {
                document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
            });
        }
    }
    
    // Update joystick position and controls
    updateJoystickPosition(event) {
        const joystickBase = document.getElementById('joystick-base');
        const joystickThumb = document.getElementById('joystick-thumb');
        
        if (!joystickBase || !joystickThumb) return;
        
        const touch = event.touches[0];
        const rect = joystickBase.getBoundingClientRect();
        
        // Calculate joystick position relative to base center
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let posX = touch.clientX - centerX;
        let posY = touch.clientY - centerY;
        
        // Limit joystick movement to a circle
        const radius = rect.width / 2;
        const distance = Math.sqrt(posX * posX + posY * posY);
        
        if (distance > radius) {
            posX = (posX / distance) * radius;
            posY = (posY / distance) * radius;
        }
        
        // Update joystick thumb position
        joystickThumb.style.transform = `translate(${posX}px, ${posY}px)`;
        
        // Normalize joystick position (-1 to 1)
        this.joystickPosition = {
            x: posX / radius,
            y: posY / radius
        };
        
        // Update controls based on joystick position
        this.controls.forward = this.joystickPosition.y < -0.3;
        this.controls.backward = this.joystickPosition.y > 0.3;
        this.controls.left = this.joystickPosition.x < -0.3;
        this.controls.right = this.joystickPosition.x > 0.3;
    }
    
    // Handle key down events
    handleKeyDown(code) {
        switch (code) {
            case 'KeyW':
            case 'ArrowUp':
                this.controls.forward = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.controls.backward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.controls.left = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.controls.right = true;
                break;
            case 'Space':
                this.controls.brake = true;
                break;
        }
    }
    
    // Handle key up events
    handleKeyUp(code) {
        switch (code) {
            case 'KeyW':
            case 'ArrowUp':
                this.controls.forward = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.controls.backward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.controls.left = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.controls.right = false;
                break;
            case 'Space':
                this.controls.brake = false;
                break;
        }
    }
    
    // Update car position and rotation
    update(delta) {
        // Handle acceleration and deceleration
        if (this.controls.forward) {
            this.speed += this.acceleration;
        } else if (this.controls.backward) {
            this.speed -= this.acceleration;
        } else {
            // Gradually slow down
            if (this.speed > 0) {
                this.speed -= this.deceleration;
                if (this.speed < 0) this.speed = 0;
            } else if (this.speed < 0) {
                this.speed += this.deceleration;
                if (this.speed > 0) this.speed = 0;
            }
        }
        
        // Apply braking
        if (this.controls.brake) {
            this.speed *= 0.9;
        }
        
        // Clamp speed
        this.speed = THREE.MathUtils.clamp(this.speed, -this.maxSpeed, this.maxSpeed);
        
        // Handle rotation
        if (this.speed !== 0) {
            if (this.controls.left) {
                this.rotation.y += this.rotationSpeed;
            }
            if (this.controls.right) {
                this.rotation.y -= this.rotationSpeed;
            }
        }
        
        // Update position based on speed and rotation
        const moveX = Math.sin(this.rotation.y) * this.speed;
        const moveZ = Math.cos(this.rotation.y) * this.speed;
        
        this.position.x += moveX;
        this.position.z += moveZ;
        
        // Update model position and rotation
        if (this.model) {
            this.model.position.x = this.position.x;
            this.model.position.z = this.position.z;
            this.model.rotation.y = this.rotation.y;
            
            // Add a slight tilt when turning
            const tiltIntensity = 0.1;
            if (this.controls.left && this.speed !== 0) {
                this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, tiltIntensity, 0.1);
            } else if (this.controls.right && this.speed !== 0) {
                this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, -tiltIntensity, 0.1);
            } else {
                this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, 0, 0.1);
            }
        }
        
        // Update camera position to follow car
        this.updateCamera();
    }
    
    // Update camera to follow car
    updateCamera() {
        // Calculate ideal camera position behind the car
        const idealOffset = new THREE.Vector3(
            -Math.sin(this.rotation.y) * this.cameraOffset.z,
            this.cameraOffset.y,
            -Math.cos(this.rotation.y) * this.cameraOffset.z
        );
        
        // Add to car position
        idealOffset.add(this.position);
        
        // Smoothly move camera to ideal position
        this.camera.position.lerp(idealOffset, this.cameraLerpFactor);
        
        // Calculate look at position (slightly ahead of car)
        const lookAtPosition = new THREE.Vector3(
            this.position.x + Math.sin(this.rotation.y) * 5,
            this.position.y + 1,
            this.position.z + Math.cos(this.rotation.y) * 5
        );
        
        // Smoothly update camera target
        this.cameraLookAt.lerp(lookAtPosition, this.cameraLerpFactor);
        this.camera.lookAt(this.cameraLookAt);
    }
}
