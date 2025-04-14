// Projects.js - Handles project showcase areas

class Project {
    constructor(id, title, description, technologies, position, color, scale = 1) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.technologies = technologies;
        this.position = position;
        this.color = color;
        this.scale = scale;
        this.mesh = null;
        this.glowMesh = null;
        this.infoPanel = null;
        this.isActive = false;
        this.hoverAnimation = null;
    }
}

// Global variables
let projects = [];
let currentProject = null;
let projectsLoaded = false;

// Initialize projects
function initProjects() {
    // Create project data
    projects = [
        new Project(
            'edvise',
            'Edvise',
            'A comprehensive tool for course planning built using modern web technologies. Edvise helps students plan their academic journey with an intuitive interface and powerful backend integration. The application was developed using Agile methodologies and features robust cloud integration for seamless data synchronization.',
            ['JavaScript', 'React', 'Firebase', 'Node.js', 'Express.js', 'Agile Development', 'Cloud Integration'],
            new THREE.Vector3(20, 0, 20),
            0x00ffff,
            1.5 // Larger scale for emphasis as requested
        ),
        new Project(
            'neurips',
            'NeurIPS LLM Attack Event',
            'A sophisticated Python-based project utilizing advanced machine learning frameworks. This project focused on the challenge of extracting training data from Large Language Models, achieving 7th place in an international competition. The implementation demonstrates expertise in neural network architecture and data security concepts.',
            ['Python', 'PyTorch', 'TensorFlow', 'Machine Learning', 'LLM', 'Data Security'],
            new THREE.Vector3(-20, 0, 20),
            0xff00ff
        ),
        new Project(
            'genai',
            'GenAI',
            'An innovative iOS application developed in Swift that leverages the OpenAI API for image generation. This mobile app allows users to create unique AI-generated imagery through intuitive prompts and controls, showcasing the integration of cutting-edge AI capabilities in mobile applications.',
            ['Swift', 'iOS Development', 'OpenAI API', 'Mobile Development', 'UI/UX Design'],
            new THREE.Vector3(20, 0, -20),
            0xffff00
        ),
        new Project(
            'boulder',
            'Boulder Launchpad Map',
            'An interactive map of Boulder startups designed to connect students with industry experts. This web-based platform visualizes the local startup ecosystem, providing valuable networking opportunities and resources for students interested in entrepreneurship and innovation.',
            ['Web Development', 'Mapping Technologies', 'Database Integration', 'Networking Platform'],
            new THREE.Vector3(-20, 0, -20),
            0x00ff00
        )
    ];
}

// Load project showcase areas
async function loadProjects() {
    return new Promise((resolve) => {
        // Create project showcases
        projects.forEach(project => {
            createProjectShowcase(project);
        });
        
        // Setup project info panels
        setupProjectInfoPanels();
        
        projectsLoaded = true;
        resolve();
    });
}

// Create visual representation for a project
function createProjectShowcase(project) {
    // Create base platform
    const platformGeometry = new THREE.CylinderGeometry(5, 5, 0.5, 32);
    const platformMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.8,
        roughness: 0.2
    });
    
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.copy(project.position);
    platform.position.y = 0.25; // Half height
    platform.receiveShadow = true;
    scene.add(platform);
    
    // Create project hologram
    const hologramGeometry = new THREE.IcosahedronGeometry(2, 1);
    const hologramMaterial = new THREE.MeshPhysicalMaterial({
        color: project.color,
        metalness: 0.2,
        roughness: 0.1,
        transmission: 0.9,
        transparent: true,
        opacity: 0.7
    });
    
    const hologram = new THREE.Mesh(hologramGeometry, hologramMaterial);
    hologram.position.copy(project.position);
    hologram.position.y = 4; // Position above platform
    hologram.scale.multiplyScalar(project.scale);
    hologram.castShadow = true;
    hologram.userData.project = project;
    scene.add(hologram);
    
    // Add glow effect
    const glowGeometry = new THREE.IcosahedronGeometry(2.2, 1);
    const glowMaterial = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(project.color) },
            time: { value: 0 }
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            uniform float time;
            varying vec3 vNormal;
            varying vec3 vPosition;
            
            void main() {
                float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
                intensity = intensity * 1.5 + 0.5 * sin(time * 2.0);
                gl_FragColor = vec4(color, intensity * 0.5);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(hologram.position);
    glow.scale.multiplyScalar(project.scale);
    scene.add(glow);
    
    // Add floating text
    const textPosition = new THREE.Vector3(
        project.position.x,
        project.position.y + 7,
        project.position.z
    );
    
    createFloatingText(project.title, textPosition, project.color);
    
    // Store references
    project.mesh = hologram;
    project.glowMesh = glow;
    
    // Add interaction area
    const interactionGeometry = new THREE.SphereGeometry(5, 16, 16);
    const interactionMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false
    });
    
    const interactionArea = new THREE.Mesh(interactionGeometry, interactionMaterial);
    interactionArea.position.copy(project.position);
    interactionArea.position.y = 4;
    interactionArea.userData.project = project;
    interactionArea.userData.isInteractive = true;
    interactionArea.userData.type = 'project';
    scene.add(interactionArea);
}

