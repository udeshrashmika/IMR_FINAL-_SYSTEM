const API_BASE_URL = 'http://localhost:3000'; 

const FIELD_OFFICER_ID = sessionStorage.getItem('userID');
const USER_ROLE = sessionStorage.getItem('userRole');

function checkAuthentication() {
    
    if (!FIELD_OFFICER_ID || USER_ROLE !== 'FieldOfficer') {
        alert('Session expired or unauthorized access. Please log in.');
        window.location.href = 'login.html'; 
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    
    if (!checkAuthentication()) {
        return; 
    }

    
    const routeListPage = document.getElementById('route-list-container');
    const readingFormPage = document.getElementById('reading-form');

    
    const logoutButton = document.querySelector('.logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(e) {
            e.preventDefault();
            sessionStorage.clear(); 
            window.location.href = 'login.html';
        });
    }

    if (routeListPage) {
        
        initRoutesPage(routeListPage);
    } else if (readingFormPage) {
        
        initReadingPage(readingFormPage);
    }
});

async function initRoutesPage(container) {
    container.innerHTML = '<p class="loading-message">Loading assigned routes...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/getRoutes?userId=${FIELD_OFFICER_ID}`);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            container.innerHTML = '';
            
            result.data.forEach(route => {
                const card = document.createElement('div');
                card.className = 'job-card';

                card.innerHTML = `
                    <h3>${route.CustomerName}</h3>
                    <p>${route.ServiceAddress}</p>
                    <p class="meter-id">Meter ID: ${route.MeterID}</p>
                    <a href="enter-reading.html?meterId=${route.MeterID}" class="start-reading-btn">Start Reading</a>
                `;
                container.appendChild(card);
            });

        } else if (result.success && result.data.length === 0) {
            container.innerHTML = '<p class="loading-message">All readings for this month are complete!</p>';
        } else {
            container.innerHTML = `<p class="error-message">Error: ${result.message}</p>`;
        }
    } catch (error) {
        console.error('Failed to fetch routes:', error);
        container.innerHTML = `<p class="error-message">Failed to load data. Is the server running?</p>`;
    }
}

async function initReadingPage(formElement) {
    const params = new URLSearchParams(window.location.search);
    const meterId = params.get('meterId');

    if (!meterId) {
        document.body.innerHTML = '<p class="error-message">Error: No Meter ID provided. Going back to routes...</p>';
        setTimeout(() => {
            window.location.href = 'view-routes.html';
        }, 3000);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/meter-details/${meterId}`);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            document.getElementById('customer-name').textContent = data.CustomerName;
            document.getElementById('customer-address').textContent = data.ServiceAddress;
            document.getElementById('customer-meter-id').textContent = data.MeterID;
            document.getElementById('meter-id-hidden').value = data.MeterID;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Failed to fetch meter details:', error);
        document.querySelector('.customer-info').innerHTML = `<p class="error-message">Error loading customer data.</p>`;
    }

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reading-date').value = today;

    formElement.addEventListener('submit', handleReadingSubmit);
}

async function handleReadingSubmit(event) {
    event.preventDefault();

    if (!FIELD_OFFICER_ID) {
        alert('User session lost. Please log in again.');
        window.location.href = 'login.html';
        return;
    }

    const form = event.target;
    const submitButton = document.querySelector('.submit-button');
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    const formData = {
        'meter-id': form.querySelector('#meter-id-hidden').value,
        'reading-value': form.querySelector('#reading-value').value,
        'reading-date': form.querySelector('#reading-date').value,
        'notes': form.querySelector('#notes').value,
        'user-id': FIELD_OFFICER_ID 
    };

    try {
        const response = await fetch(`${API_BASE_URL}/submitReading`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            submitButton.textContent = 'Submitted!';
            setTimeout(() => {
                window.location.href = 'view-routes.html';
            }, 2000);
        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        console.error('Failed to submit reading:', error);
        alert(`Error: ${error.message}`);
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Reading';
    }
}




