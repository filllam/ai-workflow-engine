// ai-quarrel-v2.5.js (Ultimate Flexibility Edition)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ====================== 1. 全局設定與目錄 ======================
const ERROR_LOG_DIR = path.join(__dirname, 'error-logs');
const DEBUG_DIR = path.join(__dirname, 'debug-logs');
const USER_DATA_DIR = path.join(__dirname, 'user_data');
const LOG_DIR = path.join(__dirname, 'AI工作流紀錄');
[ERROR_LOG_DIR, DEBUG_DIR, USER_DATA_DIR, LOG_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

const USER_SETTINGS_PATH = path.join(__dirname, 'user-settings.json');

// 全局錯誤捕獲
process.on('uncaughtException', (error, origin) => {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const logContent = `TIME: ${new Date().toISOString()}\nORIGIN: ${origin}\nERROR: ${error.name}\nMSG: ${error.message}\nSTACK: ${error.stack}\n`;
  fs.writeFileSync(path.join(ERROR_LOG_DIR, `${timestamp}-CRASH.log`), logContent);
  console.error('CRITICAL ERROR: 程式崩潰,日誌已存檔。');
  process.exit(1);
});

// TTS 支援
const speak = process.platform === 'darwin' ? text => execSync(`say "${text.replace(/"/g, '\\"')}"`, {stdio:'ignore'})
             : process.platform === 'win32' ? text => execSync(`PowerShell -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak('${text.replace(/'/g, "''")}')"`, {stdio:'ignore'})
             : (() => {});

// 日誌系統
const SESSION = new Date().toISOString().slice(0,19).replace(/:/g, '-');
const LOG_FILE = path.join(LOG_DIR, `${SESSION}.md`);
fs.writeFileSync(LOG_FILE, `# AI Workflow v2.5 Log - ${SESSION.replace('T', ' ')}\n\n`);

function log(text, speaker = '') {
  console.log(`\n${speaker || 'SYS'}: ${text.slice(0,100)}...`);
  fs.appendFileSync(LOG_FILE, speaker ? `**${speaker}**: ${text}\n\n` : `> ${text}\n\n`);
  if (speaker) try { speak(text.replace(/\*\*|[@#]/g, '').slice(0, 150)); } catch(e){} 
}

// ====================== 2. 主程序 ======================
(async () => {
  log('Engine v2.5 Started (Ultimate Flexibility Edition)');

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: null,
    args: ['--start-maximized'],
    ignoreDefaultArgs: ['--enable-automation']
  });

  let pages = context.pages();
  while (pages.length < 5) pages.push(await context.newPage());
  const [definerPage, ...aiPages] = pages;

  // ====================== 3. 終極靈活的 GUI ======================
  await definerPage.setContent(`
    <style>
      body{background:#111;color:#0f0;font-family:monospace;padding:20px;font-size:14px;}
      h1,h2,h3{color:#0f0;border-bottom:1px solid #0f0;padding-bottom:5px;}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;}
      .slot{border:1px solid #555;padding:15px;border-radius:5px;}
      input,textarea{width:100%;background:#222;color:#fff;border:1px solid #0f0;margin:5px 0;padding:8px;box-sizing:border-box;}
      button{width:100%;padding:15px;background:#0f0;color:#000;font-weight:bold;cursor:pointer;font-size:18px;border:none;margin-top:20px;}
      #status{border:1px solid #fff;padding:10px;margin:20px 0;background:#222;}
    </style>
    <h1>AI Workflow v2.5</h1>
    <div id="status">READY</div>
    
    <h2>AI 視窗配置</h2>
    <div class="grid">
      ${[0,1,2,3].map(i => `
        <div class="slot">
          <h3>視窗 ${i+1}</h3>
          <input id="name${i}" placeholder="自訂名稱 (例如: Claude-3)">
          <input id="url${i}" placeholder="貼上 AI 網址 (例如: https://claude.ai/chats)">
        </div>
      `).join('')}
    </div>

    <h2>角色與任務</h2>
    <div class="grid">
      ${[0,1,2,3].map(i => `
        <div class="slot">
          <b>視窗 ${i+1} 角色</b><br><textarea id="r${i}" rows="2"></textarea>
        </div>
      `).join('')}
    </div>
    <h3>初始任務</h3><textarea id="task" rows="3"></textarea>
    <h3>工作流 (WDL)</h3><textarea id="wdl" rows="5">USER -> 1\n1 -> (2,3)\n(2,3) -> 4</textarea>
    
    <button onclick="run()">EXECUTE WORKFLOW</button>
    
    <script>
      // 頁面載入時,請求後端發送儲存的設定
      window.addEventListener('DOMContentLoaded', () => window.getSettings());

      // 後端通過此函數將設定填充到前端
      window.loadSettings = (settings) => {
        if (!settings) return;
        for(let i=0; i<4; i++) {
          document.getElementById('name'+i).value = settings.aiSlots[i]?.name || '';
          document.getElementById('url'+i).value = settings.aiSlots[i]?.url || '';
        }
      };

      function run() {
        const data = {
          aiSlots: [0,1,2,3].map(i => ({
            name: document.getElementById('name'+i).value.trim(),
            url: document.getElementById('url'+i).value.trim()
          })),
          roles: [0,1,2,3].map(i=>document.getElementById('r'+i).value),
          workflow: document.getElementById('wdl').value,
          initialTask: document.getElementById('task').value
        };
        document.getElementById('status').innerText = 'RUNNING...';
        window.startWorkflow(data);
      }
    </script>
  `);
  
  // ====================== 4. 後端邏輯與數據處理 ======================
  global.workflowData = null;

  // 後端:處理前端請求,讀取並發送設定
  await definerPage.exposeFunction('getSettings', () => {
    if (fs.existsSync(USER_SETTINGS_PATH)) {
      const settings = JSON.parse(fs.readFileSync(USER_SETTINGS_PATH, 'utf-8'));
      definerPage.evaluate(s => window.loadSettings(s), settings);
    }
  });

  // 後端:接收前端啟動指令
  await definerPage.exposeFunction('startWorkflow', data => {
    // 儲存最新的設定
    fs.writeFileSync(USER_SETTINGS_PATH, JSON.stringify({ aiSlots: data.aiSlots }));
    global.workflowData = data;
  });
  
  await definerPage.bringToFront();

  // Wait Logic
  const waitReply = async (page, name) => {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
    const sel = config.selectors.find(s => name.toLowerCase().includes(s.keyword))?.reply || 'body';

    let last = '', same = 0, maxWait = 120;
    const start = Date.now();
    while (Date.now() - start < maxWait * 1000) {
      const txt = await page.locator(sel).last().innerText().catch(()=>'') || '';
      if (txt && txt !== last) { last = txt; same = 0; }
      else if (++same > 6) return txt.trim();
      await page.waitForTimeout(1000);
    }
    fs.writeFileSync(path.join(DEBUG_DIR, `${Date.now()}-${name}-timeout.html`), await page.content());
    return "(TIMEOUT)";
  };

  // ====================== 5. 主執行循環 (動態化) ======================
  while(true) {
    if (global.workflowData) {
      const { aiSlots, roles, workflow, initialTask } = global.workflowData;
      global.workflowData = null;
      log(`TASK: ${initialTask}`);
      
      // 動態導航
      for (let i = 0; i < 4; i++) {
        const currentUrl = aiPages[i].url();
        const targetUrl = aiSlots[i].url;
        if (targetUrl && (currentUrl === 'about:blank' || !currentUrl.includes(new URL(targetUrl).hostname))) {
            log(`Navigating Window ${i+1} to ${aiSlots[i].name}...`);
            await aiPages[i].goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        }
      }
      
      // 佈局
      const w = Math.floor(screen.width/2), h = Math.floor(screen.height/2);
      for (let i = 0; i < 4; i++) { try { const cdp = await aiPages[i].context().newCDPSession(aiPages[i]); await cdp.send('Browser.setWindowBounds', { windowId: (await cdp.send('Browser.getWindowForTarget')).windowId, bounds: { left: (i%2)*w, top: Math.floor(i/2)*h, width: w, height: h, windowState: 'normal' } }); } catch (e) {} }

      const plan = []; // WDL Parser
      workflow.split('\n').map(l=>l.trim()).forEach(l => { if(l.includes('->')) { const [src, dst] = l.split('->'); plan.push({ src: src.includes('USER')?'USER':(src.match(/\d+/g)||[]).map(n=>n-1), dst: (dst.match(/\d+/g)||[]).map(n=>n-1) }); } });

      const outs = ["","","",""];
      for (const step of plan) {
        let ctx = "";
        if (step.src === 'USER') ctx = initialTask;
        else if (Array.isArray(step.src)) ctx = step.src.map(i=>`[${aiSlots[i].name}]: ${outs[i]}`).join('\n');
        else ctx = outs[step.src];

        await Promise.all(step.dst.map(async i => {
          const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
          const inputSelector = config.selectors.find(s => aiSlots[i].name.toLowerCase().includes(s.keyword))?.input || 'textarea';

          const prompt = `${roles[i] ? `ROLE:${roles[i]}\n` : ''}CTX:\n${ctx}\n\nREPLY:`;
          await aiPages[i].fill(inputSelector, prompt);
          await aiPages[i].keyboard.press('Enter');
          const res = await waitReply(aiPages[i], aiSlots[i].name);
          outs[i] = res;
          log(res, aiSlots[i].name);
        }));
      }
      log('DONE');
      await definerPage.evaluate(()=>document.getElementById('status').innerText='DONE');
    }
    await definerPage.waitForTimeout(1000);
  }
})();
