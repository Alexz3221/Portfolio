// Introduction.js - Handles introduction area

class IntroductionSection {
    constructor() {
        this.introPanel = document.getElementById('intro-panel');
        this.initialized = false;
    }
    
    // Initialize introduction section
    initialize() {
        if (this.initialized) return;
        
        this.setupIntroContent();
        this.addInteractiveElements();
        
        this.initialized = true;
    }
    
    // Setup introduction content
    setupIntroContent() {
        // Update the introduction content with more detailed information
        this.introPanel.innerHTML = `
            <div class="close-button">×</div>
            <h2 class="neon-text">INTRODUCTION</h2>
            
            <div class="intro-content">
                <div class="intro-avatar">
                    <div class="avatar-container">
                        <div class="avatar-placeholder">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="avatar-glow"></div>
                    </div>
                </div>
                
                <div class="intro-text">
                    <p>Computer science and mathematics professional with a passion for innovative projects and creative coding. Experienced in developing interactive web experiences and applications that blend functionality with engaging design.</p>
                    
                    <p>My academic achievements and technical expertise drive my approach to problem-solving, allowing me to create solutions that are both technically sound and visually impressive.</p>
                    
                    <h3>Education</h3>
                    <div class="education-item">
                        <div class="degree">Bachelor of Science in Computer Science</div>
                        <div class="institution">University of Technology</div>
                        <div class="year">2018 - 2022</div>
                    </div>
                    
                    <h3>Interests</h3>
                    <div class="interests-container">
                        <span class="interest-tag">Creative Coding</span>
                        <span class="interest-tag">Machine Learning</span>
                        <span class="interest-tag">Web Development</span>
                        <span class="interest-tag">Mobile Apps</span>
                        <span class="interest-tag">Data Visualization</span>
                    </div>
                </div>
            </div>
        `;
        
        // Add Font Awesome if not already included
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const fontAwesome = document.createElement('link');
            fontAwesome.rel = 'stylesheet';
            fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css';
            document.head.appendChild(fontAwesome);
        }
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .intro-content {
                display: grid;
                grid-template-columns: 1fr 2fr;
                gap: 30px;
                margin-top: 20px;
            }
            
            .intro-avatar {
                display: flex;
                justify-content: center;
                align-items: flex-start;
            }
            
            .avatar-container {
                position: relative;
                width: 150px;
                height: 150px;
            }
            
            .avatar-placeholder {
                width: 100%;
                height: 100%;
                background: rgba(0, 255, 255, 0.1);
                border: 2px solid var(--primary-color);
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 60px;
                color: var(--primary-color);
            }
            
            .avatar-glow {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background: transparent;
                box-shadow: 0 0 20px var(--primary-color);
                animation: pulse-glow 2s infinite;
            }
            
            @keyframes pulse-glow {
                0% {
                    box-shadow: 0 0 10px var(--primary-color);
                }
                50% {
                    box-shadow: 0 0 30px var(--primary-color), 0 0 40px var(--primary-color);
                }
                100% {
                    box-shadow: 0 0 10px var(--primary-color);
                }
            }
            
            .intro-text p {
                margin-bottom: 15px;
                line-height: 1.6;
            }
            
            .intro-text h3 {
                color: var(--secondary-color);
                margin: 20px 0 10px;
                font-size: 20px;
            }
            
            .education-item {
                background: rgba(255, 255, 255, 0.05);
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 15px;
                border-left: 3px solid var(--secondary-color);
            }
            
            .degree {
                font-weight: bold;
                font-size: 18px;
                margin-bottom: 5px;
            }
            
            .institution {
                color: var(--primary-color);
                margin-bottom: 5px;
            }
            
            .year {
                font-size: 14px;
                opacity: 0.7;
            }
            
            .interests-container {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 10px;
            }
            
            .interest-tag {
                background: rgba(255, 255, 255, 0.1);
                padding: 5px 15px;
                border-radius: 20px;
                font-size: 14px;
                border: 1px solid var(--primary-color);
                transition: all 0.3s ease;
                cursor: default;
            }
            
            .interest-tag:hover {
                background: var(--primary-color);
                color: var(--dark-bg);
                box-shadow: 0 0 10px var(--primary-color);
                transform: translateY(-3px);
            }
            
            @media (max-width: 768px) {
                .intro-content {
                    grid-template-columns: 1fr;
                }
                
                .intro-avatar {
                    margin-bottom: 20px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Add interactive elements
    addInteractiveElements() {
        // Add hover effects to interest tags
        const interestTags = this.introPanel.querySelectorAll('.interest-tag');
        
        interestTags.forEach(tag => {
            // Random animation delay
            const delay = Math.random() * 2;
            tag.style.animationDelay = `${delay}s`;
            
            // Add floating animation
            tag.style.animation = 'float 3s ease-in-out infinite';
        });
        
        // Add floating animation keyframes
        const style = document.createElement('style');
        style.textContent = `
            @keyframes float {
                0% {
                    transform: translateY(0px);
                }
                50% {
                    transform: translateY(-5px);
                }
                100% {
                    transform: translateY(0px);
                }
            }
        `;
        
        document.head.appendChild(style);
        
        // Add click handler for close button
        const closeButton = this.introPanel.querySelector('.close-button');
        closeButton.addEventListener('click', () => {
            this.hide();
        });
    }
    
    // Show introduction section
    show() {
        this.initialize();
        this.introPanel.classList.add('active');
    }
    
    // Hide introduction section
    hide() {
        this.introPanel.classList.remove('active');
    }
}

// Initialize introduction section
const introductionSection = new IntroductionSection();
