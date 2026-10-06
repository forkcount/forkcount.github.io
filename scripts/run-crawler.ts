import { chromium, type Page, type Response } from 'playwright';

interface ErrorEntry {
  route: string;
  buttonText: string;
  errorMessage: string;
}

async function runTest() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  const errors: ErrorEntry[] = [];
  let currentRoute = '/';
  let currentButton = 'Initial Load';

  // 5. Capture every console error and failed network request (4xx, 5xx)
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore normal websocket or HMR disconnection in test runner if any
      if (text.includes('WebSocket') || text.includes('vite:hmr')) return;
      errors.push({
        route: currentRoute,
        buttonText: currentButton,
        errorMessage: `Console Error: ${text}`
      });
    }
  });

  page.on('pageerror', (err) => {
    errors.push({
      route: currentRoute,
      buttonText: currentButton,
      errorMessage: `Uncaught Exception: ${err.message}`
    });
  });

  page.on('response', (resp: Response) => {
    const status = resp.status();
    const url = resp.url();
    if (status >= 400) {
      // Ignore 404 for optional favicons or service-worker checks if expected
      errors.push({
        route: currentRoute,
        buttonText: currentButton,
        errorMessage: `Network Error [${status} ${resp.statusText()}]: ${url}`
      });
    }
  });

  try {
    console.log('1. Opening app at http://localhost:3000...');
    currentRoute = '/';
    currentButton = 'Page Load';
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log('2. Signing in as a test user...');
    currentButton = 'Sign In Flow';
    
    // Check if we are already logged in or if we need to sign in
    // Let's check for guest/login buttons
    const signinButton = page.locator('button:has-text("Sign in"), button:has-text("Log In"), button:has-text("Sign In"), button:has-text("Member Sign In")').first();
    const isSignInVisible = await signinButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (isSignInVisible) {
      await signinButton.click().catch(() => {});
      await page.waitForTimeout(500);
    }

    // Check if login inputs exist (e.g. username/email and password)
    const usernameInput = page.locator('input[placeholder*="username" i], input[placeholder*="email" i], input[type="text"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    if (await usernameInput.isVisible({ timeout: 2000 }).catch(() => false) && await passwordInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Check if we need to switch mode to "Sign in"
      const signInTab = page.locator('button:has-text("Sign in"), button:has-text("Sign In")').first();
      if (await signInTab.isVisible().catch(() => false)) {
        await signInTab.click().catch(() => {});
        await page.waitForTimeout(300);
      }

      await usernameInput.fill('housefly');
      await passwordInput.fill('changeme123');
      
      const submitBtn = page.locator('form button[type="submit"], button:has-text("Sign in"), button:has-text("Sign In")').first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click().catch(() => {});
        await page.waitForTimeout(2000);
      }
    } else {
      // If landing page is showing "Launch App" or "Start Tracking" or "Open App"
      const startBtn = page.locator('button:has-text("Start Tracking"), button:has-text("Open App"), button:has-text("Launch App"), button:has-text("Get Started")').first();
      if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await startBtn.click().catch(() => {});
        await page.waitForTimeout(2000);
      }
    }

    // 3. Routes to visit: /dashboard, /fitness, /community, /reports, /me, /plan
    const routesToVisit = [
      { name: '/dashboard', navSelector: 'button[aria-label*="Diary" i], button:has-text("Diary"), button:has-text("Dashboard"), a[href*="dashboard"]' },
      { name: '/fitness', navSelector: 'button[aria-label*="Fitness" i], button:has-text("Fitness"), a[href*="fitness"]' },
      { name: '/community', navSelector: 'button[aria-label*="Community" i], button:has-text("Community"), a[href*="community"]' },
      { name: '/reports', navSelector: 'button[aria-label*="Reports" i], button:has-text("Reports"), a[href*="reports"]' },
      { name: '/me', navSelector: 'button[aria-label*="Me" i], button:has-text("Me"), button:has-text("Profile"), a[href*="me"]' },
      { name: '/plan', navSelector: 'button[aria-label*="Plan" i], button:has-text("Plan"), a[href*="plan"]' }
    ];

    const destructiveKeywords = [
      'delete', 'delete account', 'remove account', 'sign out', 'signout', 'logout', 'log out',
      'delete post', 'delete entry', 'delete meal', 'erase', 'reset all', 'purge', 'wipe'
    ];

    for (const route of routesToVisit) {
      currentRoute = route.name;
      currentButton = `Navigate to ${route.name}`;
      console.log(`\n3. Visiting route: ${route.name}`);

      // Try direct navigation via URL first, then via navigation buttons
      await page.goto(`http://localhost:3000${route.name}`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(async () => {
        // Fallback: click tab navigation
        const navEl = page.locator(route.navSelector).first();
        if (await navEl.isVisible().catch(() => false)) {
          await navEl.click().catch(() => {});
        }
      });
      await page.waitForTimeout(1500);

      // Ensure active tab matches if navigation bar is present
      const navBtn = page.locator(route.navSelector).first();
      if (await navBtn.isVisible().catch(() => false)) {
        await navBtn.click().catch(() => {});
        await page.waitForTimeout(1000);
      }

      // 4. On each route, find and click every non-destructive button and link
      console.log(`4. Scanning and clicking interactive elements on ${route.name}...`);
      
      // Query all clickable buttons and links inside main content and sheets
      const clickables = await page.$$('button:not([disabled]), a:not([disabled])');
      console.log(`Found ${clickables.length} clickable elements on ${route.name}`);

      for (let i = 0; i < clickables.length; i++) {
        try {
          const el = clickables[i];
          const isVisible = await el.isVisible().catch(() => false);
          if (!isVisible) continue;

          const rawText = (await el.innerText().catch(() => '')) || (await el.getAttribute('aria-label').catch(() => '')) || (await el.getAttribute('title').catch(() => '')) || '';
          const cleanText = rawText.trim().replace(/\s+/g, ' ');
          const lowerText = cleanText.toLowerCase();

          // Skip if destructive
          const isDestructive = destructiveKeywords.some((kw) => lowerText.includes(kw));
          if (isDestructive) {
            console.log(`   [SKIP DESTRUCTIVE] ${cleanText || '<button>'}`);
            continue;
          }

          // Skip navigation tabs themselves while iterating inside a route to avoid switching away immediately
          if (lowerText === 'diary' || lowerText === 'fitness' || lowerText === 'community' || lowerText === 'reports' || lowerText === 'me' || lowerText === 'plan') {
            continue;
          }

          // Skip generic close 'X' buttons or back buttons in loops if they would dismiss the view entirely
          if (lowerText === 'skip to main content') continue;

          currentButton = cleanText || `Button #${i + 1} (<${await el.evaluate(e => e.tagName.toLowerCase()).catch(() => 'button')}>)`;
          
          // Click element safely
          await el.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(300);

          // If a modal or sheet opened (e.g. Add Food Modal, Shortcuts, Info sheet), close it with Escape or close button so subsequent buttons are accessible
          const modalCloseBtn = page.locator('button[aria-label="Close"], button:has-text("Cancel"), button:has-text("Close")').first();
          if (await modalCloseBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await modalCloseBtn.click().catch(() => {});
            await page.waitForTimeout(200);
          } else {
            await page.keyboard.press('Escape').catch(() => {});
          }
        } catch (e: any) {
          // Ignore element detach errors
        }
      }
    }

  } catch (err: any) {
    errors.push({
      route: currentRoute,
      buttonText: currentButton,
      errorMessage: `Test Execution Error: ${err.message}`
    });
  } finally {
    await browser.close();
  }

  // 6. Print list of: route, button text, error message
  console.log('\n============================================================');
  console.log('PLAYWRIGHT TEST RESULTS: ROUTE, BUTTON TEXT, ERROR MESSAGE');
  console.log('============================================================');

  if (errors.length === 0) {
    console.log('SUCCESS: No console errors or failed network requests (4xx/5xx) detected across any routes or button interactions!');
  } else {
    console.log(`Captured ${errors.length} error(s):\n`);
    console.table(errors);
    console.log('\nDetailed Breakdown:');
    errors.forEach((e, idx) => {
      console.log(`[${idx + 1}] Route: ${e.route} | Button: "${e.buttonText}" | Error: ${e.errorMessage}`);
    });
  }
}

runTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
