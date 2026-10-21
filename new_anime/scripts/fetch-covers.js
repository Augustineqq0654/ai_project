const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');
const { URL } = require('url');

const COVERS_DIR = path.join(__dirname, '..', 'covers');
const BANGUMI_API = 'https://api.bgm.tv/calendar';
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 30000;
const UA = 'AnimeTracker/1.0 (anime calendar cover fetch script)';

if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

// ============ 代理解析 ============

// 读取代理环境变量（兼容大小写与缺 scheme 写法，如 127.0.0.1:7897）
// http 目标回退到 HTTPS_PROXY：同一代理端口通常同时处理两种协议，且用户往往只设 HTTPS_PROXY
// （Bangumi API 返回的封面图就是 http:// 开头的）
function resolveProxy(targetUrl) {
  const env = process.env;
  const isHttps = new URL(targetUrl).protocol === 'https:';
  const raw = ((isHttps
    ? env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy
    : env.HTTP_PROXY || env.http_proxy || env.HTTPS_PROXY || env.https_proxy) || '').trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'http://' + raw;
  try {
    const u = new URL(withScheme);
    return {
      display: withScheme,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
    };
  } catch {
    return { invalid: true, display: raw };
  }
}

// TCP 连通性探测（诊断用）
function tcpProbe(host, port, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port });
    const timer = setTimeout(() => { sock.destroy(); reject(new Error('timeout')); }, timeoutMs);
    sock.on('connect', () => { clearTimeout(timer); sock.end(); resolve(); });
    sock.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

// 通过 HTTP 代理建立 CONNECT 隧道并完成 TLS 握手，返回已就绪的 TLS socket
function connectTunnel(proxy, hostname, port) {
  return new Promise((resolve, reject) => {
    const connectReq = http.request({
      host: proxy.hostname,
      port: proxy.port,
      method: 'CONNECT',
      path: `${hostname}:${port}`,
      headers: { Host: `${hostname}:${port}`, 'User-Agent': UA },
      timeout: REQUEST_TIMEOUT_MS,
    });
    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        reject(new Error(
          `代理拒绝隧道请求: HTTP ${res.statusCode}（${proxy.display}）。` +
          '请确认该端口是 HTTP 代理端口（Clash Verge 的“混合端口”），而不是仅 SOCKS 或仅 TUN 模式。'
        ));
        return;
      }
      const tlsSocket = tls.connect({ socket, servername: hostname });
      tlsSocket.on('error', (e) => reject(new Error(`经代理的 TLS 握手失败: ${e.message}`)));
      tlsSocket.on('secureConnect', () => resolve(tlsSocket));
    });
    connectReq.on('timeout', () => {
      connectReq.destroy(new Error(
        `代理 CONNECT 阶段超时（${proxy.display}）——端口有监听但不响应隧道请求，检查代理软件是否卡住或该端口并非代理端口`
      ));
    });
    connectReq.on('error', (e) => {
      if (e.code === 'ECONNREFUSED') {
        reject(new Error(
          `无法连接代理 ${proxy.display}（端口未监听）——检查代理软件是否在运行、端口号 ${proxy.port} 是否正确`
        ));
      } else if (e.code === 'ETIMEDOUT' || e.code === 'EAI_AGAIN' || e.code === 'ENOTFOUND') {
        reject(new Error(`连接代理失败: ${e.code} ${e.message}（${proxy.display}）`));
      } else {
        reject(new Error(`连接代理失败: ${e.message}`));
      }
    });
    connectReq.end();
  });
}

// ============ HTTP 请求 ============

function handleResponse(res, currentUrl, redirectsLeft) {
  return new Promise((resolve, reject) => {
    const status = res.statusCode || 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume(); // 丢弃响应体，释放连接
      if (redirectsLeft <= 0) { reject(new Error(`重定向次数超限 (${status}) -> ${currentUrl}`)); return; }
      let next;
      try { next = new URL(res.headers.location, currentUrl).href; }
      catch { reject(new Error(`重定向地址无效: ${res.headers.location}`)); return; }
      requestOnce(next, redirectsLeft - 1).then(resolve, reject);
      return;
    }
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
  });
}

