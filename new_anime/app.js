// ==================== 配置 ====================
// 使用 Bangumi 番组计划 API，直接返回按星期分组的番剧数据，且包含中文名
const BANGUMI_API = 'https://api.bgm.tv/calendar';

const WEEKDAYS = [
  { cn: '周一', color: '#ff6b6b' },
  { cn: '周二', color: '#ffa94d' },
  { cn: '周三', color: '#ffd43b' },
  { cn: '周四', color: '#69db7c' },
  { cn: '周五', color: '#4dabf7' },
  { cn: '周六', color: '#9775fa' },
  { cn: '周日', color: '#f783ac' },
];

// 当前选中的天
let selectedDay = 0;
let cachedData = null;

// ==================== 隐藏/删除列表管理 ====================
const HIDDEN_KEY = 'anime_hidden_ids';
const DELETED_KEY = 'anime_deleted_ids';

function getHiddenIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'));
  } catch { return new Set(); }
}

function saveHiddenIds(idSet) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify([...idSet]));
}

function getDeletedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DELETED_KEY) || '[]'));
  } catch { return new Set(); }
}

function saveDeletedIds(idSet) {
  localStorage.setItem(DELETED_KEY, JSON.stringify([...idSet]));
}

// ==================== 集数手动覆盖 ====================
const EP_OVERRIDE_KEY = 'anime_episode_override';

function getEpisodeOverrides() {
  try { return JSON.parse(localStorage.getItem(EP_OVERRIDE_KEY) || '{}'); }
  catch { return {}; }
}

function setEpisodeOverride(id, ep) {
  const map = getEpisodeOverrides();
  if (ep > 0) map[id] = ep; else delete map[id];
  localStorage.setItem(EP_OVERRIDE_KEY, JSON.stringify(map));
}

// ==================== 自定义链接 ====================
const LINK_OVERRIDE_KEY = 'anime_link_override';

function getLinkOverrides() {
  try { return JSON.parse(localStorage.getItem(LINK_OVERRIDE_KEY) || '{}'); }
  catch { return {}; }
}

