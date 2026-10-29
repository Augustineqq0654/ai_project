const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');
const { URL } = require('url');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'calendar.json');
const BANGUMI_API = 'https://api.bgm.tv/calendar';
const EPISODE_API = 'https://api.bgm.tv/v0/episodes';
const REQUEST_TIMEOUT_MS = 30000;
const MAX_REDIRECTS = 3;
const UA = 'AnimeTracker/1.0 (anime calendar data snapshot script)';

// ============ 代理解析（与 fetch-covers.js 同款规则）============

// 读取代理环境变量（兼容大小写与缺 scheme 写法，如 127.0.0.1:7897）
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
      } else {
        reject(new Error(`连接代理失败: ${e.code ? e.code + ' ' : ''}${e.message}（${proxy.display}）`));
      }
    });
    connectReq.end();
  });
}

// ============ HTTPS 请求 ============

function handleResponse(res, currentUrl, redirectsLeft, resolve, reject) {
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
}

// 经代理发送 https 请求（CONNECT 隧道 + TLS，https-proxy-agent 同款模式）
async function requestViaProxy(proxy, u, headers, redirectsLeft) {
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
    }, (res) => handleResponse(res, u.href, redirectsLeft, resolve, reject));
    req.on('timeout', () => {
      req.destroy(new Error('经代理的 HTTPS 请求超时——隧道已建立但目标站无响应，可能是代理规则未放行该域名（试试把 bangumi 相关域名加入代理规则）'));
    });
    req.on('error', (e) => reject(new Error(`经代理请求失败: ${e.message}`)));
    req.end();
  });
}

// 直连发送 https 请求
function requestDirect(u, headers, redirectsLeft) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      headers,
      timeout: REQUEST_TIMEOUT_MS,
    }, (res) => handleResponse(res, u.href, redirectsLeft, resolve, reject));
    req.on('timeout', () => {
      req.destroy(new Error('直连请求超时（当前未走代理或代理未生效）——终端连不上 Bangumi 时请设置 HTTPS_PROXY 环境变量，可先用 node scripts/fetch-covers.js doctor 排查'));
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
    Accept: 'application/json',
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

// ============ 剧集表 ============

// 逐部拉取本篇剧集的播出日期（v0 API），页面据此精确推算"更新至第几集"
// 返回 [[集数, 'YYYY-MM-DD'], ...]，无日期的条目跳过
async function fetchEpisodeSchedule(id) {
  const eps = [];
  const limit = 100;
  let offset = 0;
  for (;;) {
    const page = await fetchJson(`${EPISODE_API}?subject_id=${id}&type=0&limit=${limit}&offset=${offset}`);
    const chunk = Array.isArray(page.data) ? page.data : [];
    for (const ep of chunk) {
      if (!ep || !ep.airdate) continue;
      const num = typeof ep.ep === 'number' ? ep.ep : (typeof ep.sort === 'number' ? ep.sort : null);
      if (num === null) continue;
      eps.push([num, ep.airdate]);
    }
    offset += chunk.length;
    if (chunk.length < limit) break;
    if (typeof page.total === 'number' && offset >= page.total) break;
  }
  return eps;
}

// ============ 数据裁剪 ============

// 页面只用到这些字段（见 app.js：getAnimeTitle / getCoverUrls / getCurrentEpisodeFromSchedule / getDetailUrl）
function pickItem(it, eps) {
  const images = it.images || {};
  const out = {
    id: it.id,
    name: it.name || '',
    name_cn: it.name_cn || '',
    air_date: it.air_date || '',
    air_weekday: it.air_weekday || 0,
    url: it.url || '',
    images: {
      large: images.large || '',
      common: images.common || '',
      medium: images.medium || '',
    },
  };
  // 有剧集表时附上，页面用真实播出日期精算集数；缺失则页面回退日期估算
  if (Array.isArray(eps) && eps.length) out.eps = eps;
  return out;
}

// ============ 主流程 ============

async function main() {
  const proxy = resolveProxy(BANGUMI_API);
  if (proxy && proxy.invalid) {
    throw new Error(`代理环境变量格式无效: ${proxy.display}（正确示例: http://127.0.0.1:7897）`);
  }
  console.log(proxy
    ? `代理: ${proxy.display}（来自环境变量）`
    : '代理: 未设置（直连模式）。若下方长时间卡住或超时，先设置 HTTPS_PROXY，或运行 node scripts/fetch-covers.js doctor 排查');

  console.log('拉取 Bangumi 番组日历 ...');
  const data = await fetchJson(BANGUMI_API);
  if (!Array.isArray(data)) throw new Error('API 返回格式异常：期望数组');

  // 逐部拉取剧集播出日期（限速 500ms/请求），用于页面精确显示当前集数
  const ids = [...new Set(data.flatMap((d) => ((d && d.items) || []).map((it) => it.id)))];
  console.log(`拉取每部番的剧集表（共 ${ids.length} 部，约需 1-2 分钟）...`);
  const schedules = new Map();
  let epOk = 0;
  let epFailed = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      const eps = await fetchEpisodeSchedule(id);
      if (eps.length) schedules.set(id, eps);
      epOk++;
    } catch (e) {
      epFailed++;
      console.error('episodes fail', id, e.message.replace(/\n\s*/g, ' | '));
    }
    if ((i + 1) % 10 === 0 || i + 1 === ids.length) console.log(`  进度 ${i + 1}/${ids.length}`);
    await new Promise((r) => setTimeout(r, 500)); // 固定间隔，对 Bangumi 友好
  }
  console.log(`episodes: ok ${epOk} failed ${epFailed}`);
  if (epFailed > 0) {
    console.error('警告：部分剧集信息缺失，这些条目在页面会回退为开播日期估算，可重跑脚本补齐');
  }

  const days = data.map((d) => ({
    weekday: { id: d && d.weekday ? d.weekday.id : 0 },
    items: ((d && d.items) || []).map((it) => pickItem(it, schedules.get(it.id))),
  }));

  const count = days.reduce((sum, d) => sum + d.items.length, 0);
  if (count === 0) throw new Error('API 返回的番剧数量为 0，疑似数据异常，未覆盖旧快照');

  const out = {
    updatedAt: new Date().toISOString(),
    days,
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(out) + '\n');

  const kb = (fs.statSync(DATA_FILE).size / 1024).toFixed(1);
  console.log(`已写入 ${path.relative(process.cwd(), DATA_FILE)}（${days.length} 天 / ${count} 部 / ${kb} KB）`);
  console.log('提交并推送 data/calendar.json 后，国内网络打开页面即用此快照兜底。');
}

main().catch((e) => { console.error('\n[FATAL]', e.message); process.exit(1); });
