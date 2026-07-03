import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER_PAGE_ERROR:', error.message));

  console.log('Navigating to app...');
  await page.goto('http://localhost:5173/');
  
  await page.waitForTimeout(2000);

  // Click on 'Catálogos' in the sidebar
  console.log('Clicking on Catalogos...');
  // Click any button or link containing 'Catálogos'
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('Catálogos'));
    if (el) el.click();
  });
  await page.waitForTimeout(1000);

  console.log('Clicking on Lugares tab...');
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Lugares'));
    if (el) el.click();
  });
  await page.waitForTimeout(1000);

  console.log('Clicking on Nuevo Lugar...');
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Nuevo Lugar'));
    if (el) el.click();
  });
  await page.waitForTimeout(1000);

  console.log('Typing name...');
  await page.fill('input[placeholder*="Ej. Mina Central"]', 'Prueba Nuevo Lugar');
  await page.waitForTimeout(1000);

  console.log('Clicking Guardar Ubicación...');
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Guardar Ubicación'));
    if (el) el.click();
  });
  
  await page.waitForTimeout(2000);

  console.log('Done.');
  await browser.close();
})();