function setLinkOverride(id, url) {
  const map = getLinkOverrides();
  const clean = (url || '').trim().replace(/^http:/, 'https:');
  if (/^https?:\/\//i.test(clean)) map[id] = clean; else delete map[id];
  localStorage.setItem(LINK_OVERRIDE_KEY, JSON.stringify(map));
}

function getDetailUrl(anime) {
  const custom = getLinkOverrides()[anime.id];
  if (custom) return custom;
  return (anime.url || `https://bgm.tv/subject/${anime.id}`).replace(/^http:/, 'https:');
}

function editLink(id) {
  const overrides = getLinkOverrides();
  const input = prompt('设置自定义链接（需以 http:// 或 https:// 开头；留空或取消=恢复默认 Bangumi 链接）：', overrides[id] || '');
  if (input === null) return;
  if ((input || '').trim() !== '' && !/^https?:\/\//i.test((input || '').trim())) {
    alert('链接无效，已恢复默认。链接需以 http:// 或 https:// 开头。');
  }
  setLinkOverride(id, input);
  if (cachedData) {
    updateWeekdayCounts(cachedData);
    renderDay(cachedData);
  }
}

function toggleHide(id) {
  const ids = getHiddenIds();
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  saveHiddenIds(ids);
  if (cachedData) {
    updateWeekdayCounts(cachedData);
    renderDay(cachedData);
  }
}

function deleteAnime(id) {
  const ids = getDeletedIds();
  ids.add(id);
  saveDeletedIds(ids);
  // 同时从隐藏列表中移除
  const hidden = getHiddenIds();
  hidden.delete(id);
  saveHiddenIds(hidden);
  if (cachedData) {
    updateWeekdayCounts(cachedData);
    renderDay(cachedData);
  }
}

function restoreAnime(id) {
  const ids = getDeletedIds();
  ids.delete(id);
  saveDeletedIds(ids);
  if (cachedData) {
    updateWeekdayCounts(cachedData);
    renderDay(cachedData);
    openTrashModal(); // 刷新回收站弹窗
  }
}

// 过滤掉隐藏、删除和非日漫的番剧
function filterVisible(animeList) {
  const hidden = getHiddenIds();
  const deleted = getDeletedIds();
  return animeList.filter(a => !hidden.has(a.id) && !deleted.has(a.id) && isJapaneseAnime(a));
}

// 国漫关键词黑名单（名字含这些词的不是日漫）
const CN_NAME_PATTERNS = ['大理寺', '狂王', '肥志', '熊出没', '宝可梦动画图鉴', '云岫'];

// 判断是否为日漫：通过假名和日文汉字特征识别
function isJapaneseAnime(anime) {
  const name = anime.name || '';

  // 0. 国漫关键词黑名单
  for (const pattern of CN_NAME_PATTERNS) {
    if (name.includes(pattern)) return false;
  }

  // 1. 含假名（平假名/片假名）→ 日漫
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(name)) return true;

  // 2. 含日文新字体汉字 → 日漫
  const jpChars = '\u4f1d\u6226\u8a08\u8a18\u8a8c\u8f29\u5909\u6c17\u5e30\u697d\u85ac\u56f3\u5fdc\u58ca\u7d99\u7d4c\u5e83\u6ca2\u7adc\u8ee2\u52f2\u61f2\u62e1\u4fa1\u99c6\u9a39\u8535\u60aa\u5869\u89a7\u91c8\u96d1\u6383\u5263\u770c\u71b1\u767a\u6e80\u4e21\u4e57\u6765\u4fa1\u6e08\u899a\u69d8';
  for (const ch of jpChars) {
    if (name.includes(ch)) return true;
  }

  // 3. 含简体中文专用字 → 国漫，排除
  const cnChars = '\u6218\u7eaa\u8bb0\u8ff9\u836f\u9976\u56fe\u4f20\u8f88\u53d8\u5f52\u4e50\u51fb\u7ee7\u7ecf\u5e94\u574f\u5e7f\u4ef7\u6269\u9f99\u6cfd\u8f6c\u8bf4\u8ba9\u8fc7\u7ed9\u65f6\u4e2a\u4eec\u8fd9\u8bdd\u5267\u573a\u73b0\u53d1\u95e8\u5173\u95ed\u5f00\u8bba\u8bc6\u8bbe\u8ba4\u4f24\u70e7\u51b2\u949f\u955c\u94c1\u94b1\u94f6\u94dc\u5bfb\u8e2a\u6eda\u6363\u575a\u5458\u542c\u4e60\u60ef\u6bd5\u4e1a\u519c\u5e93\u6d4f\u89c8\u5386\u5b9d\u6ca1';
  for (const ch of cnChars) {
    if (name.includes(ch)) return false;
  }

  // 4. 纯拉丁字符 → 非日漫，排除
  if (/^[a-zA-Z0-9\s\-:!?(),.&]+$/.test(name)) return false;

  // 5. 其余模糊情况默认保留
  return true;
}

// 缺失中文名的番剧翻译表（按 Bangumi subject ID）
const TITLE_CN_OVERRIDE = {
  498559: '安第斯电波',
  688204: '小优家！来自游八',
  708080: '恶搞之家：万圣特辑',
  505550: '暗黑机甲 动画版',
  709326: '基芙：惊叫作家',
  701779: '马真丘',
  709475: '软糖皮约 第二季',
  700127: '小小危城',
  704737: '森林家族 菲蕾的多彩日常',
  559080: '梦境之地',
  637206: '小白炭',
  694622: '鼠小弟的背心 第二季',
  701565: '奋斗族',
  646586: '软软弹弹 第四季',
  661278: '轻松图鉴',
  698032: '用鼠标操作现实，所以疯狂点击女孩子',
  708612: '和暗黑召唤师在一起了 动画剧场',
};

// ==================== 工具函数 ====================

function getTodayIndex() {
  const jsDay = new Date().getDay(); // 0=周日
  return jsDay === 0 ? 6 : jsDay - 1; // 转为 周一=0
}