// 经代理发送请求
async function requestViaProxy(proxy, u, headers, redirectsLeft) {
  if (u.protocol === 'http:') {
    // 经典 HTTP 代理：请求行用绝对 URL，不建隧道不握手 TLS（对 80 端口做 CONNECT+TLS 会失败）
    return await new Promise((resolve, reject) => {
      const req = http.request({
        host: proxy.hostname,
        port: proxy.port,
        method: 'GET',
        path: u.href,
        headers: { ...headers, Host: u.host },
        timeout: REQUEST_TIMEOUT_MS,
      }, (res) => {
        handleResponse(res, u.href, redirectsLeft).then(resolve, reject);
      });
      req.on('timeout', () => {
        req.destroy(new Error('经代理的 HTTP 请求超时——代理已连接但目标无响应，可能是代理规则未放行该域名'));
      });
      req.on('error', (e) => reject(new Error(`经代理请求失败: ${e.message}`)));
      req.end();
    });
  }
  // https 目标：CONNECT 隧道 + TLS（https-proxy-agent 同款模式）
  const tlsSocket = await connectTunnel(proxy, u.hostname, u.port || 443);
  return await new Promise((resolve, reject) => {
    const agent = new https.Agent({ keepAlive: false });
    agent.createConnection = () => tlsSocket; // 复用已握手的 TLS socket，不再二次握手
    const req = https.request({
      host: u.hostname,
      servername: u.hostname,
      method: 'GET',
      path: u.pathname + u.search,
      headers: { ...headers, Host: u.host },
      agent,
    }, (res) => {
      handleResponse(res, u.href, redirectsLeft).then(resolve, reject);
    });
    req.on('timeout', () => {
      req.destroy(new Error('经代理的 HTTPS 请求超时——隧道已建立但目标站无响应，可能是代理规则未放行该域名（试试把 bangumi 相关域名加入代理规则）'));
    });
    req.on('error', (e) => reject(new Error(`经代理请求失败: ${e.message}`)));
    req.end();
  });
}

// 直连发送请求
function requestDirect(u, headers, redirectsLeft) {
  return new Promise((resolve, reject) => {
    const isHttps = u.protocol === 'https:';
    const req = (isHttps ? https : http).get({
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + u.search,
      headers,
      timeout: REQUEST_TIMEOUT_MS,
    }, (res) => {
      handleResponse(res, u.href, redirectsLeft).then(resolve, reject);
    });
    req.on('timeout', () => {
      req.destroy(new Error('直连请求超时（当前未走代理或代理未生效）——终端连不上 Bangumi 时请设置 HTTPS_PROXY 环境变量，用 doctor 模式可分步排查'));
    });
    req.on('error', (e) => {
      if (e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN') {
        reject(new Error(`域名无法解析 (${e.code})——网络不通；如需代理请设置 HTTPS_PROXY 后重试`));
      } else if (e.message && e.message.includes('超时')) {
        reject(e);
      } else {
        reject(new Error(`直连请求失败: ${e.code ? e.code + ' ' : ''}${e.message}`));
      }
    });
  });
}

async function requestOnce(url, redirectsLeft = MAX_REDIRECTS) {
  let u;
  try { u = new URL(url); } catch { throw new Error(`无效 URL: ${url}`); }
  const headers = {
    'User-Agent': UA,
    Accept: url.startsWith(BANGUMI_API) ? 'application/json' : '*/*',
  };
  const proxy = resolveProxy(url);
  if (proxy && proxy.invalid) {
    throw new Error(`代理环境变量格式无效: ${proxy.display}（正确示例: http://127.0.0.1:7897）`);
  }
  return proxy
    ? requestViaProxy(proxy, u, headers, redirectsLeft)
    : requestDirect(u, headers, redirectsLeft);
}

async function fetchJson(url) {
  const res = await requestOnce(url);
  if (res.status !== 200) {
    const snippet = res.body.toString('utf8').slice(0, 120);
    throw new Error(`API 返回 HTTP ${res.status}: ${url}\n  响应片段: ${snippet}`);
  }
  try {
    return JSON.parse(res.body.toString('utf8'));
  } catch (e) {
    const snippet = res.body.toString('utf8').slice(0, 120);
    throw new Error(`API 响应不是合法 JSON (${e.message}): ${url}\n  响应片段: ${snippet}`);
  }
}

async function downloadFile(url) {
  const res = await requestOnce(url);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const b = res.body;
  // JPEG 魔数校验，防止把 CDN 错误页/拦截页存成 .jpg
  if (!(b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)) {
    throw new Error(`响应不是 JPEG（Content-Type: ${res.headers['content-type'] || '未知'}）`);
  }
  return b;
}

function pickCover(img) {
  if (!img || typeof img !== 'object') return '';
  return img.large || img.common || img.medium || img.small || '';
}

// ============ 诊断模式 ============

