// ======================================================================
// CASHIER APP.JS
// This file controls all logic for the Cashier pages.
// ======================================================================

const API_BASE_URL = 'http://localhost:3000'; // Make sure this matches your Node.js server port

// --- Utility Function to Handle API Communication ---
async function sendData(endpoint, data) {
    try {
        const response = await fetch(API_BASE_URL + endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `API call failed with status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("API Communication Error:", error);
        displayMessage('error', error.message || 'Network error. Is the Node.js server running?');
        return null;
    }
}

// --- Utility Function to Display Status Messages ---
function displayMessage(type, message, formElement = null) {
    let container = formElement ? formElement.querySelector('.form-message') : null;
    if (!container) {
        container = document.querySelector('.form-message'); // Fallback
    }
    
    if (container) {
        container.textContent = message;
        container.className = `form-message ${type}`;
        setTimeout(() => {
            container.textContent = '';
            container.className = 'form-message';
        }, 5000);
    } else {
        console.log(`MESSAGE (${type}): ${message}`);
    }
}


// ----------------------------------------------------------------------
// CASHIER SIDE FUNCTIONS
// ----------------------------------------------------------------------

/**
 * Loads the table of outstanding bills for the cashier dashboard.
 */
async function loadOutstandingBills() {
    const tableBody = document.getElementById('cashier-outstanding-bills-body');
    if (!tableBody) return; 

    try {
        const result = await fetch(API_BASE_URL + '/api/outstanding-bills').then(res => res.json());

        if (result && result.success && result.data) {
            tableBody.innerHTML = ''; 
            if (result.data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="7">No outstanding bills found.</td></tr>';
                return;
            }

            result.data.forEach(bill => {
                const row = tableBody.insertRow();
                row.insertCell().textContent = bill.BillID;
                row.insertCell().textContent = bill.CustomerID;
                row.insertCell().textContent = bill.CustomerName;
                row.insertCell().textContent = new Date(bill.BillDate).toLocaleDateString();
                row.insertCell().textContent = new Date(bill.DueDate).toLocaleDateString();
                row.insertCell().textContent = `Rs. ${bill.AmountDue.toFixed(2)}`;
                
                const actionCell = row.insertCell();
                // This link passes the Bill ID, Amount, and Customer Name in the URL
                actionCell.innerHTML = `
                    <a href="record-payment.html?billId=${bill.BillID}&amount=${bill.AmountDue.toFixed(2)}&customer=${encodeURIComponent(bill.CustomerName)}">
                        <button class="btn-action btn-edit">Record Payment</button>
                    </a>`;
            });
        } else {
            tableBody.innerHTML = `<tr><td colspan="7">${result.message || 'Error loading bills.'}</td></tr>`;
        }
    } catch (error) {
        console.error("Outstanding Bills Load Error:", error);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-error">Failed to load data: ${error.message}.</td></tr>`;
    }
}

/**
 * Loads the dropdown of unbilled meter readings for the generate-bill page.
 */
async function loadUnbilledReadings() {
    const select = document.getElementById('reading-id');
    if (!select) return; 

    try {
        const result = await fetch(API_BASE_URL + '/api/unbilled-readings').then(res => res.json());
        
        if (result && result.success && result.data) {
            select.innerHTML = '<option value="" disabled selected>Select a reading...</option>'; 
            if (result.data.length === 0) {
                select.innerHTML = '<option value="" disabled>No unbilled readings found.</option>';
                return;
            }

            result.data.forEach(reading => {
                const option = document.createElement('option');
                option.value = reading.ReadingID;
                option.textContent = `Reading #${reading.ReadingID} (Meter: ${reading.MeterID}, Customer: ${reading.CustomerID})`;
                select.appendChild(option);
            });
        } else {
            select.innerHTML = `<option value="" disabled>${result.message || 'Error loading readings.'}</option>`;
        }
    } catch (error) {
        console.error("Unbilled Readings Load Error:", error);
        select.innerHTML = `<option value="" disabled>Failed to load data: ${error.message}</option>`;
    }
}

/**
 * Fetches details for a selected reading and fills the form.
 */
async function handleReadingSelection() {
    const select = document.getElementById('reading-id');
    const readingId = select.value;
    const form = document.getElementById('generate-bill-form');
    if (!readingId) return;

    try {
        // This calls the advanced endpoint that does all the work on the server
        const result = await fetch(`${API_BASE_URL}/api/reading-details/${readingId}`).then(res => res.json());
        
        if (result && result.success && result.data) {
            const data = result.data;
            
            // Fill the form fields AUTOMATICALLY
            document.getElementById('customer-name').value = data.CustomerID;
            document.getElementById('meter-id').value = data.MeterID;
            document.getElementById('current-reading').value = data.CurrentReadingValue.toFixed(2);
            document.getElementById('previous-reading').value = data.PreviousReadingValue.toFixed(2);
            document.getElementById('consumption').value = data.Consumption.toFixed(2);
            
            // This amount is now calculated by your REAL SQL function!
            document.getElementById('amount-due').value = data.CalculatedAmountDue.toFixed(2);

            // Set default dates
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('bill-date').value = today;
            
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 14); // Set due date 14 days from now
            document.getElementById('due-date').value = dueDate.toISOString().split('T')[0];

        } else {
            displayMessage('error', result.message || 'Error fetching details.', form);
        }
    } catch (error) {
        console.error("Reading Details Fetch Error:", error);
        displayMessage('error', `Failed to load details: ${error.message}`, form);
    }
}