// 获取番剧中文名：优先翻译表，其次 name_cn，最后 name
function getAnimeTitle(anime) {
  if (TITLE_CN_OVERRIDE[anime.id]) return TITLE_CN_OVERRIDE[anime.id];
  return anime.name_cn || anime.name || '未知标题';
}

// 获取封面图：本地 covers/ 优先，缺失时兜底远程图
function getCoverUrl(anime) {
  const localCover = `covers/${anime.id}.jpg`;
  const remoteCover = anime.images ? (anime.images.large || anime.images.common || anime.images.medium || '') : '';
  return remoteCover ? localCover : remoteCover;
}

// 根据开播日期计算当前更新到第几集（假设每周更新一集）
function getCurrentEpisode(airDate) {
  if (!airDate) return 0;
  const start = new Date(airDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today < start) return 0; // 还没开播

  const daysDiff = Math.floor((today - start) / 86400000);
  return Math.floor(daysDiff / 7) + 1;
}

// 计算下次更新信息
function getNextUpdateInfo(airWeekday) {
  if (!airWeekday) return '';
  // airWeekday: 1=周一 ... 7=周日
  const todayIdx = getTodayIndex(); // 0=周一 ... 6=周日
  const targetIdx = airWeekday - 1;

  let daysUntil = targetIdx - todayIdx;
  if (daysUntil < 0) daysUntil += 7;

  if (daysUntil === 0) return '今日更新';
  if (daysUntil === 1) return '明日更新';
  return `${daysUntil}天后更新`;
}

// 格式化开播日期
function formatAirDate(airDate) {
  if (!airDate) return '';
  const d = new Date(airDate + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// ==================== API 请求 ====================

async function fetchAnimeData() {
  const response = await fetch(BANGUMI_API, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; AnimeTracker/1.0)',
    },
  });

  if (!response.ok) throw new Error(`接口请求失败：${response.status}`);
  const json = await response.json();

  // Bangumi 返回 7 天的数据，按 weekday.id 排序（1=周一 ~ 7=周日）
  // 每项: { weekday: { cn, en, id }, items: [...] }
  return json;
}

// ==================== 数据处理 ====================

// Bangumi 返回的 weekday.id: 1=周一, 2=周二, ..., 7=周日
// 转为我们的索引: 0=周一, ..., 6=周日
function getGroupsFromApi(apiData) {
  const groups = [[], [], [], [], [], [], []];
  for (const dayData of apiData) {
    const idx = dayData.weekday.id - 1; // 1->0, ..., 7->6
    groups[idx] = dayData.items || [];
  }
  return groups;
}

// ==================== 渲染：周几标签栏 ====================

function renderWeekdayNav() {
  const nav = document.querySelector('#weekday-nav > div');
  nav.innerHTML = '';
  const todayIdx = getTodayIndex();

  WEEKDAYS.forEach((wd, i) => {
    const btn = document.createElement('button');
    btn.className = 'weekday-tab flex-1 min-w-[3rem] py-2.5 text-sm font-medium transition-all duration-200';
    btn.dataset.day = i;

    const isToday = i === todayIdx;
    btn.innerHTML = `
      <span class="block">${wd.cn}</span>
      <span class="block text-[10px] mt-0.5 day-count text-slate-500"></span>
      ${isToday ? '<span class="block text-[9px] mt-0.5 text-pink-400">今天</span>' : ''}
    `;

    btn.onclick = () => selectDay(i);
    nav.appendChild(btn);
  });
}

function updateWeekdayCounts(groups) {
  const tabs = document.querySelectorAll('.weekday-tab');
  tabs.forEach((tab, i) => {
    const countEl = tab.querySelector('.day-count');
    // 只统计日漫
    const jpList = groups[i].filter(isJapaneseAnime);
    const visibleList = filterVisible(groups[i]);
    const count = visibleList.length;
    countEl.textContent = count > 0 ? `${count}部` : '—';
    const isActive = i === selectedDay;
    tab.classList.toggle('active', isActive);

    if (isActive) {
      tab.style.color = WEEKDAYS[i].color;
      tab.style.borderBottomColor = WEEKDAYS[i].color;
      tab.style.borderBottomWidth = '2px';
      tab.style.borderBottomStyle = 'solid';
    } else {
      tab.style.color = '';
      tab.style.borderBottom = '';
    }
  });
}

