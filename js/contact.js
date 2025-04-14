// Contact.js - Handles contact information section

class ContactSection {
    constructor() {
        this.contactPanel = document.getElementById('contact-panel');
        this.initialized = false;
    }
    
    // Initialize contact section
    initialize() {
        if (this.initialized) return;
        
        this.setupContactInfo();
        this.setupContactForm();
        this.addInteractiveElements();
        
        this.initialized = true;
    }
    
    // Setup contact information
    setupContactInfo() {
        const contactItems = this.contactPanel.querySelectorAll('.contact-item');
        
        // Add hover effects to contact items
        contactItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.transform = 'scale(1.05)';
                item.style.boxShadow = '0 0 15px var(--primary-color)';
            });
            
            item.addEventListener('mouseleave', () => {
                item.style.transform = 'scale(1)';
                item.style.boxShadow = 'none';
            });
        });
    }
    
    // Setup contact form
    setupContactForm() {
        // This would be expanded in a real implementation
        // For now, we'll just add some placeholder styling
        
        const contactForm = document.createElement('div');
        contactForm.className = 'contact-message-form';
        contactForm.innerHTML = `
            <h3>Send a Message</h3>
            <div class="form-group">
                <label for="contact-name">Name</label>
                <input type="text" id="contact-name" placeholder="Your Name">
            </div>
            <div class="form-group">
                <label for="contact-email">Email</label>
                <input type="email" id="contact-email" placeholder="Your Email">
            </div>
            <div class="form-group">
                <label for="contact-message">Message</label>
                <textarea id="contact-message" placeholder="Your Message" rows="4"></textarea>
            </div>
            <button class="submit-button">Send Message</button>
        `;
        
        // Add form to panel
        this.contactPanel.appendChild(contactForm);
        
        // Add form styles
        const style = document.createElement('style');
        style.textContent = `
            .contact-message-form {
                margin-top: 30px;
                border-top: 1px solid rgba(0, 255, 255, 0.3);
                padding-top: 20px;
            }
            
            .contact-message-form h3 {
                color: var(--primary-color);
                margin-bottom: 15px;
            }
            
            .form-group {
                margin-bottom: 15px;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 5px;
                color: var(--secondary-color);
            }
            
            .form-group input, .form-group textarea {
                width: 100%;
                padding: 10px;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid var(--primary-color);
                color: white;
                font-family: 'Roboto', sans-serif;
                transition: all 0.3s ease;
            }
            
            .form-group input:focus, .form-group textarea:focus {
                outline: none;
                box-shadow: 0 0 10px var(--primary-color);
            }
            
            .submit-button {
                background: transparent;
                border: 1px solid var(--primary-color);
                color: var(--primary-color);
                padding: 10px 20px;
                font-family: 'Orbitron', sans-serif;
                cursor: pointer;
                transition: all 0.3s ease;
                margin-top: 10px;
            }
            
            .submit-button:hover {
                background: var(--primary-color);
                color: var(--dark-bg);
                box-shadow: 0 0 15px var(--primary-color);
            }
        `;
        
        document.head.appendChild(style);
        
        // Add form submission handler (just for visual feedback)
        const submitButton = contactForm.querySelector('.submit-button');
        submitButton.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Visual feedback
            submitButton.textContent = 'Message Sent!';
            submitButton.style.background = 'var(--primary-color)';
            submitButton.style.color = 'var(--dark-bg)';
            
            // Reset after 2 seconds
            setTimeout(() => {
                submitButton.textContent = 'Send Message';
                submitButton.style.background = 'transparent';
                submitButton.style.color = 'var(--primary-color)';
                
                // Clear form
                contactForm.querySelector('#contact-name').value = '';
                contactForm.querySelector('#contact-email').value = '';
                contactForm.querySelector('#contact-message').value = '';
            }, 2000);
        });
    }
    
    // Add interactive elements
    addInteractiveElements() {
        // Add animated icons for contact methods
        const contactItems = this.contactPanel.querySelectorAll('.contact-item');
        
        // Create animated icons
        const iconClasses = ['fa-envelope', 'fa-linkedin', 'fa-github'];
        
        // Add Font Awesome if not already included
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const fontAwesome = document.createElement('link');
            fontAwesome.rel = 'stylesheet';
            fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css';
            document.head.appendChild(fontAwesome);
        }
        
        // Add icons to contact items
        contactItems.forEach((item, index) => {
            if (index < iconClasses.length) {
                const icon = document.createElement('i');
                icon.className = `fas ${iconClasses[index]} contact-icon`;
                
                // Insert icon before the label
                const label = item.querySelector('label');
                item.insertBefore(icon, label);
                
                // Add animation
                icon.style.cssText = `
                    font-size: 24px;
                    color: var(--primary-color);
                    margin-right: 10px;
                    animation: pulse 2s infinite;
                    animation-delay: ${index * 0.5}s;
                `;
            }
        });
        
        // Add animation keyframes
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% {
                    transform: scale(1);
                    text-shadow: 0 0 5px var(--primary-color);
                }
                50% {
                    transform: scale(1.2);
                    text-shadow: 0 0 20px var(--primary-color), 0 0 30px var(--primary-color);
                }
                100% {
                    transform: scale(1);
                    text-shadow: 0 0 5px var(--primary-color);
                }
            }
            
            .contact-item {
                display: flex;
                align-items: center;
                transition: all 0.3s ease;
                padding: 10px;
                border-radius: 5px;
            }
            
            .contact-icon {
                display: inline-block;
                width: 30px;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Show contact section
    show() {
        this.initialize();
        this.contactPanel.classList.add('active');
    }
    
    // Hide contact section
    hide() {
        this.contactPanel.classList.remove('active');
    }
}

// Initialize contact section
const contactSection = new ContactSection();