/**
 * Pre-fills the record-payment.html form based on URL parameters
 */
function prefillPaymentForm() {
    const form = document.getElementById('record-payment-form');
    if (!form) return; // Exit if not on payment page

    // 1. Get the data from the URL (e.g. ?billId=...&amount=...)
    const params = new URLSearchParams(window.location.search);
    const billId = params.get('billId');
    const amount = params.get('amount');
    const customer = params.get('customer');

    // 2. Fill the form fields with the data
    if (billId) {
        form.querySelector('#bill-id').value = billId;
    }
    if (amount) {
        form.querySelector('#amount-due').value = amount;
        form.querySelector('#payment-amount').value = amount; // Pre-fill payment amount
    }
    if (customer) {
        form.querySelector('#customer-name').value = customer;
    }
    
    // 3. Set payment date to today
    const today = new Date().toISOString().split('T')[0];
    form.querySelector('#payment-date').value = today;
}


// --- Main Form Submission Handler ---
async function handleFormSubmission(event) {
    event.preventDefault(); 

    const form = event.target;
    const formId = form.id;
    // Get the raw form data using the input NAME attributes
    const rawFormData = Object.fromEntries(new FormData(form).entries());

    let endpoint = '';
    let successMessage = '';
    let payloadData = rawFormData; // Default payload is the raw data
    
    if (formId === 'record-payment-form') {
        
        // FIX: The old server code requires 'user-id'. We inject it here to bypass validation.
        // We assume HTML names are correct (bill-id, payment-amount, payment-method)
        // If your HTML uses camelCase (billId, paymentAmount), you MUST update your HTML to use dashed names.
        payloadData = {
            ...rawFormData, // Contains bill-id, payment-amount, payment-method
            'user-id': 'U-003' // FORCES inclusion of the hardcoded Cashier ID
        };
        
        endpoint = '/recordPayment';
        successMessage = 'Payment recorded and bill updated!';
    
    } else if (formId === 'generate-bill-form') {
        // Manually add the readonly fields so they are sent to the server
        payloadData['customer-name'] = document.getElementById('customer-name').value;
        payloadData['meter-id'] = document.getElementById('meter-id').value;
        payloadData['previous-reading'] = document.getElementById('previous-reading').value;
        payloadData['current-reading'] = document.getElementById('current-reading').value;
        payloadData['amount-due'] = document.getElementById('amount-due').value;

        endpoint = '/api/generate-bill-from-reading';
        successMessage = 'Bill generated successfully!';
        
    } else {
        console.warn(`No handler for form ID: ${formId}`);
        displayMessage('warning', 'Form action not yet implemented.', form);
        return; 
    }

    sendData(endpoint, payloadData) // Use payloadData instead of formData
        .then(result => {
            if (result && result.success) {
                displayMessage('success', successMessage, form);
                form.reset(); 
                
                if (formId === 'generate-bill-form') {
                    loadUnbilledReadings(); // Reload the dropdown
                }
                
                if (formId === 'record-payment-form') {
                    // Redirect back to dashboard after 2 seconds
                    displayMessage('success', 'Payment Recorded! Redirecting...', form);
                    setTimeout(() => {
                        window.location.href = 'cashier-dashboard.html';
                    }, 2000);
                }
            }
        });
}

// --- Initialize Event Listeners on Load ---
document.addEventListener('DOMContentLoaded', () => {
    
    const allDataForms = document.querySelectorAll('form.data-form');
    allDataForms.forEach(form => {
        form.addEventListener('submit', handleFormSubmission);
    });

    // --- Conditional Data Loading on Page Load ---
    
    // For cashier-dashboard.html
    if (document.getElementById('cashier-outstanding-bills-body')) {
        loadOutstandingBills();
    }
    
    // For generate-bill.html
    const readingSelect = document.getElementById('reading-id');
    if (readingSelect) {
        loadUnbilledReadings();
        readingSelect.addEventListener('change', handleReadingSelection);
    }

    // *** THIS IS THE CODE THAT WAS MISSING AT THE BOTTOM ***
    // It checks if you are on the payment page, then runs prefillPaymentForm
    if (document.getElementById('record-payment-form')) {
        prefillPaymentForm();
    }
});