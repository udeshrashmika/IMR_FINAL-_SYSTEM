const bcrypt = require('bcryptjs');
const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();
const PORT = 3000;

const dbConfig = {
    user: 'sa',
    password: '0763992144u',
    server: 'DESKTOP-VC443FH', 
    database: 'UMS_System', 
    options: {
        trustedConnection: false, 
        enableArithAbort: true,
        trustServerCertificate: true,
        instanceName: 'SQLEXPRESS' 
    }
};

app.use(cors()); 
app.use(express.json()); 

app.use(express.static(__dirname));

let pool;

async function connectDb() {
    try {
        if (!pool) {
            pool = await sql.connect(dbConfig);
            console.log('Database connection established successfully.');
        }
        return pool;
    } catch (err) {
        console.error('Database Connection Failed! Details:', err.message);
        console.error('Check your dbConfig: user, password, server, and instanceName.');
        throw err;
    }
}

connectDb();

// ----------------------------------------------------------------------
// 1. AUTHENTICATION ENDPOINT
// ----------------------------------------------------------------------



app.post('/login', async (req, res) => {
    const { username, password, role } = req.body;

    console.log('--- Received Login Request ---');
    console.log(`Username: [${username}]`);
    console.log(`Password: [${password}]`);
    console.log(`Role: [${role}]`);
    console.log('------------------------------');

    
    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: 'Missing username, password, or role.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();
        
        request.input('username', sql.NVarChar, username); 
        request.input('password', sql.NVarChar, password); 
        request.input('role', sql.NVarChar, role);

        const result = await request.query(
        `SELECT UserID, FullName, Role 
        FROM [dbo].[User_Staff] 
        WHERE UPPER(Username) = UPPER(@username) 
        AND UPPER(PasswordHash) = UPPER(@password)
        
        AND UPPER(Role) = UPPER(@role)`
        );
        
        if (result.recordset.length > 0) {
            res.json({ success: true, user: result.recordset[0] });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials or incorrect role selected.' });
        }

    } catch (err) {
        console.error('Login Error:', err.message);
        res.status(500).json({ success: false, message: 'Server error during login process.' });
    }
});


// ----------------------------------------------------------------------
// 2. DATA RETRIEVAL (GET) ENDPOINTS
// ----------------------------------------------------------------------

// --- GET /getDashboardStats (Admin) ---
app.get('/getDashboardStats', async (req, res) => {
    try {
        const pool = await connectDb();
        
        const customerResult = await pool.request().query('SELECT COUNT(*) AS total FROM [dbo].[Customer]');
        const meterResult = await pool.request().query('SELECT COUNT(*) AS total FROM [dbo].[Meter]');
        const billsResult = await pool.request().query(`SELECT COUNT(*) AS total FROM [dbo].[Bill] WHERE Status = 'Unpaid'`);
        const revenueResult = await pool.request().query(
            `SELECT SUM(PaymentAmount) AS total 
             FROM [dbo].[Payment] 
             WHERE MONTH(PaymentDate) = MONTH(GETDATE()) 
             AND YEAR(PaymentDate) = YEAR(GETDATE())`
        );

        res.json({
            success: true,
            data: {
                totalCustomers: customerResult.recordset[0].total,
                totalMeters: meterResult.recordset[0].total,
                billsPending: billsResult.recordset[0].total,
                monthlyRevenue: revenueResult.recordset[0].total || 0
            }
        });

    } catch (err) {
        console.error('Get Dashboard Stats Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve dashboard stats.' });
    }
});

// --- GET /getCustomers (Admin) ---
app.get('/getCustomers', async (req, res) => {
    try {
        const pool = await connectDb();
        const result = await pool.request().query('SELECT * FROM [dbo].[Customer]');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Customers Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve customer data.' });
    }
});

// --- GET /getCustomerDetails (Admin Edit Page) ---
app.get('/getCustomerDetails', async (req, res) => {
    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();
        request.input('CustomerID', sql.NVarChar, id);
        
        const result = await request.query('SELECT * FROM [dbo].[Customer] WHERE CustomerID = @CustomerID');

        if (result.recordset.length > 0) {
            res.json({ success: true, data: result.recordset[0] });
        } else {
            res.status(404).json({ success: false, message: 'Customer not found.' });
        }
    } catch (err) {
        console.error('Get Customer Details Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve customer details.' });
    }
});


// --- GET /getMeters (Admin) ---
app.get('/getMeters', async (req, res) => {
    try {
        const pool = await connectDb();
        const query = `
            SELECT 
                M.MeterID, M.CustomerID, U.UtilityName, M.Status, C.ServiceAddress, M.Location
            FROM [dbo].[Meter] AS M
            JOIN [dbo].[Customer] AS C ON M.CustomerID = C.CustomerID
            JOIN [dbo].[Utility_Type] AS U ON M.UtilityID = U.UtilityID
        `;
        const result = await pool.request().query(query);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Meters Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve meter data.' });
    }
});

