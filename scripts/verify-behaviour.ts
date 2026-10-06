import { chromium, expect } from 'playwright';

interface ReportRow {
  route: string;
  action: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'BROKEN' | 'ERROR';
}

async function run() {
  const report: ReportRow[] = [];
  const confirmedWorking: string[] = [];
  const confirmedBroken: string[] = [];

  function record(route: string, action: string, expected: string, actual: string, status: 'PASS' | 'BROKEN' | 'ERROR') {
    report.push({ route, action, expected, actual, status });
    const desc = `[${route}] ${action}`;
    if (status === 'PASS') {
      confirmedWorking.push(desc);
    } else {
      confirmedBroken.push(`${desc} — ${actual}`);
    }
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  const timestamp = Date.now();
  const testUsername = `testuser-${timestamp}`;

  await context.addInitScript((ts) => {
    localStorage.setItem('caloriq_session_token', `usr_test_${ts}`);
    localStorage.setItem('caloriq_user_email', `testuser-${ts}`);
    localStorage.setItem('caloriq_cookie_consent_at', new Date().toISOString());
    localStorage.setItem('caloriq_cookie_consent_v1', 'true');
    localStorage.setItem(`caloriq_signup_complete_usr_test_${ts}`, 'true');
    localStorage.removeItem('caloriq_is_guest');
  }, timestamp);

  const page = await context.newPage();

  try {
    // Navigate to dashboard
    console.log('Navigating to dashboard...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 20000 });
    
    // ==================== /dashboard ====================
    console.log('Testing /dashboard...');
    await page.waitForSelector('h4:has-text("Breakfast")', { timeout: 15000 });
    
    const todayStr = new Date().toLocaleDateString('en-US', { day: 'numeric' });
    const todayBtn = page.locator(`button:has(span:text-is("${todayStr}"))`).first();
    const isTodaySelected = await todayBtn.evaluate(el => el.classList.contains('bg-teal-500/20'));
    
    if (isTodaySelected) {
        record('/dashboard', 'Date check', 'Today is selected', 'Selected', 'PASS');
    } else {
        record('/dashboard', 'Date check', 'Today is selected', 'NOT selected', 'BROKEN');
    }

    // Log a test meal (100g banana)
    await page.locator('div:has(h4:has-text("Breakfast")) button:has-text("Add")').first().click();
    const modal = page.locator('div.fixed.inset-0.z-50');
    await modal.locator('textarea').first().fill('100g banana');
    
    // Wait for AI to decipher and button to be enabled
    await page.waitForFunction(() => {
        const text = document.body.textContent || '';
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Save Food'));
        return (text.includes('89 kcal') || text.includes('Banana')) && btn && !(btn as HTMLButtonElement).disabled;
    }, { timeout: 5000 });

    await modal.locator('button:has-text("Save Food")').first().click({ force: true });
    
    await page.waitForSelector('div:has(h4:has-text("Breakfast")) span:has-text("Banana")', { timeout: 10000 });
    record('/dashboard', 'Log meal', 'Banana in Breakfast', 'Appeared', 'PASS');

    await page.waitForFunction(() => {
        const valText = Array.from(document.querySelectorAll('span.font-mono')).map(s => s.textContent).join(' ');
        return valText.includes('89') || parseInt(valText.replace(/[^0-9]/g, '')) > 0;
    }, { timeout: 5000 });
    record('/dashboard', 'Calorie ring update', 'Eaten > 0', 'Updated', 'PASS');

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('div:has(h4:has-text("Breakfast")) span:has-text("Banana")', { timeout: 10000 });
    record('/dashboard', 'Reload persistence', 'Meal remains', 'Persisted', 'PASS');

    // ==================== /fitness ====================
    console.log('Testing /fitness...');
    await page.locator('nav.fixed.bottom-0 button[aria-label="Exercise"]').click();
    await page.waitForSelector('textarea[placeholder*="warm-up"]', { timeout: 10000 });
    
    const initialBurnText = await page.locator('span.text-3xl.font-extrabold.text-teal-400.font-mono').first().textContent() || '0';
    const initialBurn = parseInt(initialBurnText.replace(/[^0-9]/g, ''));
    
    await page.locator('textarea[placeholder*="warm-up"]').fill('20 min slow jog');
    await page.waitForFunction(() => {
        const text = document.querySelector('span.text-2xl.font-extrabold.text-teal-400.font-mono')?.textContent || '0';
        return parseInt(text) > 0;
    }, { timeout: 5000 });

    await page.locator('button:has-text("Save Exercise")').click();
    
    await page.waitForFunction((initial) => {
        const text = document.querySelector('span.text-3xl.font-extrabold.text-teal-400.font-mono')?.textContent || '0';
        return parseInt(text.replace(/[^0-9]/g, '')) > initial;
    }, initialBurn, { timeout: 10000 });
    
    const updatedBurn = await page.locator('span.text-3xl.font-extrabold.text-teal-400.font-mono').first().textContent();
    record('/fitness', 'Log jog', 'Burn increases', `Burn: ${updatedBurn}`, 'PASS');

    await page.locator('nav.fixed.bottom-0 button[aria-label="Diary"]').click();
    await page.waitForSelector('div:has(> span:text-is("Exercise"))', { timeout: 5000 });
    const dashBurnText = await page.locator('div:has(> span:text-is("Exercise")) span.font-mono').first().textContent() || '0';
    if (parseInt(dashBurnText.replace(/[^0-9]/g, '')) > 0) {
       record('/dashboard', 'Exercise burn shown', 'Exercise +X kcal shown', dashBurnText, 'PASS');
    } else {
       record('/dashboard', 'Exercise burn shown', 'Exercise +X kcal shown', 'Zero', 'BROKEN');
    }

    // ==================== /community ====================
    console.log('Testing /community...');
    await page.locator('nav.fixed.bottom-0 button[aria-label="Community"]').click();
    await page.waitForSelector('button:has-text("New post")', { timeout: 5000 });
    
    const postMsg = `playwright-test-${timestamp}`;
    await page.locator('button:has-text("New post")').click();
    await page.locator('textarea[placeholder*="Share"]').fill(postMsg);
    await page.locator('button[type="submit"]:has-text("Post")').click({ force: true });
    
    await page.waitForSelector(`article:has-text("${postMsg}")`, { timeout: 10000 });
    const postEl = page.locator(`article:has-text("${postMsg}")`).first();
    const userMatches = await postEl.locator(`span:has-text("@${testUsername}")`).isVisible();
    const timeMatches = await postEl.locator('span:has-text("Just now")').isVisible();
    
    if (userMatches && timeMatches) {
        record('/community', 'Create post', 'Post with user/timestamp', 'Confirmed', 'PASS');
    } else {
        record('/community', 'Create post', 'Post with user/timestamp', `User:${userMatches}, Time:${timeMatches}`, 'BROKEN');
    }

    // ==================== /reports ====================
    console.log('Testing /reports...');
    await page.locator('nav.fixed.bottom-0 button[aria-label="Reports"]').click();
    await page.waitForSelector('div.h-44', { timeout: 10000 }); 
    
    const chartHasData = await page.evaluate(() => {
        const bars = Array.from(document.querySelectorAll('div.h-44 div[style*="height"]'));
        return bars.some(b => !['0%', '0px', '6%'].includes((b as HTMLElement).style.height));
    });
    
    if (chartHasData) {
       record('/reports', 'Check 7-day chart', 'Non-zero bar', 'Found', 'PASS');
    } else {
       record('/reports', 'Check 7-day chart', 'Non-zero bar', 'All zero', 'BROKEN');
    }

    // Check weekly averages
    const averagesText = await page.locator('div:has(span:has-text("Avg")) span.font-mono').allTextContents();
    const hasAnyAverage = averagesText.some(t => parseInt(t.replace(/[^0-9]/g, '')) > 0);
    
    if (hasAnyAverage) {
        record('/reports', 'Weekly averages', 'Non-zero average', averagesText.join(', '), 'PASS');
    } else {
        record('/reports', 'Weekly averages', 'Non-zero average', 'All zero', 'BROKEN');
    }

    // ==================== /me ====================
    console.log('Testing /me...');
    await page.locator('nav.fixed.bottom-0 button[aria-label="Me"]').click();
    await page.waitForSelector('button:has-text("Light"), button:has-text("Dark")', { timeout: 10000 });
    
    await page.locator('button:has-text("Light")').first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.reload({ waitUntil: 'networkidle' });
    
    const isLightNow = await page.locator('button:has-text("Light")').first().evaluate(el => el.classList.contains('bg-teal-500'));
    if (isLightNow) {
        record('/me', 'Theme change', 'Theme remains Light', 'Persisted', 'PASS');
    } else {
        record('/me', 'Theme change', 'Theme remains Light', 'Reverted', 'BROKEN');
    }
    
    await page.locator('button:has-text("Dark")').first().click({ force: true });

    // ==================== /plan ====================
    console.log('Testing /plan...');
    await page.locator('nav.fixed.bottom-0 button[aria-label*="Plan" i]').first().click();

    await page.waitForSelector('button:has-text("Plan my meals")', { timeout: 10000 });
    await page.locator('button:has-text("Plan my meals")').click({ force: true });
    
    for (let i = 0; i < 7; i++) {
        const next = page.locator('button:has-text("Skip"), button:has-text("Next")').first();
        if (await next.isVisible({ timeout: 2000 })) {
            await next.click({ force: true });
            await page.waitForTimeout(500);
        }
    }
    await page.locator('button:has-text("Generate")').first().click({ force: true });
    
    await page.waitForSelector('h3:has-text("Today\'s Schedule")', { timeout: 25000 });
    record('/plan', 'Generate plan', 'Plan appears', 'Appeared', 'PASS');
    
    const firstMealName = await page.locator('span.text-xs.font-medium.text-zinc-200').first().textContent();
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('h3:has-text("Today\'s Schedule")', { timeout: 10000 });
    const firstMealNameAfter = await page.locator('span.text-xs.font-medium.text-zinc-200').first().textContent();
    
    if (firstMealName === firstMealNameAfter && firstMealName !== null) {
        record('/plan', 'Caching check', 'Same plan after reload', 'Confirmed', 'PASS');
    } else {
        record('/plan', 'Caching check', 'Same plan after reload', `Changed or null: ${firstMealNameAfter}`, 'BROKEN');
    }

  } catch (err: any) {
    console.error('Test execution error:', err);
    record('Global', 'Playwright Test Execution', 'All steps complete', `Error: ${err.message}`, 'ERROR');
  } finally {
    await browser.close();
  }

  // Output Report
  console.log('\nCONFIRMED WORKING:');
  confirmedWorking.forEach(item => console.log(`- ${item}`));
  console.log('\nCONFIRMED BROKEN:');
  confirmedBroken.forEach(item => console.log(`- ${item}`));

  console.log('\n| Route | Action | Expected | Actual | Status |');
  console.log('|-------|--------|----------|--------|--------|');
  report.forEach(r => {
    console.log(`| ${r.route} | ${r.action} | ${r.expected} | ${r.actual} | ${r.status} |`);
  });
}

run().catch(console.error);
