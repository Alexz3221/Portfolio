// Responsive.js - Handles responsive design and cross-device compatibility

class ResponsiveHandler {
    constructor() {
        this.isMobile = window.innerWidth < 768;
        this.isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
        this.isDesktop = window.innerWidth >= 1024;
        
        // Performance settings
        this.qualitySettings = {
            low: {
                pixelRatio: 0.5,
                shadowMapSize: 512,
                shadowsEnabled: false,
                particleCount: 0.3, // 30% of full
                reflectionsEnabled: false,
                postProcessingEnabled: false
            },
            medium: {
                pixelRatio: 0.75,
                shadowMapSize: 1024,
                shadowsEnabled: true,
                particleCount: 0.6, // 60% of full
                reflectionsEnabled: false,
                postProcessingEnabled: false
            },
            high: {
                pixelRatio: 1,
                shadowMapSize: 2048,
                shadowsEnabled: true,
                particleCount: 1, // 100% of full
                reflectionsEnabled: true,
                postProcessingEnabled: true
            }
        };
        
        // Current quality level
        this.currentQuality = this.determineQualityLevel();
        
        // Initialize
        this.initialize();
    }
    
    // Initialize responsive handler
    initialize() {
        // Add resize listener
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Add device orientation listener for mobile
        if (this.isMobile) {
            window.addEventListener('deviceorientation', this.handleOrientation.bind(this));
        }
        
        // Add touch event listeners
        this.setupTouchEvents();
        
        // Apply initial quality settings
        this.applyQualitySettings();
    }
    