// --- GET /getMeterDetails (Admin Edit Page) ---
app.get('/getMeterDetails', async (req, res) => {
    const { id } = req.query; 
    if (!id) {
        return res.status(400).json({ success: false, message: 'Meter ID is required.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();
        request.input('MeterID', sql.NVarChar, id);
        
        const result = await request.query('SELECT * FROM [dbo].[Meter] WHERE MeterID = @MeterID');

        if (result.recordset.length > 0) {
            res.json({ success: true, data: result.recordset[0] });
        } else {
            res.status(404).json({ success: false, message: 'Meter not found.' });
        }
    } catch (err) {
        console.error('Get Meter Details Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve meter details.' });
    }
});

// --- GET /getTariffs (Admin) ---
app.get('/getTariffs', async (req, res) => {
    try {
        const pool = await connectDb();
        const result = await pool.request().query('SELECT * FROM [dbo].[Tariff]');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Tariffs Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve tariff data.' });
    }
});

// --- GET /getTariffDetails (Admin Edit Page) ---
app.get('/getTariffDetails', async (req, res) => {
    const { id } = req.query; 
    if (!id) {
        return res.status(400).json({ success: false, message: 'Tariff ID is required.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();
        request.input('TariffID', sql.NVarChar, id);
        
        const result = await request.query('SELECT * FROM [dbo].[Tariff] WHERE TariffID = @TariffID');

        if (result.recordset.length > 0) {
            res.json({ success: true, data: result.recordset[0] });
        } else {
            res.status(404).json({ success: false, message: 'Tariff not found.' });
        }
    } catch (err) {
        console.error('Get Tariff Details Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve tariff details.' });
    }
});

// --- GET /getBillingLedger (Admin) ---
app.get('/getBillingLedger', async (req, res) => {
    try {
        const pool = await connectDb();
        const query = `
            SELECT 
                B.BillID, B.CustomerID, B.BillDate, B.AmountDue, B.Status, P.PaymentDate
            FROM [dbo].[Bill] AS B
            LEFT JOIN [dbo].[Payment] AS P ON B.BillID = P.BillID
            ORDER BY B.BillDate DESC
        `;
        const result = await pool.request().query(query);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Billing Ledger Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve billing ledger.' });
    }
});

// --- GET /getDefaultersReport (Manager) ---
app.get('/getDefaultersReport', async (req, res) => {
    try {
        const pool = await connectDb();
        const result = await pool.request().query('SELECT * FROM [dbo].[vw_DefaultersList]');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Defaulters Report Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve defaulters report.' });
    }
});

// --- GET /getRevenueReport (Manager) ---
app.get('/getRevenueReport', async (req, res) => {
    try {
        const pool = await connectDb();
        const result = await pool.request().query('SELECT * FROM [dbo].[vw_MonthlyRevenueReport]');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Revenue Report Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve revenue report.' });
    }
});

// --- GET /getUtilityTypes (Required for Edit Forms) ---
app.get('/getUtilityTypes', async (req, res) => {
    console.log("Fetching utility types for dropdowns...");
    try {
        const pool = await connectDb();
        const result = await pool.request().query('SELECT * FROM [dbo].[Utility_Type]');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Utility Types Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch from [dbo].[Utility_Type]' });
    }
});

// --- GET /getRoutes (Field Officer: My Assigned Route) ---
app.get('/getRoutes', async (req, res) => {
    const fieldOfficerId = req.query.userId; 
    
    if (!fieldOfficerId) {
        return res.status(400).json({ success: false, message: 'Field Officer ID is missing from request.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();
        request.input('fieldOfficerId', sql.NVarChar, fieldOfficerId); 

        const query = `
            SELECT M.MeterID, C.CustomerName, C.ServiceAddress, U.UtilityName
            FROM [dbo].[Meter] AS M
            JOIN [dbo].[Customer] AS C ON M.CustomerID = C.CustomerID
            JOIN [dbo].[Utility_Type] AS U ON M.UtilityID = U.UtilityID
            -- 3. CRITICAL: Filter by the Field Officer's assigned meters
            WHERE M.Status = 'Active' 
            AND M.MeterID NOT IN (
                SELECT R.MeterID
                FROM [dbo].[Meter_Reading] AS R
                WHERE MONTH(R.ReadingDate) = MONTH(GETDATE())
                AND YEAR(R.ReadingDate) = YEAR(GETDATE())
            )
        `; 

        const result = await request.query(query);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Routes Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve routes.' });
    }
});

app.get('/api/meter-details/:id', async (req, res) => {
    const meterId = req.params.id; 

    try {
    const pool = await connectDb();
    const request = pool.request();

    const query = `
    SELECT 
    m.MeterID, 
    c.CustomerName, 
    c.ServiceAddress
    FROM 
    dbo.Meter AS m
    INNER JOIN 
    dbo.Customer AS c ON m.CustomerID = c.CustomerID
    WHERE 
    m.MeterID = @MeterID
    `;

    request.input('MeterID', sql.NVarChar, meterId);
    const result = await request.query(query);

    if (result.recordset.length > 0) {
    res.json({ success: true, data: result.recordset[0] });
    } else {
    res.status(404).json({ success: false, message: 'Meter not found.' });
    }

    } catch (err) {
    console.error('Get Meter Details Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve meter details.' });
}
});


// ----------------------------------------------------------------------
// 3. DATA SUBMISSION (POST) ENDPOINTS
// ----------------------------------------------------------------------

// --- POST /getAdminReport (Admin) ---
app.post('/getAdminReport', async (req, res) => {
    const { 'report-type': reportType, 'start-date': startDate, 'end-date': endDate } = req.body;

    if (!reportType) {
        return res.status(400).json({ success: false, message: 'Report type is required.' });
    }

    let query = '';
    let headers = [];
    let reportName = '';
    const request = (await connectDb()).request();

    try {
        if (reportType === 'new-customers') {
            reportName = 'New Customer Registrations';
            headers = ['Customer ID', 'Name', 'Type', 'Registration Date', 'Email', 'Phone'];
            query = `
                SELECT CustomerID, CustomerName, CustomerType, RegistrationDate, Email, Phone
                FROM [dbo].[Customer]
                WHERE RegistrationDate BETWEEN @startDate AND @endDate
                ORDER BY RegistrationDate DESC
            `;
            request.input('startDate', sql.Date, startDate || '1900-01-01');
            request.input('endDate', sql.Date, endDate || '2099-12-31');
        
        } else if (reportType === 'readings-log') {
            reportName = 'Meter Reading Log';
            headers = ['Reading ID', 'Meter ID', 'Reading Value', 'Reading Date', 'Field Officer ID'];
            query = `
                SELECT R.ReadingID, R.MeterID, R.ReadingValue, R.ReadingDate, R.UserID
                FROM [dbo].[Meter_Reading] AS R
                WHERE R.ReadingDate BETWEEN @startDate AND @endDate
                ORDER BY R.ReadingDate DESC
            `;
            request.input('startDate', sql.Date, startDate || '1900-01-01');
            request.input('endDate', sql.Date, endDate || '2099-12-31');

        } else if (reportType === 'payment-log') {
            reportName = 'Payment Received Log';
            headers = ['Payment ID', 'Bill ID', 'Payment Amount', 'Payment Date', 'Method', 'Cashier ID'];
            query = `
                SELECT P.PaymentID, P.BillID, P.PaymentAmount, P.PaymentDate, P.PaymentMethod, P.UserID
                FROM [dbo].[Payment] AS P
                WHERE P.PaymentDate BETWEEN @startDate AND @endDate
                ORDER BY P.PaymentDate DESC
            `;
            request.input('startDate', sql.DateTime, startDate ? `${startDate} 00:00:00` : '1900-01-01');
            request.input('endDate', sql.DateTime, endDate ? `${endDate} 23:59:59` : '2099-12-31');
            
        } else {
            return res.status(400).json({ success: false, message: 'Invalid report type selected.' });
        }

        const result = await request.query(query);
        res.json({ success: true, reportName, headers, data: result.recordset });

    } catch (err) {
        console.error(`Admin Report Error (${reportType}):`, err.message);
        res.status(500).json({ success: false, message: `Failed to generate report: ${err.message}` });
    }
});


app.post('/addCustomer', async (req, res) => {
    const { 
        'customer-name': customerName, 
        'customer-type': customerType, 
        email, 
        phone, 
        'service-address': serviceAddress, 
        'billing-address': billingAddress 
    } = req.body;

    const customerId = 'CUST-' + Math.floor(Math.random() * 900 + 100);

    try {
        const pool = await connectDb();
        const request = pool.request();

        const query = `
            INSERT INTO [dbo].[Customer] 
                (CustomerID, CustomerName, CustomerType, Email, Phone, ServiceAddress, BillingAddress, RegistrationDate)
            VALUES 
                (@customerId, @customerName, @customerType, @email, @phone, @serviceAddress, @billingAddress, GETDATE())
        `;

        request.input('customerId', sql.NVarChar, customerId);
        request.input('customerName', sql.NVarChar, customerName);
        request.input('customerType', sql.NVarChar, customerType);
        request.input('email', sql.NVarChar, email);
        request.input('phone', sql.NVarChar, phone);
        request.input('serviceAddress', sql.NVarChar, serviceAddress);
        request.input('billingAddress', sql.NVarChar, billingAddress);
        
        await request.query(query);
        res.json({ success: true, message: 'Customer added.', customerId: customerId });
    } catch (err) {
        console.error('Add Customer Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to add customer. Check database logs.' });
    }
});

app.post('/updateCustomer', async (req, res) => {
    const { 
        'customer-id': customerId,
        'customer-name': customerName, 
        'customer-type': customerType, 
        email, 
        phone, 
        'service-address': serviceAddress, 
        'billing-address': billingAddress 
    } = req.body;

    if (!customerId) {
        return res.status(400).json({ success: false, message: 'Customer ID is missing.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();

        const query = `
            UPDATE [dbo].[Customer]
            SET 
                CustomerName = @customerName,
                CustomerType = @customerType,
                Email = @email,
                Phone = @phone,
                ServiceAddress = @serviceAddress,
                BillingAddress = @billingAddress
            WHERE 
                CustomerID = @customerId
        `;

        request.input('customerId', sql.NVarChar, customerId);
        request.input('customerName', sql.NVarChar, customerName);
        request.input('customerType', sql.NVarChar, customerType);
        request.input('email', sql.NVarChar, email);
        request.input('phone', sql.NVarChar, phone);
        request.input('serviceAddress', sql.NVarChar, serviceAddress);
        request.input('billingAddress', sql.NVarChar, billingAddress);
        
        await request.query(query);
        res.json({ success: true, message: 'Customer details updated successfully.' });
    } catch (err) {
        console.error('Update Customer Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update customer.' });
    }
});


app.post('/deleteCustomer', async (req, res) => {
    const { CustomerID } = req.body;
    if (!CustomerID) {
        return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }

    const pool = await connectDb();
    const transaction = pool.transaction();

    try {
        await transaction.begin();
        const request = transaction.request();
        request.input('CustomerID', sql.NVarChar, CustomerID);

        await request.query(`
            DELETE FROM [dbo].[Payment] 
            WHERE BillID IN (SELECT BillID FROM [dbo].[Bill] WHERE CustomerID = @CustomerID)
        `);
        await request.query(`DELETE FROM [dbo].[Bill] WHERE CustomerID = @CustomerID`);
        await request.query(`
            DELETE FROM [dbo].[Meter_Reading] 
            WHERE MeterID IN (SELECT MeterID FROM [dbo].[Meter] WHERE CustomerID = @CustomerID)
        `);
        await request.query(`DELETE FROM [dbo].[Meter] WHERE CustomerID = @CustomerID`);
        const result = await request.query(`DELETE FROM [dbo].[Customer] WHERE CustomerID = @CustomerID`);

        await transaction.commit();

        if (result.rowsAffected[0] > 0) {
            res.json({ success: true, message: 'Customer and all related data deleted successfully.' });
        } else {
            res.status(404).json({ success: false, message: 'Customer not found.' });
        }
    } catch (err) {
        await transaction.rollback();
        console.error('Delete Customer Error:', err.message);
        res.status(500).json({ success: false, message: `Failed to delete customer: ${err.message}` });
    }
});

app.post('/addMeter', async (req, res) => {
    const { 
        'customer-id': customerId, 
        'meter-id': meterId, 
        'utility-type': utilityId, 
        status, 
        location 
    } = req.body;

    if (!customerId || !meterId || !utilityId || !status) {
        return res.status(400).json({ success: false, message: 'Missing required meter details.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();

        const query = `
            INSERT INTO [dbo].[Meter] 
                (MeterID, CustomerID, UtilityID, Status, Location, InstallDate)
            VALUES 
                (@meterId, @customerId, @utilityId, @status, @location, GETDATE())
        `;

        request.input('meterId', sql.NVarChar, meterId);
        request.input('customerId', sql.NVarChar, customerId);
        request.input('utilityId', sql.NVarChar, utilityId); 
        request.input('status', sql.NVarChar, status);
        request.input('location', sql.NVarChar, location);
        
        await request.query(query);
        res.json({ success: true, message: 'New meter registered successfully.' });
    } catch (err) {
        console.error('Add Meter Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to register meter. Check if Meter ID or Customer ID are valid.' });
    }
});

app.post('/deleteMeter', async (req, res) => {
    const { MeterID } = req.body;
    if (!MeterID) {
        return res.status(400).json({ success: false, message: 'Meter ID is required.' });
    }

    const pool = await connectDb();
    const transaction = pool.transaction();

    try {
        await transaction.begin();
        const request = transaction.request();
        request.input('MeterID', sql.NVarChar, MeterID);

        
        await request.query(`
            DELETE FROM [dbo].[Payment]
            WHERE BillID IN (
                SELECT BillID FROM [dbo].[Bill] 
                WHERE ReadingID IN (
                    SELECT ReadingID FROM [dbo].[Meter_Reading] WHERE MeterID = @MeterID
                )
            )
        `);

        
        await request.query(`
            DELETE FROM [dbo].[Bill]
            WHERE ReadingID IN (
                SELECT ReadingID FROM [dbo].[Meter_Reading] WHERE MeterID = @MeterID
            )
        `);
        
        
        await request.query(`DELETE FROM [dbo].[Meter_Reading] WHERE MeterID = @MeterID`);
        
        
        const result = await request.query(`DELETE FROM [dbo].[Meter] WHERE MeterID = @MeterID`);

        await transaction.commit();

        if (result.rowsAffected[0] > 0) {
            res.json({ success: true, message: 'Meter and all its readings, bills, and payments deleted successfully.' });
        } else {
            res.status(404).json({ success: false, message: 'Meter not found.' });
        }
    } catch (err) {
        await transaction.rollback();
        console.error('Delete Meter Error:', err.message);
        res.status(500).json({ success: false, message: `Failed to delete meter: ${err.message}` });
    }
});


app.post('/updateMeter', async (req, res) => {
    const { 
        'meter-id': meterId,
        'customer-id': customerId, 
        'utility-id': utilityId, 
        status,
        location
    } = req.body;

    if (!meterId || !customerId || !utilityId || !status) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();

        const query = `
            UPDATE [dbo].[Meter]
            SET 
                CustomerID = @customerId,
                UtilityID = @utilityId,
                Status = @status,
                Location = @location
            WHERE 
                MeterID = @meterId
        `;

        request.input('meterId', sql.NVarChar, meterId);
        request.input('customerId', sql.NVarChar, customerId);
        request.input('utilityId', sql.NVarChar, utilityId);
        request.input('status', sql.NVarChar, status);
        request.input('location', sql.NVarChar, location);
        
        await request.query(query);
        res.json({ success: true, message: 'Meter details updated successfully.' });
    } catch (err) {
        console.error('Update Meter Error:', err.message);
        res.status(500).json({ success: false, message: `Failed to update meter: ${err.message}` });
    }
});

// --- POST /addTariff (Admin) ---
app.post('/addTariff', async (req, res) => {
    const { 
        'tariff-id': tariffId, 
        'utility-type': utilityId, 
        'tariff-name': tariffName, 
        rate 
    } = req.body;

    if (!tariffId || !utilityId || !tariffName || !rate) {
        return res.status(400).json({ success: false, message: 'Missing required tariff fields (ID, Utility, Name, Rate).' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();

        const query = `
            INSERT INTO [dbo].[Tariff] 
                (TariffID, UtilityID, TariffName, Rate, MinUnits, FixedCharge)
            VALUES 
                (@tariffId, @utilityId, @tariffName, @rate, 0, 0)
        `;

        request.input('tariffId', sql.NVarChar, tariffId);
        request.input('utilityId', sql.NVarChar, utilityId);
        request.input('tariffName', sql.NVarChar, tariffName);
        request.input('rate', sql.Decimal(10, 2), rate);
        
        await request.query(query);
        res.json({ success: true, message: 'New tariff plan registered successfully.' });
    } catch (err) {
        console.error('Add Tariff Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to register tariff. Check if Tariff ID already exists.' });
    }
});

// --- POST /deleteTariff (Admin) ---
app.post('/deleteTariff', async (req, res) => {
    const { TariffID } = req.body;
    if (!TariffID) {
        return res.status(400).json({ success: false, message: 'Tariff ID is required.' });
    }

    const pool = await connectDb();
    const transaction = pool.transaction();

    try {
        await transaction.begin();
        const request = transaction.request();
        request.input('TariffID', sql.NVarChar, TariffID);

        const checkResult = await request.query(`SELECT COUNT(*) as count FROM [dbo].[Bill] WHERE TariffID = @TariffID`);
        
        if (checkResult.recordset[0].count > 0) {
            await transaction.rollback(); 
            return res.status(400).json({ 
                success: false, 
                message: `Cannot delete Tariff ID ${TariffID}: It is already linked to ${checkResult.recordset[0].count} existing bill(s).` 
            });
        }

        const deleteResult = await request.query(`DELETE FROM [dbo].[Tariff] WHERE TariffID = @TariffID`);

        await transaction.commit();
        
        if (deleteResult.rowsAffected[0] > 0) {
            res.json({ success: true, message: 'Tariff plan deleted successfully.' });
        } else {
            res.status(404).json({ success: false, message: 'Tariff plan not found.' });
        }
    } catch (err) {
        await transaction.rollback();
        console.error('Delete Tariff Error:', err.message);
        res.status(500).json({ success: false, message: `Failed to delete tariff: ${err.message}` });
    }
});

// --- POST /updateTariff (Admin Edit Page) ---
app.post('/updateTariff', async (req, res) => {
    const { 
        'tariff-id': tariffId,
        'tariff-name': tariffName, 
        'utility-id': utilityId, 
        rate
    } = req.body;

    if (!tariffId || !tariffName || !utilityId || !rate) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();

        const query = `
            UPDATE [dbo].[Tariff]
            SET 
                TariffName = @tariffName,
                UtilityID = @utilityId,
                Rate = @rate
            WHERE 
                TariffID = @tariffId
        `;

        request.input('tariffId', sql.NVarChar, tariffId);
        request.input('tariffName', sql.NVarChar, tariffName);
        request.input('utilityId', sql.NVarChar, utilityId);
        request.input('rate', sql.Decimal(10, 2), rate);
        
        await request.query(query);
        res.json({ success: true, message: 'Tariff plan updated successfully.' });
    } catch (err) {
        console.error('Update Tariff Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update tariff plan.' });
    }
});

app.post('/submitReading', async (req, res) => {
    const { 
        'meter-id': meterId, 
        'reading-value': readingValue, 
        'reading-date': readingDate,
        'notes': notes,
        'user-id': fieldOfficerId  
    } = req.body;

    if (!meterId || !readingValue || !readingDate || !fieldOfficerId) { 
        return res.status(400).json({ success: false, message: 'Missing Meter ID, Reading Value, Date, or User ID.' });
    }

    try {
    const pool = await connectDb();
    const request = pool.request();

        
    const query = `
    INSERT INTO [dbo].[Meter_Reading] 
    (MeterID, UserID, ReadingValue, ReadingDate, Notes)
    VALUES 
        (@meterId, @userId, @readingValue, @readingDate, @notes)
`;
    
    request.input('meterId', sql.NVarChar, meterId);
    request.input('userId', sql.NVarChar, fieldOfficerId); 
    request.input('readingValue', sql.Decimal(10, 2), readingValue);
    request.input('readingDate', sql.Date, readingDate);
    request.input('notes', sql.NVarChar, notes || null); 

    await request.query(query);
    res.json({ success: true, message: 'Reading submitted successfully.' });
    } catch (err) {
    console.error('Submit Reading Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to submit reading. Check if Meter ID is correct.' });
    }
});

app.post('/generateBill', async (req, res) => {
    const { 
        'customer-id': customerId, 
        'billing-month': billingMonth 
    } = req.body;

    if (!customerId || !billingMonth) {
        return res.status(400).json({ success: false, message: 'Missing Customer ID or Billing Month.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();
        
  
        const result = await request
            .input('CustomerID', sql.NVarChar, customerId)
            .input('BillingMonth', sql.Date, `${billingMonth}-01`) 
            .execute('[dbo].[sp_GenerateBill]'); 

        res.json({ success: true, message: 'Bill generated successfully!', data: result.recordset });

    } catch (err) {
        console.error('Generate Bill Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});
//////omira//////
//Added by me

//First edit omira

// -------------------------
// 7. GET DEFAULTERS (FINAL)
// (For the Manager's Report)
// -------------------------
app.get('/api/defaulters', async (req, res) => {
    
    // This query is now updated to match your database schema
    const query = `
        SELECT 
            C.CustomerID,
            C.CustomerName,
            C.Phone,
            C.CustomerType,
            COUNT(B.BillID) AS UnpaidBills,
            SUM(B.AmountDue) AS TotalDue
        FROM 
            [dbo].[Customer] AS C
        JOIN 
            [dbo].[Bill] AS B ON C.CustomerID = B.CustomerID
        WHERE 
            B.Status = 'Unpaid' OR B.Status = 'Overdue' -- Matches your Bill table
        GROUP BY 
            C.CustomerID, C.CustomerName, C.Phone, C.CustomerType
        HAVING
            COUNT(B.BillID) > 0  -- Only show customers with at least one unpaid bill
        ORDER BY 
            TotalDue DESC;
    `;

    try {
        const pool = await connectDb();
        const result = await pool.request().query(query);
        
        // Send the data back in the correct format
        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error('Get Defaulters Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve defaulters.' });
    }
});


//--------omira 1st edit ------//


//-2nd Edit omira  

// 8. GET CONSUMPTION DATA (FOR USAGE PATTERNS)
//    *** THIS IS THE NEW ENDPOINT ***
// ----------------------------------------------------
app.get('/api/consumption-data', async (req, res) => {
    
    // This query sums the 'Consumption' column from the 'Bill' table
    // for all bills issued in the last 30 days.
    
    const query = `
        WITH ConsumptionData AS (
            SELECT 
                C.CustomerID,
                C.CustomerName,
                U.UtilityName,
                U.Unit,
                SUM(B.Consumption) AS TotalConsumption
            FROM 
                [dbo].[Bill] AS B
            JOIN 
                [dbo].[Customer] AS C ON B.CustomerID = C.CustomerID
            JOIN 
                [dbo].[Meter] AS M ON B.MeterID = M.MeterID
            JOIN 
                [dbo].[Utility_Type] AS U ON M.UtilityID = U.UtilityID
            WHERE
                -- Finds all bills issued in the last 30 days
                B.BillDate BETWEEN DATEADD(day, -30, GETDATE()) AND GETDATE()
            GROUP BY
                C.CustomerID, C.CustomerName, U.UtilityName, U.Unit
        )
        SELECT 
            RANK() OVER (ORDER BY TotalConsumption DESC) AS Rank,
            CustomerID,
            CustomerName,
            UtilityName AS Utility,
            -- Formats the number (e.g., 5000 -> '5,000') and adds the unit
            FORMAT(TotalConsumption, 'N0') + ' ' + Unit AS Consumption
        FROM 
            ConsumptionData
        WHERE
            TotalConsumption > 0 -- Only show customers who consumed something
        ORDER BY 
            Rank;
    `;

    try {
        const pool = await connectDb();
        const result = await pool.request().query(query);
        
        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error('Get Consumption Data Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve consumption data.' });
    }
});

//--------omira


// omira 3rd edit

//revenue trends

// Add this new endpoint to your server.js file

// -------------------------
// 9. GET REVENUE TRENDS (FOR REVENUE TRENDS PAGE)
// -------------------------
app.get('/api/revenue-trends', async (req, res) => {
    
    // This query calculates revenue from the Payment table,
    // groups it by month, and PIVOTs it by utility type.
    const query = `
        WITH MonthlyData AS (
            SELECT 
                U.UtilityName,
                SUM(P.PaymentAmount) AS Revenue,
                -- Get a key to sort the months correctly
                EOMONTH(P.PaymentDate) AS MonthSortKey,
                -- Get the display name (e.g., 'November 2025')
                FORMAT(P.PaymentDate, 'MMMM yyyy') AS PaymentMonth
            FROM 
                [dbo].[Payment] AS P
            JOIN 
                [dbo].[Bill] AS B ON P.BillID = B.BillID
            JOIN 
                [dbo].[Meter] AS M ON B.MeterID = M.MeterID
            JOIN 
                [dbo].[Utility_Type] AS U ON M.UtilityID = U.UtilityID
            WHERE 
                -- Get payments from the start of the month, 6 months ago
                P.PaymentDate >= DATEADD(month, -6, DATEADD(day, 1, EOMONTH(GETDATE(), -1)))
            GROUP BY 
                U.UtilityName, FORMAT(P.PaymentDate, 'MMMM yyyy'), EOMONTH(P.PaymentDate)
        )
        -- Final query to pivot the data and send raw numbers
        SELECT 
            PaymentMonth AS Month,
            ISNULL([Electricity], 0) AS Electricity,
            ISNULL([Water], 0) AS Water,
            ISNULL([Gas], 0) AS Gas,
            (ISNULL([Electricity], 0) + ISNULL([Water], 0) + ISNULL([Gas], 0)) AS TotalRevenue
        FROM 
            MonthlyData
        PIVOT (
            SUM(Revenue)
            FOR UtilityName IN ([Electricity], [Water], [Gas])
        ) AS PivotTable
        -- Order by the date key, not the month name (so 'June' comes after 'May')
        ORDER BY 
            MonthSortKey;
    `;

    try {
        const pool = await connectDb();
        const result = await pool.request().query(query);
        
        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error('Get Revenue Trends Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve revenue data.' });
    }
});


//end code for omira


//omira 4th edit

// ====================================================
// START: CORRECTED DYNAMIC REPORTS ENDPOINT
// ====================================================

// ----------------------------------------------------
// 10. DYNAMIC REPORTS ENDPOINT (FOR MANAGER DASHBOARD)
// ----------------------------------------------------
app.get('/api/reports', async (req, res) => {
    const { type, start, end } = req.query;

    if (!type || !start || !end) {
        return res.status(400).json({ success: false, message: 'Missing report type, start date, or end date.' });
    }

    let query = '';
    let responseData = { success: true, data: [], total: 0 };

    try {
        const pool = await connectDb();
        const request = pool.request();
        
        // Use NVarChar for dates, it's safer for SQL Server
        request.input('startDate', sql.NVarChar, start);
        request.input('endDate', sql.NVarChar, end);

        if (type === 'revenue') {
            // --- Query for Revenue Collections ---
            query = `
                SELECT 
                    FORMAT(P.PaymentDate, 'yyyy-MM-dd') AS Date,
                    U.UtilityName AS Utility,
                    COUNT(P.PaymentID) AS PaymentsReceived,
                    SUM(P.PaymentAmount) AS Total
                FROM 
                    [dbo].[Payment] AS P
                JOIN 
                    [dbo].[Bill] AS B ON P.BillID = B.BillID
                JOIN 
                    [dbo].[Meter] AS M ON B.MeterID = M.MeterID
                JOIN 
                    [dbo].[Utility_Type] AS U ON M.UtilityID = U.UtilityID
                WHERE 
                    P.PaymentDate BETWEEN @startDate AND @endDate
                GROUP BY 
                    FORMAT(P.PaymentDate, 'yyyy-MM-dd'), U.UtilityName
                ORDER BY 
                    Date, Utility;
            `;
            
            const dataResult = await request.query(query);
            responseData.data = dataResult.recordset;

            // --- Query for the Grand Total ---
            const totalQuery = `
                SELECT SUM(PaymentAmount) AS GrandTotal 
                FROM [dbo].[Payment] 
                WHERE PaymentDate BETWEEN @startDate AND @endDate;
            `;
            
            // Create a new request object for the total query
            const totalResult = await pool.request()
                                      .input('startDate', sql.NVarChar, start)
                                      .input('endDate', sql.NVarChar, end)
                                      .query(totalQuery);
                                      
            if (totalResult.recordset.length > 0) {
                responseData.total = totalResult.recordset[0].GrandTotal;
            }

        } else if (type === 'defaulters') {
            // --- Query for Defaulters ---
            query = `
                SELECT 
                    C.CustomerID,
                    C.CustomerName,
                    C.Phone,
                    C.CustomerType,
                    COUNT(B.BillID) AS UnpaidBills,
                    SUM(B.AmountDue) AS TotalDue
                FROM 
                    [dbo].[Customer] AS C
                JOIN 
                    [dbo].[Bill] AS B ON C.CustomerID = B.CustomerID
                WHERE 
                    (B.Status = 'Unpaid' OR B.Status = 'Overdue')
                    AND B.BillDate BETWEEN @startDate AND @endDate
                GROUP BY 
                    C.CustomerID, C.CustomerName, C.Phone, C.CustomerType
                HAVING
                    COUNT(B.BillID) > 0
                ORDER BY 
                    TotalDue DESC;
            `;
            const dataResult = await request.query(query);
            responseData.data = dataResult.recordset;
            
            // Calculate total due from the results
            responseData.total = dataResult.recordset.reduce((acc, row) => acc + row.TotalDue, 0);

        } else if (type === 'usage') {
            // --- Query for Top Consumers / Usage Patterns ---
            query = `
                WITH ConsumptionData AS (
                    SELECT 
                        C.CustomerID,
                        C.CustomerName,
                        U.UtilityName,
                        U.Unit,
                        SUM(B.Consumption) AS TotalConsumption
                    FROM 
                        [dbo].[Bill] AS B
                    JOIN 
                        [dbo].[Customer] AS C ON B.CustomerID = C.CustomerID
                    JOIN 
                        [dbo].[Meter] AS M ON B.MeterID = M.MeterID
                    JOIN 
                        [dbo].[Utility_Type] AS U ON M.UtilityID = U.UtilityID
                    WHERE
                        B.BillDate BETWEEN @startDate AND @endDate
                    GROUP BY
                        C.CustomerID, C.CustomerName, U.UtilityName, U.Unit
                )
                SELECT 
                    RANK() OVER (ORDER BY TotalConsumption DESC) AS Rank,
                    CustomerID,
                    CustomerName,
                    UtilityName AS Utility,
                    FORMAT(TotalConsumption, 'N0') + ' ' + Unit AS Consumption
                FROM 
                    ConsumptionData
                WHERE
                    TotalConsumption > 0
                ORDER BY 
                    Rank;
            `;
            const dataResult = await request.query(query);
            responseData.data = dataResult.recordset;
            // No total for this report type
        }

        res.json(responseData);

    } catch (err) {
        console.error(`Get Reports Error (Type: ${type}):`, err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve report data.' });
    }
});

//////omira end/////////
//////yasiru start////
// 3. CASHIER API ENDPOINTS (YOUR PART)
// ======================================================================

// --- GET /api/outstanding-bills (Cashier) ---
app.get('/api/outstanding-bills', async (req, res) => {
    try {
        const pool = await connectDb();
        const query = `
            SELECT 
                B.BillID, B.CustomerID, C.CustomerName, B.BillDate, B.DueDate, B.AmountDue
            FROM [dbo].[Bill] AS B
            JOIN [dbo].[Customer] AS C ON B.CustomerID = C.CustomerID
            WHERE 
                B.Status IN ('Unpaid', 'Overdue')
        `;
        const result = await pool.request().query(query);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Outstanding Bills Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve outstanding bills.' });
    }
});

// --- GET /api/unbilled-readings (Cashier) ---
app.get('/api/unbilled-readings', async (req, res) => {
    try {
        const pool = await connectDb();
        const query = `
            SELECT 
                R.ReadingID, 
                R.MeterID, 
                M.CustomerID
            FROM [dbo].[Meter_Reading] AS R
            JOIN [dbo].[Meter] AS M ON R.MeterID = M.MeterID
            WHERE 
                R.ReadingID NOT IN (SELECT ReadingID FROM [dbo].[Bill])
        `;
        const result = await pool.request().query(query);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Unbilled Readings Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve unbilled readings.' });
    }
});

// --- GET /api/reading-details/:id (Cashier) ---
// This endpoint calls your SQL Function
app.get('/api/reading-details/:id', async (req, res) => {
    try {
        const readingId = req.params.id;
        const pool = await connectDb();

        // This advanced query finds the previous reading and calls your SQL function
        const query = `
            DECLARE @ReadingID INT = @id;

            -- 1. CTE finds current/previous readings and Utility ID
            ;WITH ReadingWithPrevious AS (
                SELECT
                    ReadingID,
                    MeterID,
                    ReadingValue AS CurrentReadingValue,
                    ReadingDate,
                    LAG(ReadingValue, 1, 0) OVER (PARTITION BY MeterID ORDER BY ReadingDate, ReadingID) AS PreviousReadingValue,
                    (SELECT M.UtilityID FROM [dbo].[Meter] M WHERE M.MeterID = R.MeterID) AS UtilityID
                FROM 
                    [dbo].[Meter_Reading] R
            ),
            -- 2. CTE calculates Consumption
            ConsumptionCalculated AS (
                SELECT 
                    RWP.*,
                    (RWP.CurrentReadingValue - RWP.PreviousReadingValue) AS Consumption
                FROM ReadingWithPrevious RWP
            )
            -- 3. Final selection and Bill Calculation
            SELECT
                CC.MeterID,
                CC.CurrentReadingValue,
                CC.PreviousReadingValue,
                CC.Consumption,
                
                -- Call your SQL function to get the real amount (Consumption is DECIMAL)
                CASE 
                    WHEN CC.UtilityID = 'UTIL-01' THEN 
                        -- Pass the DECIMAL consumption directly to the function
                        dbo.fn_CalculateElectricityBill(CC.Consumption) 
                    ELSE 
                        -- Use a simple (Rate * Consumption) for other utilities (like Water)
                        CC.Consumption * (SELECT TOP 1 T.Rate FROM [dbo].[Tariff] T WHERE T.UtilityID = CC.UtilityID ORDER BY T.MinUnits)
                END AS CalculatedAmountDue,
                
                (SELECT M.CustomerID FROM [dbo].[Meter] M WHERE M.MeterID = CC.MeterID) AS CustomerID
            FROM 
                ConsumptionCalculated CC
            WHERE 
                CC.ReadingID = @ReadingID;
        `;
        
        const request = pool.request();
        request.input('id', sql.Int, readingId);
        const result = await request.query(query);

        if (result.recordset.length > 0) {
            res.json({ success: true, data: result.recordset[0] });
        } else {
            res.status(404).json({ success: false, message: 'Reading details not found.' });
        }

    } catch (err) {
        console.error('Get Reading Details Error:', err.message);
        res.status(500).json({ success: false, message: 'Server error fetching reading details. Check SQL function definition and data types.' });
    }
});


// --- POST /api/generate-bill-from-reading (Cashier) ---
app.post('/api/generate-bill-from-reading', async (req, res) => {
    const {
        'reading-id': readingId,
        'customer-name': customerId, // This field holds the CustomerID
        'meter-id': meterId,
        'bill-date': billDate,
        'due-date': dueDate,
        'previous-reading': previousReading,
        'current-reading': currentReading,
        'amount-due': amountDue
    } = req.body;

    const billId = 'BILL-' + Date.now(); // Unique Bill ID

    try {
        const pool = await connectDb();
        const request = pool.request();

        const query = `
            INSERT INTO [dbo].[Bill] 
                (BillID, CustomerID, MeterID, ReadingID, BillDate, DueDate, 
                 PreviousReadingValue, CurrentReadingValue, AmountDue, Status)
            VALUES 
                (@billId, @customerId, @meterId, @readingId, @billDate, @dueDate,
                 @previousReading, @currentReading, @amountDue, 'Unpaid')
        `;

        request.input('billId', sql.NVarChar, billId);
        request.input('customerId', sql.NVarChar, customerId);
        request.input('meterId', sql.NVarChar, meterId);
        request.input('readingId', sql.Int, readingId);
        request.input('billDate', sql.Date, billDate);
        request.input('dueDate', sql.Date, dueDate);
        request.input('previousReading', sql.Decimal(10, 2), previousReading);
        request.input('currentReading', sql.Decimal(10, 2), currentReading);
        request.input('amountDue', sql.Decimal(10, 2), amountDue);
        
        await request.query(query);
        res.json({ success: true, message: 'Bill generated successfully!' });
    } catch (err) {
        console.error('Generate Bill Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to generate bill. Is this reading already billed?' });
    }
});


// --- POST /recordPayment (Cashier) ---
// This uses your Stored Procedure
app.post('/recordPayment', async (req, res) => {
    const { 
        'bill-id': billId, 
        'payment-amount': paymentAmount, 
        'payment-method': paymentMethod 
    } = req.body;

    // 1. INPUT VALIDATION: Check for required fields before proceeding
    if (!billId || !paymentAmount || !paymentMethod) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing BILL ID, payment amount, or payment method in request body.'
        });
    }

    // Cashier ID is hardcoded here, which is fine for this example.
    const cashierId = 'U-003'; 

    try {
        const pool = await connectDb();
        const request = pool.request();

        // 2. EXECUTE STORED PROCEDURE
        await request
            .input('BillID', sql.NVarChar, billId)
            .input('UserID', sql.NVarChar, cashierId)
            .input('PaymentAmount', sql.Decimal(10, 2), paymentAmount)
            .input('PaymentMethod', sql.NVarChar, paymentMethod)
            .execute('[dbo].[sp_RecordPayment]'); 

        res.json({ success: true, message: 'Payment successfully recorded and bill updated.' });
    } catch (err) {
        // If the error is not due to missing parameters, it's a server/database issue (like Bill not found)
        console.error('Record Payment Error:', err.message);
        res.status(500).json({ success: false, message: 'Payment failed: Bill not found or database error.' });
    }
});
/////yasiru end////

// ----------------------------------------------------------------------
// 4. SERVER LISTENER
// ----------------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});