// Create floating text for project titles
function createFloatingText(text, position, color) {
    // In a real implementation, you would create 3D text with Three.js
    // For this template, we'll create a simple canvas texture
    
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
    const geometry = new THREE.PlaneGeometry(10, 2.5);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    
    // Always face camera
    mesh.userData.isFloatingText = true;
    
    scene.add(mesh);
    return mesh;
}

// Setup project info panels in the UI
function setupProjectInfoPanels() {
    const projectInfo = document.getElementById('project-info');
    const projectTitle = document.getElementById('project-title');
    const projectDescription = document.getElementById('project-description');
    const projectTech = document.getElementById('project-tech');
    
    // Add close button functionality
    const closeButton = projectInfo.querySelector('.close-button');
    closeButton.addEventListener('click', () => {
        projectInfo.classList.remove('active');
        if (currentProject) {
            currentProject.isActive = false;
        }
    });
    
    // Store references
    projects.forEach(project => {
        project.infoPanel = {
            element: projectInfo,
            titleElement: projectTitle,
            descriptionElement: projectDescription,
            techElement: projectTech
        };
    });
}

// Show project info panel
function showProjectInfo(project) {
    if (!project || !project.infoPanel) return;
    
    // Update panel content
    project.infoPanel.titleElement.textContent = project.title;
    project.infoPanel.descriptionElement.textContent = project.description;
    
    // Clear and update technologies
    project.infoPanel.techElement.innerHTML = '';
    project.technologies.forEach(tech => {
        const span = document.createElement('span');
        span.textContent = tech;
        project.infoPanel.techElement.appendChild(span);
    });
    
    // Show panel
    project.infoPanel.element.classList.add('active');
    project.isActive = true;
    currentProject = project;
}

// Check for project interactions
function checkProjectInteractions() {
    // This would be called from the main interaction system
    // For now, we'll implement a simple distance-based check
    
    if (!car || !projects.length) return;
    
    projects.forEach(project => {
        const distance = car.position.distanceTo(project.position);
        
        // If close enough to interact
        if (distance < 8) {
            // Show interaction prompt
            // In a real implementation, you would show a UI element
            
            // Check for interaction key press
            if (car.controls.brake && !project.isActive) {
                showProjectInfo(project);
            }
        }
    });
}

// Update projects
function updateProjects(delta) {
    if (!projectsLoaded) return;
    
    // Update project holograms
    projects.forEach(project => {
        if (project.mesh) {
            // Rotate hologram
            project.mesh.rotation.y += 0.005;
            
            // Floating animation
            project.mesh.position.y = project.position.y + 4 + Math.sin(Date.now() * 0.001) * 0.5;
        }
        
        if (project.glowMesh && project.glowMesh.material.uniforms) {
            // Update glow effect
            project.glowMesh.material.uniforms.time.value += delta;
            project.glowMesh.position.copy(project.mesh.position);
        }
    });
    
    // Update floating text to face camera
    scene.traverse(object => {
        if (object.userData.isFloatingText) {
            object.lookAt(camera.position);
        }
    });
    
    // Check for interactions
    checkProjectInteractions();
}
