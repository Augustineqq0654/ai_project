const fs = require('fs');
const path = require('path');
const https = require('https');

const COVERS_DIR = path.join(__dirname, '..', 'covers');
const BANGUMI_API = 'https://api.bgm.tv/calendar';

if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'AnimeTracker/1.0', 'Accept': 'application/json' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) { reject(new Error(String(res.statusCode))); return; }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function pickCover(img) {
  if (!img || typeof img !== 'object') return '';
  return img.large || img.common || img.medium || img.small || '';
}

async function main() {
  const data = await fetchJson(BANGUMI_API);
  const existing = new Set(
    fs.readdirSync(COVERS_DIR)
      .filter((f) => f.endsWith('.jpg'))
      .map((f) => f.replace(/\.jpg$/, '').toString())
  );

  const missing = [];
  for (const day of data) {
    for (const it of (day.items || [])) {
      const id = String(it.id);
      if (!existing.has(id)) {
        const url = pickCover(it.images);
        if (url) missing.push({ id, url });
      }
    }
  }

  console.log('have', existing.size, 'missing', missing.length);

  for (const m of missing) {
    try {
      const buf = await downloadFile(m.url);
      fs.writeFileSync(path.join(COVERS_DIR, m.id + '.jpg'), buf);
      console.log('downloaded', m.id);
      await new Promise((r) => setTimeout(r, 350));
    } catch (e) {
      console.error('skip', m.id, e.message);
    }
  }
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