    // Handle window resize
    handleResize() {
        // Update device type
        this.isMobile = window.innerWidth < 768;
        this.isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
        this.isDesktop = window.innerWidth >= 1024;
        
        // Update quality settings if needed
        const newQuality = this.determineQualityLevel();
        if (newQuality !== this.currentQuality) {
            this.currentQuality = newQuality;
            this.applyQualitySettings();
        }
        
        // Update UI elements
        this.updateUIForDeviceSize();
        
        // Update renderer and camera
        if (renderer && camera) {
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.qualitySettings[this.currentQuality].pixelRatio * 2));
            
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        }
    }
    
    // Handle device orientation (for mobile)
    handleOrientation(event) {
        // Only use this for specific features if needed
        // For example, could be used for alternative control scheme
        if (this.isMobile && car) {
            // Example: Use device tilt as an alternative control method
            // This would be optional and configurable
            // const tiltControl = document.getElementById('tilt-control');
            // if (tiltControl && tiltControl.checked) {
            //     const beta = event.beta;  // -180 to 180 (front/back tilt)
            //     const gamma = event.gamma; // -90 to 90 (left/right tilt)
            //     
            //     // Use gamma for steering
            //     if (gamma > 10) car.controls.right = true;
            //     else if (gamma < -10) car.controls.left = true;
            //     else {
            //         car.controls.right = false;
            //         car.controls.left = false;
            //     }
            //     
            //     // Use beta for acceleration
            //     if (beta > 10) car.controls.forward = true;
            //     else if (beta < -10) car.controls.backward = true;
            //     else {
            //         car.controls.forward = false;
            //         car.controls.backward = false;
            //     }
            // }
        }
    }
    
    // Setup touch events
    setupTouchEvents() {
        // Ensure mobile controls are visible on touch devices
        if ('ontouchstart' in window) {
            const mobileControls = document.getElementById('mobile-controls');
            if (mobileControls) {
                mobileControls.style.display = 'flex';
            }
            
            // Add touch-specific CSS class to body
            document.body.classList.add('touch-device');
            
            // Add touch-specific styles
            const style = document.createElement('style');
            style.textContent = `
                .touch-device .nav-button {
                    padding: 12px 20px; /* Larger touch targets */
                }
                
                .touch-device .close-button {
                    font-size: 36px; /* Larger close button */
                    padding: 10px;
                }
                
                .touch-device .info-panel {
                    max-height: 85vh; /* More space on mobile */
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Update UI elements based on device size
    updateUIForDeviceSize() {
        // Show/hide mobile controls
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.style.display = this.isMobile ? 'flex' : 'none';
        }
        
        // Adjust UI element sizes and positions
        if (this.isMobile) {
            // Mobile-specific adjustments
            this.adjustForMobile();
        } else if (this.isTablet) {
            // Tablet-specific adjustments
            this.adjustForTablet();
        } else {
            // Desktop-specific adjustments
            this.adjustForDesktop();
        }
    }
    
    // Mobile-specific adjustments
    adjustForMobile() {
        // Simplify top bar
        const controlsInfo = document.getElementById('controls-info');
        if (controlsInfo) controlsInfo.style.display = 'none';
        
        // Make panels fullscreen
        const infoPanels = document.querySelectorAll('.info-panel');
        infoPanels.forEach(panel => {
            panel.style.width = '95%';
            panel.style.maxWidth = '100%';
            panel.style.maxHeight = '85vh';
        });
        
        // Adjust font sizes
        document.documentElement.style.fontSize = '14px';
    }
    
    // Tablet-specific adjustments
    adjustForTablet() {
        // Partial controls info
        const controlsInfo = document.getElementById('controls-info');
        if (controlsInfo) controlsInfo.style.display = 'flex';
        
        // Adjust panel sizes
        const infoPanels = document.querySelectorAll('.info-panel');
        infoPanels.forEach(panel => {
            panel.style.width = '85%';
            panel.style.maxWidth = '600px';
            panel.style.maxHeight = '80vh';
        });
        
        // Reset font sizes
        document.documentElement.style.fontSize = '16px';
    }
    
    // Desktop-specific adjustments
    adjustForDesktop() {
        // Full controls info
        const controlsInfo = document.getElementById('controls-info');
        if (controlsInfo) controlsInfo.style.display = 'flex';
        
        // Optimal panel sizes
        const infoPanels = document.querySelectorAll('.info-panel');
        infoPanels.forEach(panel => {
            panel.style.width = '80%';
            panel.style.maxWidth = '800px';
            panel.style.maxHeight = '80vh';
        });
        
        // Reset font sizes
        document.documentElement.style.fontSize = '16px';
    }
    
    // Determine appropriate quality level based on device and performance
    determineQualityLevel() {
        // Check for GPU performance (simplified approach)
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
            // WebGL not supported, use lowest settings
            return 'low';
        }
        
        // Get GPU info (this is a simplified approach)
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
        
        // Check device type and renderer info
        if (this.isMobile) {
            // Most mobile devices should use low settings
            // Could check for high-end devices based on renderer string
            return 'low';
        } else if (this.isTablet) {
            // Tablets use medium by default
            return 'medium';
        } else {
            // For desktop, check if it's a high-end GPU
            if (renderer.includes('NVIDIA') || renderer.includes('AMD') || renderer.includes('Radeon')) {
                return 'high';
            } else {
                return 'medium';
            }
        }
    }
    
    // Apply quality settings to renderer and scene
    applyQualitySettings() {
        const settings = this.qualitySettings[this.currentQuality];
        
        if (renderer) {
            // Set pixel ratio
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatio * 2));
            
            // Configure shadows
            renderer.shadowMap.enabled = settings.shadowsEnabled;
            
            if (settings.shadowsEnabled) {
                // Update shadow map size for all lights
                scene.traverse(object => {
                    if (object.isLight && object.shadow) {
                        object.shadow.mapSize.width = settings.shadowMapSize;
                        object.shadow.mapSize.height = settings.shadowMapSize;
                        object.shadow.map && object.shadow.map.dispose();
                        object.shadow.map = null;
                    }
                });
            }
        }
        
        // Adjust particle count for decorative elements
        if (environment && environment.decorativeCubes) {
            const maxCubes = 20; // Original count
            const targetCount = Math.floor(maxCubes * settings.particleCount);
            
            environment.decorativeCubes.forEach((cube, index) => {
                cube.visible = index < targetCount;
            });
        }
        
        // Toggle reflections
        if (environment && environment.reflectionMaterial) {
            environment.reflectionMaterial.visible = settings.reflectionsEnabled;
        }
        
        // Add a quality indicator in debug mode
        this.showQualityIndicator();
    }
    
    // Show quality indicator (for debugging)
    showQualityIndicator() {
        let indicator = document.getElementById('quality-indicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'quality-indicator';
            indicator.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.5);
                color: white;
                padding: 5px 10px;
                font-size: 12px;
                z-index: 1000;
                font-family: monospace;
                pointer-events: none;
            `;
            document.body.appendChild(indicator);
        }
        
        indicator.textContent = `Quality: ${this.currentQuality.toUpperCase()}`;
        
        // Add color based on quality
        switch (this.currentQuality) {
            case 'low':
                indicator.style.color = '#ff9900';
                break;
            case 'medium':
                indicator.style.color = '#ffff00';
                break;
            case 'high':
                indicator.style.color = '#00ff00';
                break;
        }
    }
    
    // Add performance monitoring
    addPerformanceMonitoring() {
        // Create FPS counter
        const fpsCounter = document.createElement('div');
        fpsCounter.id = 'fps-counter';
        fpsCounter.style.cssText = `
            position: fixed;
            top: 70px;
            right: 10px;
            background: rgba(0, 0, 0, 0.5);
            color: white;
            padding: 5px 10px;
            font-size: 12px;
            z-index: 1000;
            font-family: monospace;
            pointer-events: none;
        `;
        document.body.appendChild(fpsCounter);
        
        // FPS tracking variables
        let frameCount = 0;
        let lastTime = performance.now();
        
        // Update FPS counter
        function updateFPS() {
            frameCount++;
            
            const currentTime = performance.now();
            const elapsed = currentTime - lastTime;
            
            if (elapsed >= 1000) {
                const fps = Math.round((frameCount * 1000) / elapsed);
                fpsCounter.textContent = `FPS: ${fps}`;
                
                // Color code based on performance
                if (fps < 30) {
                    fpsCounter.style.color = '#ff0000'; // Red for poor performance
                } else if (fps < 50) {
                    fpsCounter.style.color = '#ffff00'; // Yellow for acceptable
                } else {
                    fpsCounter.style.color = '#00ff00'; // Green for good
                }
                
                // Auto-adjust quality if performance is poor
                if (fps < 20 && this.currentQuality !== 'low') {
                    this.currentQuality = 'low';
                    this.applyQualitySettings();
                } else if (fps > 40 && fps < 50 && this.currentQuality === 'low') {
                    this.currentQuality = 'medium';
                    this.applyQualitySettings();
                } else if (fps > 55 && this.currentQuality === 'medium' && this.isDesktop) {
                    this.currentQuality = 'high';
                    this.applyQualitySettings();
                }
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(updateFPS);
        }
        
        // Start monitoring
        updateFPS();
    }
}

// Initialize responsive handler when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.responsiveHandler = new ResponsiveHandler();
});