async function doctor() {
  console.log('== 诊断模式：分步检查网络链路 ==\n');
  const envVars = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'];
  let envShown = false;
  for (const k of envVars) {
    if (process.env[k]) { console.log(`[1/4] 环境变量 ${k} = ${process.env[k]}`); envShown = true; }
  }
  if (!envShown) console.log('[1/4] 环境变量: 未设置任何代理变量（当前为直连模式）');

  const proxy = resolveProxy(BANGUMI_API);
  if (proxy && proxy.invalid) {
    console.error(`\n[FAIL] 代理变量格式无效: ${proxy.display}（正确示例: http://127.0.0.1:7897）`);
    process.exit(1);
  }
  const target = new URL(BANGUMI_API);

  if (proxy) {
    console.log(`[2/4] TCP 连接代理 ${proxy.hostname}:${proxy.port} ...`);
    try {
      await tcpProbe(proxy.hostname, Number(proxy.port));
      console.log('       OK — 代理端口有监听');
    } catch (e) {
      console.error(`\n[FAIL] 连不上代理端口（${e.code || e.message}）。`);
      console.error('       端口未监听或地址错误。请确认: 代理软件正在运行；使用的是“混合端口/HTTP 端口”（Clash Verge 默认 7897）；环境变量里的端口与之一致。');
      process.exit(1);
    }
    console.log(`[3/4] CONNECT 隧道 -> ${target.hostname}:443 + TLS ...`);
    try {
      await connectTunnel(proxy, target.hostname, 443);
      console.log('       OK — 隧道与 TLS 握手成功');
    } catch (e) {
      console.error(`\n[FAIL] ${e.message}`);
      process.exit(1);
    }
  } else {
    console.log(`[2/4] TCP 直连 ${target.hostname}:443 ...`);
    try {
      await tcpProbe(target.hostname, 443);
      console.log('       OK');
    } catch (e) {
      console.error(`\n[FAIL] 直连不通（${e.code || e.message}）——这就是超时的根源。`);
      console.error('       解决: 设置代理环境变量后重跑 doctor。PowerShell:');
      console.error('       $env:HTTPS_PROXY = "http://127.0.0.1:7897"');
      process.exit(1);
    }
    console.log('[3/4] (直连模式，无隧道步骤)');
  }

  console.log('[4/4] HTTPS GET /calendar ...');
  try {
    const data = await fetchJson(BANGUMI_API);
    const count = Array.isArray(data) ? data.length : '?';
    console.log(`\n[OK] 全链路通，可以正常下载封面了。日历天数: ${count}`);
    console.log('     退出诊断，直接运行: node scripts/fetch-covers.js');
  } catch (e) {
    console.error(`\n[FAIL] ${e.message}`);
    process.exit(1);
  }
}

// ============ 主流程 ============

async function main() {
  const proxy = resolveProxy(BANGUMI_API);
  if (proxy && proxy.invalid) {
    throw new Error(`代理环境变量格式无效: ${proxy.display}（正确示例: http://127.0.0.1:7897）`);
  }
  console.log(proxy
    ? `代理: ${proxy.display}（来自环境变量）`
    : '代理: 未设置（直连模式）。若下方长时间卡住或超时，先运行诊断: node scripts/fetch-covers.js doctor');

  console.log('拉取 Bangumi 番组日历 ...');
  const data = await fetchJson(BANGUMI_API);
  if (!Array.isArray(data)) throw new Error('API 返回格式异常：期望数组');

  const existing = new Set(
    fs.readdirSync(COVERS_DIR)
      .filter((f) => f.toLowerCase().endsWith('.jpg'))
      .map((f) => f.replace(/\.jpg$/i, ''))
  );

  const seen = new Set();
  const missing = [];
  for (const day of data) {
    for (const it of (day && day.items) || []) {
      const id = String(it.id);
      if (existing.has(id) || seen.has(id)) continue;
      seen.add(id);
      const url = pickCover(it.images);
      if (url) missing.push({ id, url });
    }
  }

  console.log(`have ${existing.size} missing ${missing.length}`);

  let ok = 0;
  let failed = 0;
  for (const m of missing) {
    try {
      const buf = await downloadFile(m.url);
      fs.writeFileSync(path.join(COVERS_DIR, m.id + '.jpg'), buf);
      ok++;
      console.log('downloaded', m.id);
    } catch (e) {
      failed++;
      console.error('skip', m.id, e.message.replace(/\n\s*/g, ' | '));
    }
    await new Promise((r) => setTimeout(r, 350)); // 固定间隔，对 Bangumi 友好
  }

  console.log(`done: ok ${ok} failed ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

const cmd = process.argv[2];
if (cmd === 'doctor') {
  doctor().catch((e) => { console.error('\n[FATAL]', e.message); process.exit(1); });
} else {
  main().catch((e) => { console.error('\n[FATAL]', e.message); process.exit(1); });
}
