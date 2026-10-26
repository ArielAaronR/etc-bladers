// Finds ETC's next event on West Coast Bladers and writes it to src/data/event.json,
// which the page features. Run by the GitHub Actions workflow before each build, or by
// hand with `npm run find-event`.
//
// WCB's events page is an app with no plain links, so this opens it in headless Chrome,
// declines optional cookies, opens the first upcoming card whose title starts with the
// prefix below, and reads the event's address from its "Open Page" button.
//
// Exit codes: 0 = event.json written (an event, or null when none is listed);
//             1 = the page could not be read, event.json left untouched.
import puppeteer from 'puppeteer-core';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EVENTS_URL = 'https://westcoastbladers.com/events';
const PREFIX = /^ETC Blader/i;
const OUT = fileURLToPath(new URL('../src/data/event.json', import.meta.url));

const chromePath =
  process.env.CHROME_PATH ??
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].find((p) => existsSync(p));
if (!chromePath) fail('No Chrome found. Set CHROME_PATH to a Chrome or Chromium executable.');

const browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1600 });
  await page.goto(EVENTS_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('article h3', { timeout: 30000 });

  // The cookie prompt covers the page and swallows clicks.
  await page.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Essentials Only')?.click()
  );
  await sleep(800);

  // The list loads more as it scrolls; look a few screens down before giving up.
  let card = null;
  for (let i = 0; i < 6 && !card; i++) {
    card = await page.evaluate((prefix) => {
      const re = new RegExp(prefix, 'i');
      const articles = [...document.querySelectorAll('article')];
      const index = articles.findIndex((a) => re.test(a.querySelector('h3')?.textContent.trim() ?? ''));
      if (index < 0) return null;
      const a = articles[index];
      const lines = a.innerText.split('\n').map((l) => l.trim()).filter(Boolean);
      return {
        index,
        title: a.querySelector('h3').textContent.trim(),
        when: lines.find((l) => /\b\d{4}\b.*•/.test(l)) ?? '',
        address: lines[lines.indexOf('📍') + 1] ?? '',
      };
    }, PREFIX.source);
    if (!card) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await sleep(1500);
    }
  }

  if (!card) {
    writeFileSync(OUT, 'null\n');
    console.log('No upcoming ETC event listed. Wrote null; the page will link to all events.');
  } else {
    // Open the card's preview, then catch the address its "Open Page" button would open.
    await page.evaluate((i) => document.querySelectorAll('article')[i].click(), card.index);
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Open Page/.test(b.textContent)), {
      timeout: 15000,
    });
    const url = await page.evaluate(() => {
      let opened = null;
      window.open = (u) => ((opened = String(u)), null);
      [...document.querySelectorAll('button')].find((b) => /Open Page/.test(b.textContent)).click();
      return opened;
    });
    if (!url || !/\/events\/view\/[\w-]+$/.test(new URL(url, EVENTS_URL).pathname))
      fail(`Found "${card.title}" but could not read its link (got ${url}).`);

    const event = {
      title: card.title,
      url: new URL(url, EVENTS_URL).href,
      start: parseWhen(card.when),
      place: venue(card.address),
    };
    writeFileSync(OUT, JSON.stringify(event, null, 2) + '\n');
    console.log('Featured event:', event);
  }
} catch (e) {
  fail(e.message);
} finally {
  await browser.close();
}

// "Tuesday, October 27th, 2026 • 7 PM" → "2026-10-27T19:00:00-07:00" (Pacific time).
function parseWhen(text) {
  const m = text.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s*(\d{4})\s*•\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!m) fail(`Could not read the date "${text}".`);
  const [, monthName, day, year, h, min = '00', ampm] = m;
  const month = new Date(`${monthName} 1, 2000`).getMonth() + 1;
  const hour = (Number(h) % 12) + (/pm/i.test(ampm) ? 12 : 0);
  const pad = (n) => String(n).padStart(2, '0');
  const noon = new Date(Date.UTC(Number(year), month - 1, Number(day), 20));
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'longOffset' })
    .formatToParts(noon)
    .find((p) => p.type === 'timeZoneName')
    .value.replace('GMT', '');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${min}:00${offset || '+00:00'}`;
}

// "Noble Ale Works 1621 S Sinclair, St B Anaheim, ..." → "Noble Ale Works"; a bare street
// address is kept whole.
function venue(address) {
  const name = address.split(/\s\d/)[0].trim();
  return name && name !== address ? name : address;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fail(message) {
  console.error(`find-event: ${message}`);
  process.exit(1);
}
