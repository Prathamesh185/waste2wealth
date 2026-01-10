// API Base URL
const API_BASE = 'http://localhost:5000/api';

console.log('Auth.js loaded successfully');

// Show register form
function showRegister() {
    console.log('Showing register form');
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

// Show login form
function showLogin() {
    console.log('Showing login form');
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
}

// Redirect to appropriate dashboard
function redirectToDashboard(role) {
    console.log('Redirecting to dashboard for role:', role);
    
    let targetPage = '';
    
    switch(role) {
        case 'household':
            targetPage = '/household-dashboard.html';
            break;
        case 'admin':
            targetPage = '/admin-dashboard.html';
            break;
        case 'farmer':
            targetPage = '/farmer-dashboard.html';
            break;
        default:
            alert('Invalid user role: ' + role);
            return;
    }
    
    console.log('Redirecting to:', targetPage);
    
    // Use window.location.href for redirection
    setTimeout(() => {
        window.location.href = targetPage;
    }, 500); // Small delay to ensure alert is seen
}

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    
    // Check if user is already logged in
    const existingToken = localStorage.getItem('token');
    const existingUser = localStorage.getItem('user');
    
    if (existingToken && existingUser) {
        console.log('User already logged in, redirecting...');
        const user = JSON.parse(existingUser);
        redirectToDashboard(user.role);
        return;
    }
    
    // Login functionality
    const loginForm = document.getElementById('login');
    if (loginForm) {
        console.log('Login form found');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Login form submitted');
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            console.log('Attempting login with:', email);
            
            try {
                const response = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                
                console.log('Response status:', response.status);
                
                const data = await response.json();
                console.log('Login response:', data);
                
                if (response.ok) {
                    // Store token and user data
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    console.log('Token stored:', data.token);
                    console.log('User stored:', data.user);
                    
                    alert('Login successful! Redirecting to dashboard...');
                    
                    // Redirect based on role
                    redirectToDashboard(data.user.role);
                } else {
                    alert(data.message || 'Login failed');
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('Login failed. Please check your connection and try again.');
            }
        });
    } else {
        console.error('Login form not found!');
    }

    // Register functionality
    const registerForm = document.getElementById('register');
    if (registerForm) {
        console.log('Register form found');
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Register form submitted');
            
            const formData = {
                name: document.getElementById('regName').value,
                email: document.getElementById('regEmail').value,
                password: document.getElementById('regPassword').value,
                role: document.getElementById('regRole').value,
                address: document.getElementById('regAddress').value,
                phone: document.getElementById('regPhone').value
            };
            
            console.log('Attempting registration with:', formData);
            
            try {
                const response = await fetch(`${API_BASE}/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                console.log('Response status:', response.status);
                
                const data = await response.json();
                console.log('Registration response:', data);
                
                if (response.ok) {
                    alert('Registration successful! Please login.');
                    showLogin();
                    // Clear form
                    registerForm.reset();
                } else {
                    alert(data.message || 'Registration failed');
                }
            } catch (error) {
                console.error('Registration error:', error);
                alert('Registration failed. Please check your connection and try again.');
            }
        });
    } else {
        console.error('Register form not found!');
    }
});

// Logout function (used in all dashboards)
function logout() {
    console.log('Logging out...');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}