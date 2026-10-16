import { chromium } from 'playwright';

const routes = ['watch?aid=1', 'platinum', 'dsplatinum', 'rapid', 'dsrapid', 'multiplier', 'dsmultiplier', 'protector', 'dsprotector', 'social', 'dssocial'];
const browser = await chromium.launch({ headless: true });

for (const route of routes) {
  const page = await browser.newPage();
  const media = new Set();
  page.on('request', request => {
    const url = request.url();
    if (/\.(m3u8|mp4|webm|mov)(\?|$)|bunny|wistia|vimeo|vidalytics|voomly|leadconnector.*video|video.*leadconnector/i.test(url)) media.add(url);
  });
  await page.goto(`https://dailypayouts.co/${route}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const elements = await page.locator('video, source, iframe').evaluateAll(nodes => nodes.map(node => ({
    tag: node.tagName,
    src: node.currentSrc || node.src || node.getAttribute('src') || '',
    poster: node.poster || ''
  })).filter(item => item.src || item.poster));
  console.log(JSON.stringify({ route, elements, media: [...media] }));
  await page.close();
}

await browser.close();
