#!/usr/bin/env node
// Usage: node scripts/screenshot.mjs <url> [output-path] [--width=1280] [--height=800] [--full-page]

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

async function screenshot(url, outputPath, options = {}) {
  const { width = 1280, height = 800, fullPage = false } = options;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width, height });

  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  await page.screenshot({ path: outputPath, fullPage });
  await browser.close();

  console.log(`Screenshot saved to: ${outputPath}`);
}

// Parse CLI args
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/screenshot.mjs <url> [output-path] [--width=N] [--height=N] [--full-page]');
  process.exit(1);
}

const url = args[0];
const flags = args.filter(a => a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

const outputPath = positional[1] || `screenshots/${new URL(url).hostname}_${Date.now()}.png`;
const width = parseInt((flags.find(f => f.startsWith('--width=')) || '--width=1280').split('=')[1]);
const height = parseInt((flags.find(f => f.startsWith('--height=')) || '--height=800').split('=')[1]);
const fullPage = flags.includes('--full-page');

// Ensure output directory exists
const dir = dirname(outputPath);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

screenshot(url, outputPath, { width, height, fullPage }).catch(err => {
  console.error('Screenshot failed:', err.message);
  process.exit(1);
});