// ==================== 渲染：番剧卡片 ====================

function renderAnimeCard(anime) {
  const title = getAnimeTitle(anime);
  const cover = getCoverUrl(anime);
  const detailUrl = getDetailUrl(anime);
  const hasCustomLink = !!getLinkOverrides()[anime.id];
  const score = anime.rating?.score || 0;
  const airDate = anime.air_date || '';
  const airWeekday = anime.air_weekday || 0;

  // 计算当前集数（支持手动覆盖）和下次更新
  const autoEp = getCurrentEpisode(airDate);
  const overrideEp = getEpisodeOverrides()[anime.id] || 0;
  const currentEp = overrideEp || autoEp;
  const isManual = overrideEp > 0;
  const nextUpdate = getNextUpdateInfo(airWeekday);
  const notStarted = currentEp === 0 && airDate;

  return `
    <div class="anime-card group relative rounded-xl overflow-hidden bg-white/5 border border-white/10 backdrop-blur-sm">
      <div class="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button class="w-7 h-7 rounded-full bg-black/60 hover:bg-yellow-500/80 backdrop-blur-sm text-xs flex items-center justify-center transition-all"
                onclick="toggleHide(${anime.id})" title="隐藏此番剧">
          🚫
        </button>
        <button class="w-7 h-7 rounded-full bg-black/60 hover:bg-red-600 backdrop-blur-sm text-xs flex items-center justify-center transition-all"
                onclick="deleteAnime(${anime.id})" title="删除此番剧">
          🗑
        </button>
        <button class="w-7 h-7 rounded-full bg-black/60 hover:bg-sky-500/80 backdrop-blur-sm text-xs flex items-center justify-center transition-all"
                data-link-edit="${anime.id}" onclick="editLink(${anime.id})" title="${hasCustomLink ? '修改自定义链接' : '设置自定义链接（留空恢复默认）'}">
          🔗
        </button>
      </div>
      <div class="cover-container aspect-[3/4] bg-slate-800">
        <a href="${detailUrl}" target="_blank" rel="noopener noreferrer" class="block w-full h-full" aria-label="${title}">
          ${cover
            ? `<img src="${cover}" alt="${title}" loading="lazy" class="w-full h-full object-cover" />`
            : `<div class="w-full h-full flex items-center justify-center text-slate-600 text-4xl">📺</div>`
          }
        </a>
        ${currentEp > 0 ? `
          <button type="button" title="点击修改集数（留空恢复自动）" data-ep-edit="${anime.id}"
                  class="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-xs font-semibold text-pink-300 hover:bg-pink-950/80 hover:ring-1 hover:ring-pink-500/60 transition-all"
                  onclick="editEpisode(${anime.id}, ${autoEp})">
            更新至第${currentEp}集${isManual ? ' ✏️' : ''}
          </button>` : ''}
      </div>
      <div class="p-3">
        <h3 class="font-semibold text-sm leading-tight mb-2 line-clamp-2">
          <a href="${detailUrl}" target="_blank" rel="noopener noreferrer" class="group-hover:text-pink-300 transition-colors">${title}${hasCustomLink ? ' <span class="text-amber-300" title="自定义链接">🔗</span>' : ''}</a>
        </h3>
        <div class="space-y-1">
          ${notStarted
            ? `<p class="text-xs text-blue-300">${formatAirDate(airDate)} 开播</p>`
            : `<p class="text-xs text-pink-300">${currentEp > 0 ? `更新至第${currentEp}集` : ''}</p>`
          }
          ${nextUpdate ? `
            <div class="flex items-center gap-1.5 text-xs">
              <span class="pulse-dot w-1.5 h-1.5 rounded-full bg-green-400"></span>
              <span class="text-slate-300">${nextUpdate}</span>
            </div>` : ''}
          ${airDate ? `<p class="text-xs text-slate-500">${formatAirDate(airDate)}开播</p>` : ''}
        </div>
        ${score > 0 ? `
          <div class="mt-2 text-xs text-yellow-400">★ ${score.toFixed(1)}</div>` : ''}
      </div>
    </div>
  `;
}

