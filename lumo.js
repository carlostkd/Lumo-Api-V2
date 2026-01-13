const { firefox } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

let browser, context, page;
let busy = false;
let webSearchEnabled = false;

const START_GHOST_MODE = process.argv.some(arg => arg.toLowerCase() === 'ghost:true');

function updateStatus() {
  console.log('--------------------------');
  console.log(START_GHOST_MODE ? '👻 Ghost mode enabled (locked)' : '💬 Normal mode (ghost disabled)');
  console.log('✅ Lumo UI ready');
  console.log('🐈 Lumo API V2 running on http://localhost:3333');
  console.log(webSearchEnabled ? '🌐 Web search enabled' : '🌐 Web search disabled');
  console.log('--------------------------');
}

async function init() {
  browser = await firefox.launch({ headless: true });
  context = await browser.newContext({ storageState: 'auth.json' });
  page = await context.newPage();

  await page.goto('https://lumo.proton.me', { waitUntil: 'networkidle' });

  await page.waitForFunction(() => {
    return (
      document.querySelector('textarea') ||
      document.querySelector('[contenteditable="true"]') ||
      document.querySelector('[role="textbox"]')
    );
  }, { timeout: 60000 });

  if (START_GHOST_MODE) {
    await enableGhostMode();
  }

  const input = await page.$('textarea, [contenteditable="true"], [role="textbox"]');
  if (input) {
    await input.focus();
    await page.keyboard.type(' ');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);
  }

  updateStatus();
}

async function enableGhostMode() {
  try {
    await page.evaluate(() => {
      const ghostBtn =
        document.querySelector('button.button-ghost-norm') ||
        Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent?.toLowerCase().includes('ghost'));
      if (ghostBtn) ghostBtn.click();
    });
  } catch {
    console.warn('⚠️ Failed to enable ghost mode');
  }
}

async function sendPrompt(prompt, webSearch = false, debug = false) {
  if (busy) throw new Error('Model busy');
  busy = true;

  if (debug) {
    page.on('request', request => {
      if (
        request.url().includes('/api/ai/v1/chat') &&
        request.method() === 'POST'
      ) {
        const debugFile = path.join(__dirname, 'debug.json');
        fs.appendFileSync(debugFile, request.postData() + '\n', 'utf-8');
      }
    });
  }

  try {
    const wsButton = await page.$('button.web-search-button');
    if (wsButton) {
      const isActive = await wsButton.evaluate(btn =>
        btn.classList.contains('is-active')
      );
      if (webSearch && !isActive) await wsButton.click();
      if (!webSearch && isActive) await wsButton.click();
    }
    webSearchEnabled = !!webSearch;
    updateStatus();
  } catch {
    console.warn('⚠️ Web search button not found');
  }

  const input = await page.$('textarea, [contenteditable="true"], [role="textbox"]');
  if (!input) {
    busy = false;
    throw new Error('Input not found');
  }
  await input.focus();
  await page.keyboard.type(prompt, { delay: 10 });
  await page.keyboard.press('Enter');

  const answer = await page.evaluate(async (prompt) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const chatContainer = document.querySelector('[aria-label="Current chat"]') || document.body;
    let lastText = '';

    for (let i = 0; i < 20; i++) {
      let text = chatContainer.innerText || '';
      const idx = text.lastIndexOf(prompt);
      if (idx >= 0) text = text.slice(idx + prompt.length).trim();
      const lines = text.split('\n').map(l => l.trim()).filter(l => {
        return l && ![
          'Edit',
          'Ask anything to Lumo',
          'Upload',
          'Web search',
          'Press Enter to ask',
          'I like this response',
          'Report an issue',
          'Regenerate',
          'Conversation encrypted',
          'Lumo can make mistakes. Please double-check responses.'
        ].includes(l);
      });
      text = lines.join('\n');
      if (text && text !== lastText) {
        lastText = text;
        await sleep(500);
        const check = chatContainer.innerText.slice(idx + prompt.length).trim();
        const checkLines = check.split('\n').map(l => l.trim()).filter(l => l && ![
          'Edit',
          'Ask anything to Lumo',
          'Upload',
          'Web search',
          'Press Enter to ask',
          'I like this response',
          'Report an issue',
          'Regenerate',
          'Conversation encrypted',
          'Lumo can make mistakes. Please double-check responses.'
        ].includes(l));
        if (checkLines.join('\n') === lastText) return lastText;
      }
      await sleep(500);
    }
    return lastText;
  }, prompt);

  busy = false;
  return answer;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    return res.end();
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { prompt, webSearch = false, log = false, debug = false } = JSON.parse(body);
      if (!prompt) throw new Error('Missing prompt');

      if (!page) await init();
      const text = await sendPrompt(prompt, webSearch, debug);

      if (log) {
        const logEntry = {
          timestamp: new Date().toISOString(),
          prompt,
          webSearch,
          ghost: START_GHOST_MODE,
          response: text
        };
        fs.appendFileSync(
          path.join(__dirname, 'lumo_logs.json'),
          JSON.stringify(logEntry) + '\n',
          'utf-8'
        );
      }

      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(text);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Error: ' + err.message);
    }
  });
});

server.listen(3333, async () => {
  try {
    await init();
    console.log('🐈 Lumo API V2 running on http://localhost:3333');
  } catch (e) {
    console.error('❌ Init failed:', e.message);
    process.exit(1);
  }
});
