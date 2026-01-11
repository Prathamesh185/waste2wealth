const API_BASE = 'https://waste2wealth-8rio.onrender.com/api';
// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Mobile menu toggle (if needed)
const navLinks = document.querySelector('.nav-links');
const navActions = document.querySelector('.nav-actions');

// Add mobile menu functionality
function initMobileMenu() {
    const existingBtn = document.querySelector('.mobile-menu-btn');

    if (window.innerWidth <= 768) {
        // Create button only for mobile
        if (!existingBtn) {
            const menuBtn = document.createElement('button');
            menuBtn.className = 'mobile-menu-btn';
            menuBtn.innerHTML = '☰';
            menuBtn.style.cssText =
                'background:none;border:none;font-size:24px;cursor:pointer;color:var(--dark-gray);';

            menuBtn.addEventListener('click', () => {
                navLinks.classList.toggle('active');
            });

           navActions.parentElement.prepend(menuBtn);


        }
    } else {
        // Remove button on desktop
        if (existingBtn) {
            existingBtn.remove();
        }
    }
}
document.querySelector('.close-menu-btn').addEventListener('click', () => {
    navLinks.classList.remove('active');
});
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
    });
});



// Initialize on load and resize
initMobileMenu();
window.addEventListener('resize', initMobileMenu);

// Scroll animations (Re-trigger on every scroll)
const observerOptions = {
    threshold: 0.15, // Slightly higher threshold for better effect
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        // Toggle class to re-trigger animation every time it enters/leaves viewport
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
        } else {
            entry.target.classList.remove('animate-in');
        }
    });
}, observerOptions);

// Observe elements
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.feature-card, .step-card, .impact-card');
    animatedElements.forEach(el => observer.observe(el));
});

// Button click handlers
document.querySelectorAll('.btn-primary, .btn-secondary').forEach(button => {
    button.addEventListener('click', function (e) {
        if (!this.getAttribute('href') && !this.getAttribute('onclick')) {
            // Only prevent default if it's a dummy button
            // e.preventDefault(); 
            // console.log('Button clicked:', this.textContent.trim());
        }
    });
});

// Stats counter animation
function animateCounter(element, target, duration = 2000) {
    let current = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = formatNumber(target);
            clearInterval(timer);
        } else {
            element.textContent = formatNumber(Math.floor(current));
        }
    }, 16);
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M+';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'K+';
    }
    return num.toString();
}

// Animate stats when they come into view
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statNumber = entry.target;
            // Only animate if not already done (optional, but stats usually run once)
             if (!statNumber.classList.contains('counted')) {
                const text = statNumber.textContent;
                let target = 0;

                if (text.includes('M')) {
                    target = parseFloat(text) * 1000000;
                } else if (text.includes('K')) {
                    target = parseFloat(text) * 1000;
                } else {
                    target = parseInt(text.replace(/\D/g, ''));
                }

                animateCounter(statNumber, target);
                statNumber.classList.add('counted');
             }
        }
    });
}, { threshold: 0.5 });

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.stat-number').forEach(stat => {
        statsObserver.observe(stat);
    });
});

/*smooth navigation*/
document.addEventListener("DOMContentLoaded", () => {
  const getStartedBtn = document.querySelector(".btn-primary");
  if (getStartedBtn) {
    getStartedBtn.addEventListener("click", () => {
      window.location.href = "/signin";
    });
  }
});


