#!/usr/bin/env node
// Usage: node scripts/test-resolutions.mjs [url]
// Tests the chess coach webapp at all resolutions defined in resolutions_to_check.txt
// Loads a game from chess.com (amathur2k) and checks if eval graph and what-if section are visible

import { chromium } from 'playwright';
import { mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const BASE_URL = process.argv[2] || 'http://localhost:5000';
const USERNAME = 'amathur2k';

// Read resolutions from file
const resFile = join(projectRoot, 'resolutions_to_check.txt');
const resText = readFileSync(resFile, 'utf8');
const RESOLUTIONS = resText
  .split(/[\s,]+/)
  .map(s => s.trim())
  .filter(Boolean)
  .map(r => {
    const [w, h] = r.split('x').map(Number);
    return { width: w, height: h, label: r };
  });

const screenshotsDir = join(projectRoot, 'screenshots', 'resolutions');
if (!existsSync(screenshotsDir)) mkdirSync(screenshotsDir, { recursive: true });

const results = [];

async function loadGameAtResolution(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();

  try {
    // Step 1: Reset free game counter
    console.log(`  [${width}x${height}] Resetting game counter...`);
    await page.goto(`${BASE_URL}/yomama`, { waitUntil: 'networkidle', timeout: 15000 });

    // Step 2: Navigate to chess coach (root route)
    console.log(`  [${width}x${height}] Navigating to chess coach...`);
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);

    // Take a baseline screenshot
    const baselinePath = join(screenshotsDir, `${width}x${height}_01_baseline.png`);
    await page.screenshot({ path: baselinePath, fullPage: false });

    // Step 3: Open Import Games dialog
    console.log(`  [${width}x${height}] Opening Import Games dialog...`);
    await page.click('[data-testid="button-open-pgn"]');
    await page.waitForSelector('[data-testid="dialog-import-games"]', { timeout: 5000 });

    // Step 4: Ensure chess.com is selected (click it if not)
    const chesscomBtn = page.locator('[data-testid="button-source-chess-com"]');
    if (await chesscomBtn.count()) {
      await chesscomBtn.click();
    }

    // Step 5: Clear and type username
    console.log(`  [${width}x${height}] Entering username...`);
    const usernameInput = page.locator('[data-testid="input-username"]');
    await usernameInput.fill(USERNAME);

    // Step 6: Fetch games
    console.log(`  [${width}x${height}] Fetching games...`);
    await page.click('[data-testid="button-fetch-games"]');
    await page.waitForSelector('[data-testid="row-game-0"]', { timeout: 20000 });

    // Step 7: Click first game
    console.log(`  [${width}x${height}] Loading first game...`);
    await page.click('[data-testid="row-game-0"]');

    // Wait for dialog to close and game to load
    await page.waitForSelector('[data-testid="dialog-import-games"]', { state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(2500); // wait for eval/graph to render

    // Step 8: Take screenshot after game loaded
    const afterGamePath = join(screenshotsDir, `${width}x${height}_02_after_game.png`);
    await page.screenshot({ path: afterGamePath, fullPage: false });
    console.log(`  [${width}x${height}] Screenshot saved.`);

    // Step 9: Check visibility of eval graph and what-if section
    const evalGraphVisible = await page.locator('[data-testid="eval-graph"]').isVisible().catch(() => false);
    const evalGraphEmptyVisible = await page.locator('[data-testid="eval-graph-empty"]').isVisible().catch(() => false);
    const whatIfVisible = await page.getByText('What if?').isVisible().catch(() => false);
    const boardVisible = await page.locator('.react-chessboard, [data-testid="chessboard"]').first().isVisible().catch(() => false);

    // Check for paywall
    const paywallVisible = await page.locator('[data-testid="paywall-overlay"]').isVisible().catch(() => false);

    const status = {
      resolution: `${width}x${height}`,
      evalGraph: evalGraphVisible ? '✓ visible' : (evalGraphEmptyVisible ? '~ empty state' : '✗ MISSING'),
      whatIf: whatIfVisible ? '✓ visible' : '✗ MISSING',
      board: boardVisible ? '✓ visible' : '✗ MISSING',
      paywall: paywallVisible ? '⚠ paywall showing' : 'none',
      screenshots: [baselinePath, afterGamePath],
    };

    return status;
  } catch (err) {
    const errPath = join(screenshotsDir, `${width}x${height}_error.png`);
    await page.screenshot({ path: errPath, fullPage: false }).catch(() => {});
    return {
      resolution: `${width}x${height}`,
      error: err.message,
      screenshots: [errPath],
    };
  } finally {
    await context.close();
  }
}

async function main() {
  console.log(`Testing ${RESOLUTIONS.length} resolutions at ${BASE_URL}`);
  console.log(`Resolutions: ${RESOLUTIONS.map(r => r.label).join(', ')}\n`);

  const browser = await chromium.launch({ headless: true });

  for (const res of RESOLUTIONS) {
    console.log(`\nTesting ${res.label}...`);
    const result = await loadGameAtResolution(browser, res.width, res.height);
    results.push(result);
  }

  await browser.close();

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(70));

  let hasIssues = false;
  for (const r of results) {
    if (r.error) {
      console.log(`\n❌ ${r.resolution}`);
      console.log(`   ERROR: ${r.error}`);
      hasIssues = true;
    } else {
      const issues = [];
      if (r.evalGraph.startsWith('✗')) issues.push(`Eval graph missing`);
      if (r.whatIf.startsWith('✗')) issues.push(`What if? section missing`);
      if (r.paywall !== 'none') issues.push(r.paywall);

      if (issues.length > 0) {
        console.log(`\n⚠  ${r.resolution} — ISSUES: ${issues.join(', ')}`);
        hasIssues = true;
      } else {
        console.log(`\n✅ ${r.resolution}`);
      }
      console.log(`   Eval Graph : ${r.evalGraph}`);
      console.log(`   What if?   : ${r.whatIf}`);
      console.log(`   Board      : ${r.board}`);
      if (r.paywall !== 'none') console.log(`   Paywall    : ${r.paywall}`);
    }
    console.log(`   Screenshots: ${r.screenshots.map(s => s.replace(projectRoot + '/', '')).join(', ')}`);
  }

  console.log('\n' + '='.repeat(70));
  if (hasIssues) {
    console.log('⚠  Some resolutions have issues. Check screenshots above.');
  } else {
    console.log('✅ All resolutions passed!');
  }
  console.log(`Screenshots saved in: ${screenshotsDir.replace(projectRoot + '/', '')}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