// ==================== 集数编辑 ====================

function editEpisode(id, autoEp) {
  const btn = document.querySelector(`[data-ep-edit="${id}"]`);
  if (!btn) return;

  const overrides = getEpisodeOverrides();
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.max = '9999';
  input.className = 'w-20 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-xs font-semibold text-pink-300 outline-none ring-1 ring-pink-500/60';
  input.value = overrides[id] != null ? overrides[id] : (autoEp || '');
  input.placeholder = autoEp > 0 ? `自动 ${autoEp}` : '自动';
  input.title = '输入集数，留空=恢复自动；回车保存 / Esc 取消';

  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    if (save) {
      const v = parseInt(input.value, 10);
      setEpisodeOverride(id, Number.isFinite(v) && v >= 0 && v <= 9999 ? v : 0);
    }
    if (cachedData) {
      updateWeekdayCounts(cachedData);
      renderDay(cachedData);
    }
  };

  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });

  btn.replaceWith(input);
  input.focus();
  input.select();
}

// ==================== 渲染：当天内容 ====================

function renderDay(groups) {
  const container = document.getElementById('day-container');
  const wd = WEEKDAYS[selectedDay];
  const allList = groups[selectedDay];
  const animeList = filterVisible(allList);
  const todayIdx = getTodayIndex();
  const isToday = selectedDay === todayIdx;

  // 响应式：电脑 5 列，平板 4 列，手机 2 列
  const gridCols = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3';

  container.innerHTML = `
    <div class="day-column">
      <div class="flex items-center gap-2 mb-4">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
             style="background: linear-gradient(135deg, ${wd.color}, ${wd.color}99)">
        </div>
        <div>
          <h2 class="font-bold text-base ${isToday ? 'text-pink-400' : ''}">
            ${wd.cn}
            ${isToday ? '<span class="text-xs ml-1 px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400 align-middle">今天</span>' : ''}
          </h2>
          <p class="text-xs text-slate-500">${animeList.length} 部更新</p>
        </div>
      </div>
      <div class="${gridCols}">
        ${animeList.length === 0
          ? `<div class="col-span-full text-center py-12 text-slate-600 text-sm">🍃 本日无更新</div>`
          : animeList.map(renderAnimeCard).join('')}
      </div>
    </div>
  `;
}

// ==================== 切换天 ====================

