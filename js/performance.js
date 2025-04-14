// Performance.js - Handles performance testing and optimization

class PerformanceTester {
    constructor() {
        this.stats = null;
        this.fpsHistory = [];
        this.memoryHistory = [];
        this.testResults = {};
        this.testInProgress = false;
        this.testDuration = 10000; // 10 seconds per test
        this.testStartTime = 0;
        this.currentTest = '';
        this.testQueue = [];
        
        // Performance thresholds
        this.thresholds = {
            fps: {
                good: 50,
                acceptable: 30,
                poor: 20
            },
            memory: {
                good: 100, // MB
                acceptable: 200, // MB
                poor: 300 // MB
            },
            loadTime: {
                good: 2000, // ms
                acceptable: 5000, // ms
                poor: 8000 // ms
            }
        };
    }
    
    // Initialize performance tester
    initialize() {
        // Create stats panel if not already created
        if (!this.stats) {
            this.stats = new Stats();
            this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb
            this.stats.dom.style.cssText = 'position:absolute;top:0;right:0;cursor:pointer;opacity:0.9;z-index:10000';
            document.body.appendChild(this.stats.dom);
        }
        
        // Create test results panel
        this.createResultsPanel();
        
        // Setup test queue
        this.setupTestQueue();
    }
    
    // Create results panel
    createResultsPanel() {
        const resultsPanel = document.createElement('div');
        resultsPanel.id = 'performance-results';
        resultsPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            font-family: monospace;
            z-index: 10000;
            max-width: 80%;
            max-height: 80%;
            overflow-y: auto;
            display: none;
            border: 1px solid #00ffff;
            box-shadow: 0 0 20px #00ffff;
        `;
        
        // Add header
        const header = document.createElement('h2');
        header.textContent = 'Performance Test Results';
        header.style.cssText = `
            color: #00ffff;
            text-align: center;
            margin-top: 0;
            border-bottom: 1px solid #00ffff;
            padding-bottom: 10px;
        `;
        resultsPanel.appendChild(header);
        
        // Add results container
        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'results-container';
        resultsPanel.appendChild(resultsContainer);
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.cssText = `
            background: transparent;
            border: 1px solid #00ffff;
            color: #00ffff;
            padding: 8px 15px;
            margin-top: 15px;
            cursor: pointer;
            font-family: 'Orbitron', sans-serif;
            display: block;
            margin-left: auto;
            margin-right: auto;
        `;
        closeButton.addEventListener('click', () => {
            resultsPanel.style.display = 'none';
        });
        resultsPanel.appendChild(closeButton);
        
        document.body.appendChild(resultsPanel);
    }
    
    // Setup test queue
    setupTestQueue() {
        this.testQueue = [
            'idle',
            'navigation',
            'projectInteraction',
            'uiInteraction',
            'cameraMovement'
        ];
    }
    
    // Start performance tests
    startTests() {
        if (this.testInProgress) return;
        
        // Reset results
        this.testResults = {};
        
        // Show loading indicator
        this.showLoadingIndicator('Starting performance tests...');
        
        // Start first test after a short delay
        setTimeout(() => {
            this.runNextTest();
        }, 1000);
    }
    
    // Run next test in queue
    runNextTest() {
        if (this.testQueue.length === 0) {
            this.finishTests();
            return;
        }
        
        // Get next test
        this.currentTest = this.testQueue.shift();
        
        // Reset metrics
        this.fpsHistory = [];
        this.memoryHistory = [];
        
        // Show current test
        this.showLoadingIndicator(`Testing: ${this.formatTestName(this.currentTest)}...`);
        
        // Start test
        this.testInProgress = true;
        this.testStartTime = performance.now();
        
        // Setup test scenario
        this.setupTestScenario(this.currentTest);
        
        // Start collecting metrics
        this.collectMetrics();
    }
    
    // Setup specific test scenario
    setupTestScenario(testName) {
        // Reset camera and car position
        if (car) {
            car.position = new THREE.Vector3(0, 0, 0);
            car.rotation = new THREE.Euler(0, 0, 0);
            car.speed = 0;
            
            // Reset controls
            car.controls.forward = false;
            car.controls.backward = false;
            car.controls.left = false;
            car.controls.right = false;
            car.controls.brake = false;
        }
        
        // Hide all panels
        const panels = document.querySelectorAll('.info-panel');
        panels.forEach(panel => {
            panel.classList.remove('active');
        });
        
        // Setup specific scenario
        switch (testName) {
            case 'idle':
                // Just idle scene, nothing to do
                break;
                
            case 'navigation':
                // Simulate car movement
                if (car) {
                    car.controls.forward = true;
                    
                    // Alternate left and right every second
                    this.navigationInterval = setInterval(() => {
                        car.controls.left = !car.controls.left;
                        car.controls.right = !car.controls.right;
                    }, 1000);
                }
                break;
                
            case 'projectInteraction':
                // Show project info panel
                const projectInfo = document.getElementById('project-info');
                if (projectInfo) {
                    projectInfo.classList.add('active');
                }
                
                // Move car around project areas
                if (car) {
                    car.position = new THREE.Vector3(15, 0, 15);
                    car.controls.forward = true;
                    
                    // Circle around
                    this.navigationInterval = setInterval(() => {
                        car.controls.left = true;
                    }, 500);
                }
                break;
                
            case 'uiInteraction':
                // Show skills panel
                const skillsPanel = document.getElementById('skills-panel');
                if (skillsPanel) {
                    skillsPanel.classList.add('active');
                }
                
                // Simulate UI interactions
                this.uiInterval = setInterval(() => {
                    // Toggle random panels
                    const panels = [
                        'skills-panel',
                        'leadership-panel',
                        'contact-panel',
                        'intro-panel'
                    ];
                    
                    const randomPanel = panels[Math.floor(Math.random() * panels.length)];
                    const panel = document.getElementById(randomPanel);
                    
                    if (panel) {
                        // Hide all panels
                        panels.forEach(p => {
                            const el = document.getElementById(p);
                            if (el) el.classList.remove('active');
                        });
                        
                        // Show random panel
                        panel.classList.add('active');
                    }
                }, 2000);
                break;
                
            case 'cameraMovement':
                // Simulate camera movement
                if (camera) {
                    this.originalCameraPosition = camera.position.clone();
                    this.cameraMovementTime = 0;
                    
                    this.cameraInterval = setInterval(() => {
                        // Move camera in a circle
                        this.cameraMovementTime += 0.05;
                        const radius = 20;
                        const x = Math.sin(this.cameraMovementTime) * radius;
                        const z = Math.cos(this.cameraMovementTime) * radius;
                        
                        camera.position.set(x, 10, z);
                        camera.lookAt(0, 0, 0);
                    }, 16);
                }
                break;
        }
    }
    
    // Clean up test scenario
    cleanupTestScenario() {
        // Clear intervals
        clearInterval(this.navigationInterval);
        clearInterval(this.uiInterval);
        clearInterval(this.cameraInterval);
        
        // Reset car controls
        if (car) {
            car.controls.forward = false;
            car.controls.backward = false;
            car.controls.left = false;
            car.controls.right = false;
            car.controls.brake = false;
        }
        
        // Reset camera position
        if (camera && this.originalCameraPosition) {
            camera.position.copy(this.originalCameraPosition);
            camera.lookAt(0, 0, 0);
        }
    }
    
    // Collect performance metrics
    collectMetrics() {
        // Check if test is complete
        const elapsed = performance.now() - this.testStartTime;
        
        if (elapsed >= this.testDuration) {
            // Test complete
            this.finishCurrentTest();
            return;
        }
        
        // Collect FPS
        if (this.stats) {
            const fps = this.stats.getFPS();
            this.fpsHistory.push(fps);
        }
        
        // Collect memory usage if available
        if (window.performance && window.performance.memory) {
            const memoryUsed = window.performance.memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
            this.memoryHistory.push(memoryUsed);
        }
        
        // Continue collecting
        requestAnimationFrame(() => this.collectMetrics());
    }
    
    // Finish current test
    finishCurrentTest() {
        // Clean up test scenario
        this.cleanupTestScenario();
        
        // Calculate metrics
        const avgFps = this.calculateAverage(this.fpsHistory);
        const minFps = Math.min(...this.fpsHistory);
        const maxFps = Math.max(...this.fpsHistory);
        
        let avgMemory = 0;
        let minMemory = 0;
        let maxMemory = 0;
        
        if (this.memoryHistory.length > 0) {
            avgMemory = this.calculateAverage(this.memoryHistory);
            minMemory = Math.min(...this.memoryHistory);
            maxMemory = Math.max(...this.memoryHistory);
        }
        
        // Store results
        this.testResults[this.currentTest] = {
            fps: {
                avg: avgFps,
                min: minFps,
                max: maxFps,
                rating: this.getRating(avgFps, 'fps')
            },
            memory: {
                avg: avgMemory,
                min: minMemory,
                max: maxMemory,
                rating: this.getRating(avgMemory, 'memory')
            }
        };
        
        // Test is no longer in progress
        this.testInProgress = false;
        
        // Run next test
        setTimeout(() => {
            this.runNextTest();
        }, 1000);
    }
    
    // Finish all tests
    finishTests() {
        // Hide loading indicator
        this.hideLoadingIndicator();
        
        // Calculate overall score
        const overallScore = this.calculateOverallScore();
        
        // Display results
        this.displayResults(overallScore);
        
        // Apply optimizations based on results
        this.applyOptimizations(overallScore);
    }
    
    // Calculate average of array
    calculateAverage(arr) {
        if (arr.length === 0) return 0;
        const sum = arr.reduce((a, b) => a + b, 0);
        return sum / arr.length;
    }
    
    // Get rating for a metric
    getRating(value, metric) {
        const thresholds = this.thresholds[metric];
        
        if (metric === 'fps') {
            if (value >= thresholds.good) return 'good';
            if (value >= thresholds.acceptable) return 'acceptable';
            return 'poor';
        } else if (metric === 'memory') {
            if (value <= thresholds.good) return 'good';
            if (value <= thresholds.acceptable) return 'acceptable';
            return 'poor';
        } else if (metric === 'loadTime') {
            if (value <= thresholds.good) return 'good';
            if (value <= thresholds.acceptable) return 'acceptable';
            return 'poor';
        }
        
        return 'unknown';
    }
    
    // Calculate overall score
    calculateOverallScore() {
        let fpsScore = 0;
        let memoryScore = 0;
        let testCount = 0;
        
        // Calculate scores for each test
        for (const testName in this.testResults) {
            const test = this.testResults[testName];
            
            // FPS score (0-100)
            const fpsRating = test.fps.rating;
            if (fpsRating === 'good') fpsScore += 100;
            else if (fpsRating === 'acceptable') fpsScore += 60;
            else fpsScore += 30;
            
            // Memory score (0-100)
            const memoryRating = test.memory.rating;
            if (memoryRating === 'good') memoryScore += 100;
            else if (memoryRating === 'acceptable') memoryScore += 60;
            else memoryScore += 30;
            
            testCount++;
        }
        
        // Calculate averages
        fpsScore = testCount > 0 ? fpsScore / testCount : 0;
        memoryScore = testCount > 0 ? memoryScore / testCount : 0;
        
        // Overall score (weighted)
        const overallScore = (fpsScore * 0.7) + (memoryScore * 0.3);
        
        return {
            overall: overallScore,
            fps: fpsScore,
            memory: memoryScore,
            rating: this.getOverallRating(overallScore)
        };
    }
    
    // Get overall rating
    getOverallRating(score) {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'acceptable';
        return 'poor';
    }
    
    // Display test results
    displayResults(overallScore) {
        const resultsPanel = document.getElementById('performance-results');
        const resultsContainer = document.getElementById('results-container');
        
        if (!resultsPanel || !resultsContainer) return;
        
        // Clear previous results
        resultsContainer.innerHTML = '';
        
        // Add overall score
        const overallScoreElement = document.createElement('div');
        overallScoreElement.className = 'overall-score';
        overallScoreElement.innerHTML = `
            <h3>Overall Performance: ${Math.round(overallScore.overall)}%</h3>
            <div class="rating ${overallScore.rating}">${overallScore.rating.toUpperCase()}</div>
            <div class="score-breakdown">
                <div class="score-item">
                    <span>FPS Performance:</span>
                    <span>${Math.round(overallScore.fps)}%</span>
                </div>
                <div class="score-item">
                    <span>Memory Usage:</span>
                    <span>${Math.round(overallScore.memory)}%</span>
                </div>
            </div>
        `;
        resultsContainer.appendChild(overallScoreElement);
        
        // Add individual test results
        const testsElement = document.createElement('div');
        testsElement.className = 'test-results';
        
        for (const testName in this.testResults) {
            const test = this.testResults[testName];
            
            const testElement = document.createElement('div');
            testElement.className = 'test-result';
            testElement.innerHTML = `
                <h4>${this.formatTestName(testName)}</h4>
                <div class="metrics">
                    <div class="metric">
                        <span>FPS:</span>
                        <span class="${test.fps.rating}">${Math.round(test.fps.avg)} (min: ${Math.round(test.fps.min)}, max: ${Math.round(test.fps.max)})</span>
                    </div>
                    ${test.memory.avg > 0 ? `
                    <div class="metric">
                        <span>Memory:</span>
                        <span class="${test.memory.rating}">${Math.round(test.memory.avg)} MB (min: ${Math.round(test.memory.min)}, max: ${Math.round(test.memory.max)})</span>
                    </div>
                    ` : ''}
                </div>
            `;
            testsElement.appendChild(testElement);
        }
        
        resultsContainer.appendChild(testsElement);
        
        // Add optimization recommendations
        const recommendationsElement = document.createElement('div');
        recommendationsElement.className = 'recommendations';
        recommendationsElement.innerHTML = `
            <h3>Recommendations</h3>
            <ul>
                ${this.getRecommendations(overallScore).map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        `;
        resultsContainer.appendChild(recommendationsElement);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .overall-score {
                text-align: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid rgba(0, 255, 255, 0.3);
            }
            
            .rating {
                display: inline-block;
                padding: 5px 15px;
                border-radius: 20px;
                margin: 10px 0;
                font-weight: bold;
            }
            
            .excellent {
                background: rgba(0, 255, 0, 0.2);
                color: #00ff00;
            }
            
            .good {
                background: rgba(0, 255, 255, 0.2);
                color: #00ffff;
            }
            
            .acceptable {
                background: rgba(255, 255, 0, 0.2);
                color: #ffff00;
            }
            
            .poor {
                background: rgba(255, 0, 0, 0.2);
                color: #ff0000;
            }
            
            .score-breakdown {
                margin-top: 10px;
            }
            
            .score-item {
                display: flex;
                justify-content: space-between;
                margin: 5px 0;
            }
            
            .test-results {
                margin-bottom: 20px;
            }
            
            .test-result {
                margin-bottom: 15px;
                padding-bottom: 15px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .test-result h4 {
                margin: 0 0 10px 0;
                color: #00ffff;
            }
            
            .metrics {
                margin-left: 15px;
            }
            
            .metric {
                display: flex;
                justify-content: space-between;
                margin: 5px 0;
            }
            
            .recommendations {
                margin-top: 20px;
            }
            
            .recommendations h3 {
                color: #00ffff;
                margin-bottom: 10px;
            }
            
            .recommendations ul {
                margin-left: 20px;
            }
            
            .recommendations li {
                margin-bottom: 5px;
            }
        `;
        document.head.appendChild(style);
        
        // Show results panel
        resultsPanel.style.display = 'block';
    }
    
    // Get optimization recommendations
    getRecommendations(overallScore) {
        const recommendations = [];
        
        if (overallScore.overall < 40) {
            recommendations.push('Switch to low quality mode for better performance.');
            recommendations.push('Reduce resolution scaling to improve framerate.');
            recommendations.push('Disable shadows and reflections.');
            recommendations.push('Reduce the number of decorative elements.');
        } else if (overallScore.overall < 60) {
            recommendations.push('Consider using medium quality settings.');
            recommendations.push('Reduce shadow map resolution to improve performance.');
            recommendations.push('Simplify some visual effects during navigation.');
        } else if (overallScore.overall < 80) {
            recommendations.push('Current settings are good, but consider reducing effects during heavy animations.');
            recommendations.push('Monitor performance on mobile devices.');
        } else {
            recommendations.push('Performance is excellent! No changes needed.');
        }
        
        // Add specific recommendations based on test results
        for (const testName in this.testResults) {
            const test = this.testResults[testName];
            
            if (test.fps.rating === 'poor') {
                recommendations.push(`Optimize ${this.formatTestName(testName)} scenario for better framerate.`);
            }
            
            if (test.memory.rating === 'poor') {
                recommendations.push(`Reduce memory usage during ${this.formatTestName(testName)} scenario.`);
            }
        }
        
        return recommendations;
    }
    
    // Apply optimizations based on test results
    applyOptimizations(overallScore) {
        // Get responsive handler
        const responsiveHandler = window.responsiveHandler;
        if (!responsiveHandler) return;
        
        // Apply optimizations based on score
        if (overallScore.overall < 40) {
            // Poor performance, use low quality
            responsiveHandler.currentQuality = 'low';
            responsiveHandler.applyQualitySettings();
        } else if (overallScore.overall < 70) {
            // Acceptable performance, use medium quality
            responsiveHandler.currentQuality = 'medium';
            responsiveHandler.applyQualitySettings();
        } else {
            // Good performance, use high quality if on desktop
            if (responsiveHandler.isDesktop) {
                responsiveHandler.currentQuality = 'high';
                responsiveHandler.applyQualitySettings();
            }
        }
    }
    
    // Show loading indicator
    showLoadingIndicator(message) {
        let loadingIndicator = document.getElementById('performance-loading');
        
        if (!loadingIndicator) {
            loadingIndicator = document.createElement('div');
            loadingIndicator.id = 'performance-loading';
            loadingIndicator.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: #00ffff;
                padding: 20px;
                border-radius: 10px;
                font-family: 'Orbitron', sans-serif;
                z-index: 10000;
                text-align: center;
                border: 1px solid #00ffff;
                box-shadow: 0 0 20px #00ffff;
            `;
            
            // Add spinner
            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            spinner.style.cssText = `
                border: 4px solid rgba(0, 255, 255, 0.3);
                border-top: 4px solid #00ffff;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 15px auto;
            `;
            loadingIndicator.appendChild(spinner);
            
            // Add message
            const messageElement = document.createElement('div');
            messageElement.id = 'loading-message';
            loadingIndicator.appendChild(messageElement);
            
            // Add spinner animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(loadingIndicator);
        }
        
        // Update message
        const messageElement = document.getElementById('loading-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
    }
    
    // Hide loading indicator
    hideLoadingIndicator() {
        const loadingIndicator = document.getElementById('performance-loading');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
    
    // Format test name for display
    formatTestName(testName) {
        switch (testName) {
            case 'idle':
                return 'Idle Scene';
            case 'navigation':
                return 'Car Navigation';
            case 'projectInteraction':
                return 'Project Interaction';
            case 'uiInteraction':
                return 'UI Interaction';
            case 'cameraMovement':
                return 'Camera Movement';
            default:
                return testName.charAt(0).toUpperCase() + testName.slice(1);
        }
    }
}

// Initialize performance tester
const performanceTester = new PerformanceTester();

// Add test button to UI
document.addEventListener('DOMContentLoaded', () => {
    // Create test button
    const testButton = document.createElement('button');
    testButton.id = 'performance-test-button';
    testButton.textContent = 'Test Performance';
    testButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: rgba(0, 0, 0, 0.7);
        color: #00ffff;
        border: 1px solid #00ffff;
        padding: 10px 15px;
        font-family: 'Orbitron', sans-serif;
        cursor: pointer;
        z-index: 1000;
        transition: all 0.3s ease;
    `;
    
    // Add hover effect
    testButton.addEventListener('mouseenter', () => {
        testButton.style.backgroundColor = 'rgba(0, 255, 255, 0.2)';
        testButton.style.boxShadow = '0 0 10px #00ffff';
    });
    
    testButton.addEventListener('mouseleave', () => {
        testButton.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        testButton.style.boxShadow = 'none';
    });
    
    // Add click handler
    testButton.addEventListener('click', () => {
        performanceTester.initialize();
        performanceTester.startTests();
    });
    
    document.body.appendChild(testButton);
});
