import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { catalogMaterials, flattenCatalog } from '../src/lib/resource-catalog.mjs';
import { visibleClasses } from '../src/lib/class-options.mjs';
import { readFileSync } from 'node:fs';
const expectedMaterials = catalogMaterials(JSON.parse(readFileSync('public/data/resource-catalog.json', 'utf8')), '10');

// Run after building: node tests/resource-library.browser.mjs
const server = await preview({ configFile: false, plugins: [{ name: 'static-astro-routes', configurePreviewServer(server) {
  server.middlewares.use((request, response, next) => {
    const url = new URL(request.url, 'http://localhost');
    const route = url.pathname.replace(/\/$/, '');
    if (existsSync(path.join(process.cwd(), 'dist', route, 'index.html'))) request.url = `${route}/index.html${url.search}`;
    next();
  });
} }], preview: { host: '127.0.0.1', port: 4174, strictPort: true } });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
const screenshots = path.resolve('../ui-review');
await mkdir(screenshots, { recursive: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, colorScheme: 'light' });
await context.addInitScript(() => {
  window.localStorage.setItem('icse_user_registry_tutorial_v1', JSON.stringify({
    hasSeenTutorial: true,
    tutorialVersion: 1,
    completedAt: Date.now(),
    method: 'completed'
  }));
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = 'http://127.0.0.1:4174';
async function ready() { await expect(page.locator('.library-load-status')).toHaveCount(0); await expect(page.locator('.library-more-button').first()).toBeEnabled(); }
async function noOverflow() { expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); }
try {
  await page.goto(`${base}/`);
  await expect(page.getByRole('navigation', { name: 'Choose your class' }).getByRole('link')).toHaveCount(visibleClasses.length);
  await expect(page.getByRole('link', { name: /ICSE.*CLASS.*10/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /ISC.*CLASS.*12/ })).toBeVisible();
  await expect(page.locator('#site-header, #app-modals-root, #resource-search')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your class.');
  await page.screenshot({ path: path.join(screenshots, 'home-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.screenshot({ path: path.join(screenshots, 'home-mobile.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.locator('[data-class-link="10"]').click();
  await ready();
  await expect(page.locator('#subject-title')).toContainText('Featured books');
  await expect(page.locator('.library-subjects .subject-icon')).toHaveCount(expectedMaterials.children.length);
  await page.getByRole('navigation', { name: 'Class 10 subjects' }).getByRole('link', { name: /Physics/ }).click();
  await expect(page.locator('#subject-title')).toContainText('Physics');
  await expect(page.locator('.library-category[open]')).toHaveCount(0);
  const guides = page.locator('.library-category').first();
  await guides.locator('summary').click();
  await expect(guides.locator('.library-files .library-file')).toHaveCount(3);
  expect(await guides.locator('.library-fade-preview').evaluate(element => getComputedStyle(element).filter)).toContain('blur');
  await guides.getByRole('button', { name: /Show more/ }).click();
  await expect(guides.locator('.library-files .library-file')).toHaveCount(15);
  await guides.getByRole('button', { name: 'Show less' }).click();
  await expect(guides.locator('.library-files .library-file')).toHaveCount(3);
  const papers = page.locator('.library-category').filter({ has: page.getByRole('heading', { name: 'Sample Papers', exact: true }) });
  await papers.locator('summary').click();
  await expect(papers.locator('.library-files .library-file')).toHaveCount(3);
  await papers.getByRole('button', { name: /Show more/ }).click();
  await expect(papers.locator('.library-files .library-file')).toHaveCount(23);
  await expect(papers.locator('.library-file-meta').filter({ hasText: 'Solutions View' })).toHaveCount(0);
  await expect(page.locator('.library-category').filter({ has: page.getByRole('heading', { name: 'Sample Paper Solutions', exact: true }) })).toHaveCount(0);
  await expect(page.locator('.library-file-meta').filter({ hasText: 'Solutions View' })).toHaveCount(0);
  await papers.getByRole('button', { name: 'Show less' }).click();
  await papers.locator('summary').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(screenshots, 'resources-desktop-light.png'), fullPage: true, animations: 'disabled' });
  await page.goBack();
  await expect(page.locator('#subject-title')).toContainText('Featured books');
  await page.goForward();
  await expect(page.locator('#subject-title')).toContainText('Physics');
  await page.getByRole('searchbox', { name: 'Search all Class 10 resources' }).fill('physics vatsal');
  await expect(page.locator('.library-results .library-file-name').first()).toContainText('Vatsal');
  await page.getByRole('searchbox', { name: 'Search all Class 10 resources' }).fill('randomwordthatcannotmatch12345');
  await expect(page.getByRole('heading', { name: 'No matching resources yet' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(page.locator('#subject-title')).toContainText('Physics');
  await page.getByRole('button', { name: 'Sample papers', exact: true }).click();
  await page.getByLabel('Subject', { exact: true }).selectOption('physics');
  await expect(page.locator('.library-results [role="status"]')).toContainText('54 results');
  await page.getByRole('button', { name: 'Back to subjects' }).click();
  for (const grade of visibleClasses.filter(grade => grade !== 10)) {
    await page.locator(`[data-class-link="${grade}"]`).click();
    await expect(page.getByRole('heading', { name: `Class ${grade} resources are on the way.` })).toBeVisible();
    await expect(page.locator(`[data-class-link="${grade}"]`)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.resource-library')).toHaveCount(0);
  }
  await page.getByRole('link', { name: 'Explore Class 10 resources', exact: true }).click();
  await ready();
  await page.goto(`${base}/study-materials#history-civics`);
  await ready();
  await expect(page.locator('#subject-title')).toContainText('History & Civics');
  await page.goto(`${base}/study-materials#physics`);
  await ready();
  for (const width of [360, 768, 1024, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow();
    if (width < 1024) {
      const menu = page.getByRole('button', { name: 'Open navigation menu' });
      await menu.click();
      await expect(page.locator('#mobile-nav-toggle')).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(page.locator('#mobile-nav-toggle')).toHaveAttribute('aria-expanded', 'false');
    }
    if (width === 360) {
      const subjectStrip = page.getByRole('navigation', { name: 'Class 10 subjects' });
      expect(await subjectStrip.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
      await expect(page.locator('#mobile-subject')).toHaveCount(0);
      await subjectStrip.getByRole('link', { name: /Maths/ }).click();
      await expect(page.locator('#subject-title')).toContainText('Maths');
      await subjectStrip.getByRole('link', { name: /Physics/ }).click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(screenshots, 'resources-mobile-light.png'), fullPage: true, animations: 'disabled' });
    }
  }
  await page.getByRole('button', { name: 'Search resources', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search study files' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await page.getByRole('dialog').evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab');
  expect(await page.getByRole('dialog').evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Search resources', exact: true })).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search study files' })).toBeFocused();
  await page.keyboard.press('Escape');
  await page.evaluate(() => { localStorage.setItem('theme', 'dark'); document.documentElement.classList.add('dark'); });
  await page.screenshot({ path: path.join(screenshots, 'resources-desktop-dark.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(screenshots, 'resources-mobile-dark.png'), fullPage: true, animations: 'disabled' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.library-content > section').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  // A failed data request keeps real previews usable and can be retried.
  await page.route('**/data/resource-catalog.json', route => route.abort());
  await page.goto(`${base}/study-materials`);
  await expect(page.getByRole('status')).toContainText('full library couldn’t load');
  await expect(page.locator('.library-category').first().locator('.library-files .library-file')).toHaveCount(3);
  await page.unroute('**/data/resource-catalog.json');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await ready();
  const plainContext = await browser.newContext({ javaScriptEnabled: false });
  const plainPage = await plainContext.newPage();
  await plainPage.goto(`${base}/study-materials`);
  await plainPage.getByRole('link', { name: 'Browse all Class 10 resources' }).click();
  await expect(plainPage.locator('.file-list li')).toHaveCount(flattenCatalog(expectedMaterials).length);
  await plainContext.close();
  // A newly discovered subject in another class needs no frontend code change.
  await page.route('**/data/resource-catalog.json', route => route.fulfill({ json: { version: 1, classes: { '12': {
    subjects: { name: 'subjects', type: 'folder', children: [] },
    pyq: { name: 'pyq', type: 'folder', children: [{ name: 'Economics', type: 'folder', children: [{ name: 'Economics 2026.pdf', type: 'file', id: 'economics-paper', archiveUrl: 'https://archive.org/details/example-economics' }] }] },
    specimen: { name: 'specimen', type: 'folder', children: [] },
  } } } }));
  await page.goto(`${base}/study-materials?class=12#economics`);
  await expect(page.locator('#subject-title')).toContainText('Economics');
  await expect(page.getByRole('heading', { name: 'PYQ', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Class 12 subjects' }).getByRole('link')).toHaveCount(1);
  await expect(page.getByRole('searchbox', { name: 'Search all Class 12 resources' })).toBeVisible();
  await expect(page.locator('.library-category[open]')).toHaveCount(0);
  await page.locator('.library-category summary').first().click();
  await expect(page.locator('.library-file-name')).toContainText('Economics 2026');
  await expect(page.locator('.library-file')).toHaveAttribute('href', '/resource?id=economics-paper&mode=download');
  await page.locator('.library-file').click();
  await expect(page.getByRole('dialog', { name: /Download Resource/i })).toBeVisible();
  await expect(page.getByText('Trying Server 1...')).toBeVisible();
  await expect(page.getByRole('button', { name: /Switch to Server 2|Try Server 2/i })).toBeVisible();
  await expect(page.getByText(/Google Drive|drive\.google\.com|Internet Archive|archive\.org/i)).toHaveCount(0);
  expect(context.pages().length).toBe(1);
  expect(errors).toEqual([]);
  console.log('PASS: class placeholders, subject history/deep links, complete category expansion, search/filter/reset, responsive overflow, mobile menu, global search, reduced motion, and no browser errors.');
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}