function selectDay(idx) {
  selectedDay = idx;
  if (cachedData) {
    const groups = cachedData;
    updateWeekdayCounts(groups);
    renderDay(groups);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ==================== 状态管理 ====================

function showLoading(show) {
  document.getElementById('loading').classList.toggle('hidden', !show);
}

function showError(msg) {
  document.getElementById('error-state').classList.remove('hidden');
  document.getElementById('error-msg').textContent = msg || '请稍后重试';
  document.getElementById('empty-state').classList.add('hidden');
}

function hideAllStates() {
  document.getElementById('error-state').classList.add('hidden');
  document.getElementById('empty-state').classList.add('hidden');
}

// ==================== 管理弹窗 ====================

function openManageModal() {
  const modal = document.getElementById('manage-modal');
  const list = document.getElementById('manage-list');
  const hidden = getHiddenIds();
  const deleted = getDeletedIds();

  // 收集所有番剧（仅日漫，未删除的）
  const allAnime = cachedData ? cachedData.flat().filter(isJapaneseAnime) : [];
  const visibleAnime = allAnime.filter(a => !deleted.has(a.id));

  let html = '';

  if (visibleAnime.length === 0) {
    html = '<p class="text-slate-500 text-center py-4 text-sm">暂无番剧</p>';
  } else {
    html = visibleAnime.map(anime => {
      const title = getAnimeTitle(anime);
      const cover = getCoverUrl(anime);
      const isHidden = hidden.has(anime.id);
      const weekday = anime.air_weekday ? WEEKDAYS[anime.air_weekday - 1].cn : '';
      return `
        <div class="flex items-center gap-3 p-2 rounded-lg ${isHidden ? 'bg-yellow-500/10 opacity-60' : 'bg-white/5'} transition-all">
          <img src="${cover}" alt="${title}" class="w-10 h-14 rounded object-cover flex-shrink-0" loading="lazy" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">${title}</p>
            <p class="text-xs text-slate-500">${weekday}更新</p>
          </div>
          <div class="flex gap-1">
            <button
              class="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${isHidden ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'}"
              onclick="toggleHide(${anime.id}); openManageModal();"
            >
              ${isHidden ? '👁 显示' : '🚫 隐藏'}
            </button>
            <button
              class="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all bg-red-500/20 text-red-400 hover:bg-red-500/30"
              onclick="deleteAnime(${anime.id}); openManageModal();"
            >
              🗑 删除
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  list.innerHTML = html;
  modal.classList.remove('hidden');
}

function closeManageModal() {
  document.getElementById('manage-modal').classList.add('hidden');
}

// ==================== 回收站弹窗 ====================

function openTrashModal() {
  const modal = document.getElementById('trash-modal');
  const list = document.getElementById('trash-list');
  const deleted = getDeletedIds();

  // 收集已删除的番剧（仅日漫）
  const allAnime = cachedData ? cachedData.flat().filter(isJapaneseAnime) : [];
  const deletedAnime = allAnime.filter(a => deleted.has(a.id));

  let html = '';

  if (deletedAnime.length === 0) {
    html = '<p class="text-slate-500 text-center py-8 text-sm">🗑 回收站为空</p>';
  } else {
    html = deletedAnime.map(anime => {
      const title = getAnimeTitle(anime);
      const cover = getCoverUrl(anime);
      const weekday = anime.air_weekday ? WEEKDAYS[anime.air_weekday - 1].cn : '';
      return `
        <div class="flex items-center gap-3 p-2 rounded-lg bg-red-500/5 opacity-50 transition-all">
          <img src="${cover}" alt="${title}" class="w-10 h-14 rounded object-cover flex-shrink-0 grayscale" loading="lazy" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">${title}</p>
            <p class="text-xs text-slate-500">${weekday}更新</p>
          </div>
          <button
            class="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all bg-green-500/20 text-green-400 hover:bg-green-500/30"
            onclick="restoreAnime(${anime.id})"
          >
            ♻ 恢复
          </button>
        </div>
      `;
    }).join('');
  }

  list.innerHTML = html;
  modal.classList.remove('hidden');
}

function closeTrashModal() {
  document.getElementById('trash-modal').classList.add('hidden');
}

// ==================== 主流程 ====================

async function loadData() {
  showLoading(true);
  hideAllStates();

  try {
    const apiData = await fetchAnimeData();
    const groups = getGroupsFromApi(apiData);
    cachedData = groups;

    updateWeekdayCounts(groups);
    renderDay(groups);

    const total = groups.reduce((sum, g) => sum + g.length, 0);
    if (total === 0) {
      document.getElementById('empty-state').classList.remove('hidden');
    }
  } catch (err) {
    console.error('加载失败：', err);
    showError(err.message);
  } finally {
    showLoading(false);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  selectedDay = getTodayIndex(); // 默认选中今天
  renderWeekdayNav();
  loadData();

  document.getElementById('refresh-btn').addEventListener('click', loadData);
  document.getElementById('manage-btn').addEventListener('click', openManageModal);
  document.getElementById('manage-close').addEventListener('click', closeManageModal);
  document.getElementById('manage-modal').addEventListener('click', (e) => {
    if (e.target.id === 'manage-modal') closeManageModal();
  });

  document.getElementById('trash-btn').addEventListener('click', openTrashModal);
  document.getElementById('trash-close').addEventListener('click', closeTrashModal);
  document.getElementById('trash-modal').addEventListener('click', (e) => {
    if (e.target.id === 'trash-modal') closeTrashModal();
  });
});
