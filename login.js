const API_BASE_URL = 'http://localhost:3000'; 

function displayLoginMessage(type, message) {
    const container = document.getElementById('login-error-message');
    if (!container) return; 

    container.textContent = message;
    container.className = `form-message ${type}`;

    setTimeout(() => {
        container.textContent = '';
        container.className = 'form-message';
    }, 4000);
}


document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.querySelector('.login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            
            event.preventDefault(); 
            displayLoginMessage('info', 'Logging in...');

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const role = document.getElementById('role').value;


            if (!username || !password || !role) {
                displayLoginMessage('error', 'Please fill in all fields and select a role.');
                return;
            }

            try {
                const response = await fetch(API_BASE_URL + '/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password, role }),
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    
                    sessionStorage.setItem('userID', result.user.UserID);
                    sessionStorage.setItem('userRole', result.user.Role);
                    sessionStorage.setItem('userName', result.user.FullName); 

                    let destination = '';
                    
                    switch (result.user.Role) {
                        case 'Admin': 
                            destination = 'admin-dashboard.html';
                            break;
                        case 'FieldOfficer': 
                            destination = 'view-routes.html'; 
                            break;
                        case 'Cashier / Billing Clerk':
                            destination = 'cashier-dashboard.html';
                            break;
                        case 'Manager':
                            destination = 'manager-dashboard.html';
                            break;
                        default:
                            destination = 'login.html'; 
                    }
                    
                    window.location.href = destination;

                } else {
                    displayLoginMessage('error', result.message || 'Login failed. Check your network.');
                }

            } catch (error) {
                console.error('Network or Server Error:', error);
                displayLoginMessage('error', 'Could not connect to the server. Is the API running?');
            }
        });
    }
});