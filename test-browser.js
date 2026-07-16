const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname)));

const server = app.listen(0, async () => {
    const port = server.address().port;
    console.log(`Test server on port ${port}`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    page.on('console', msg => {
        console.log(`BROWSER [${msg.type()}]: ${msg.text()}`);
    });
    page.on('pageerror', err => {
        console.log('PAGE ERROR:', err.message);
        console.log('STACK:', err.stack);
    });

    await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'networkidle0', timeout: 30000 });

    await page.click('#linkToSignup');
    await new Promise(r => setTimeout(r, 300));

    const ts = Date.now().toString().slice(-13).padStart(13,'2');
    await page.type('#signupName', 'Test Student');
    await page.type('#signupRoll', ts);
    await page.type('#signupPass', 'TestPass123');
    await page.type('#signupPassConfirm', 'TestPass123');

    console.log('--- Clicking Sign Up ---');
    await page.click('#btnSignup');
    await new Promise(r => setTimeout(r, 10000));

    const dashVisible = await page.$eval('#appDashboard', el => el.style.display !== 'none').catch(() => false);
    const errText     = await page.$eval('#authError', el => el.textContent.trim()).catch(() => '');

    console.log('Dashboard visible:', dashVisible);
    console.log('Auth error:', errText || '(none)');

    await browser.close();
    server.close();
    process.exit(0);
});
