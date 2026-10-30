const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 零依赖本地静态服务器：用于通过 http:// 打开页面（file:// 下浏览器会因 CORS 拒绝读取
// excluded.json / data/calendar.json，导致共享配置和本地快照失效）
const ROOT = path.resolve(__dirname, '..');
const START_PORT = Number(process.argv[2]) || 8000;
const NO_OPEN = process.argv.includes('--no-open');
const MAX_PORT_TRIES = 10;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function send(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    send(res, 400, 'Bad Request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  const filePath = path.resolve(ROOT, '.' + pathname);
  // 防止目录穿越：只允许访问项目根目录内的文件
  if (!filePath.toLowerCase().startsWith(ROOT.toLowerCase() + path.sep)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      send(res, 404, 'Not Found: ' + pathname);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      // 本地预览不缓存，改完代码刷新即可看到
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

function openBrowser(url) {
  if (NO_OPEN) return;
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { stdio: 'ignore' });
    } else {
      spawn('xdg-open', [url], { stdio: 'ignore' });
    }
  } catch {
    // 打不开浏览器时让用户手动访问
  }
}

let port = START_PORT;
let tries = 0;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && tries < MAX_PORT_TRIES) {
    tries++;
    port++;
    console.log(`Port ${port - 1} is in use, trying ${port} ...`);
    setTimeout(() => server.listen(port, '127.0.0.1'), 50);
    return;
  }
  console.error('Failed to start local server:', err.message);
  process.exit(1);
});

server.on('listening', () => {
  const url = `http://127.0.0.1:${port}/`;
  // 输出使用 ASCII：Windows 中文控制台默认 GBK，UTF-8 中文会显示为乱码
  console.log('Local preview server is running (http:// is required: file:// cannot read the data snapshot).');
  console.log(`  URL : ${url}`);
  console.log(`  Root: ${ROOT}`);
  console.log('  Stop: Ctrl+C');
  openBrowser(url);
});

server.listen(port, '127.0.0.1');
