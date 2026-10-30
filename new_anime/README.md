# 日漫新番追踪

一个纯前端的每周新番一览页面。数据实时来自 [Bangumi 番组计划](https://bgm.tv) 官方 API，自动过滤国漫，按周一至周日展示本周更新的日漫，支持隐藏/删除/改集数/自定义链接，并可通过共享配置文件在所有访客之间同步这些改动。

- **技术栈**：原生 HTML + JavaScript + Tailwind CSS（CDN），零构建、零后端、零 npm 依赖
- **数据来源**：[Bangumi Calendar API](https://api.bgm.tv/calendar)（含中文名、评分、开播信息）
- **部署方式**：任意静态托管（当前使用 GitHub Pages，推送仓库即完成部署）

## 功能特性

### 浏览
- 按周一～周日标签切换，显示当天更新的新番；默认选中**今天**并高亮标记
- 番剧卡片展示：封面、中文标题、当前集数角标；点击卡片跳转 Bangumi 详情页
- 响应式网格：手机 2 列 / 小平板 3 列 / 大平板 4 列 / 桌面 5 列
- **日漫自动过滤**：根据标题中的假名、日文新字体汉字、简体中文专用字及国漫关键词黑名单自动排除国漫与非动画条目（规则见 [app.js](app.js) 中 `isJapaneseAnime`）
- 缺失中文名的条目内置手动翻译表（`TITLE_CN_OVERRIDE`）

### 管理（仅对本机浏览器生效）
- **隐藏**：从主列表移除，可在「👁 管理」弹窗中随时恢复显示
- **删除**：从主列表移除，进入「🗑 回收站」，可一键恢复
- **编辑集数**：点击卡片上的集数角标即可就地修改（回车保存 / Esc 取消 / 失焦自动保存，留空恢复自动推算）
- **自定义链接**：将某部番的跳转地址改为任意 `http(s)` 链接（如资源站、播放页），留空恢复 Bangumi 默认链接
- **🔄 刷新**：重新拉取共享配置与 Bangumi 数据

### 多人同步（发布配置）
所有管理操作默认只存在你自己的浏览器里（localStorage）。点击 **📤 发布配置** 可将「本机改动 + 现有共享配置」的合并结果导出为 JSON，粘贴覆盖仓库中的 `excluded.json` 并推送后，**所有访客**都会看到更新。详见[共享配置同步机制](#共享配置同步机制)。

### 封面加载策略
- 优先加载本地缓存封面 `covers/{Bangumi ID}.jpg`（快速、不依赖外部图床）
- 本地缺失或加载失败时，自动回退到 Bangumi 远程原图（`onerror` 兜底），页面永不出现裂图

### 数据加载策略（应对 Bangumi 访问受限）
- 优先渲染仓库内置的数据快照 `data/calendar.json`（同源静态文件，国内网络无代理也能立即打开）
- 快照包含每部番的**剧集播出表**（来自 Bangumi v0 剧集接口），页面按「已播出日期 ≤ 今天」的最后一集精确计算当前集数，能正确反映停播、特番、延期；缺少剧集数据的条目回退为开播日期估算
- 快照渲染完成后，后台再尝试实时拉取 Bangumi API（超时 8 秒）：成功则静默替换为最新数据，失败则继续使用快照
- 使用快照时页脚会显示「数据更新于 YYYY-MM-DD」，便于判断数据新鲜度
- 快照由维护者定期用 `node scripts/fetch-data.js` 更新（见维护者章节）

## 快速开始

### 在线访问
部署到 GitHub Pages 后，直接访问仓库对应的 Pages 地址即可（例如 `https://<用户名>.github.io/<仓库名>/`）。

### 本地运行
推荐用本地 HTTP 服务器。`file://` 直接双击打开页面的番剧能显示，但浏览器会因 CORS 拒绝读取 `excluded.json` 和 `data/calendar.json`，共享配置与数据快照都会失效。

**Windows：双击 `start.bat`** 即可（自动启动服务并打开浏览器）

- 优先用 Node.js（`scripts/serve.js`，自动开浏览器，端口被占用时自动顺延 8001、8002…）
- 没装 Node.js 时退回 Python（`py -m http.server`）
- 也可命令行传参：`start.bat 8080` 指定端口、`start.bat --no-open` 不自动开浏览器

**手动启动**（任意系统）：

```bash
# 任选其一，在项目根目录执行
node scripts/serve.js              # 零依赖本地服务器，等价于 start.bat 的 Node 分支
python -m http.server 8000
```

然后访问 `http://localhost:8000`。无需安装任何依赖。

## 使用说明

### 普通访客

| 操作 | 入口 | 说明 |
|---|---|---|
| 查看当天新番 | 顶部星期标签 | 默认选中今天 |
| 隐藏某部番 | 「👁 管理」→ 🚫 隐藏 | 仅自己可见地移除；黄色条目即为已隐藏 |
| 删除某部番 | 卡片右下角 🗑 | 进入回收站，可恢复 |
| 恢复已删除 | 「🗑 回收站」→ ♻ 恢复 | 仅限未发布的删除项 |
| 修改集数 | 点击卡片集数角标 | 0 或留空 = 恢复自动推算 |
| 自定义跳转链接 | 「👁 管理」中对应条目 | 需以 `http://` 或 `https://` 开头 |

### 仓库维护者

除上述访客操作外，还需要：

**1. 同步改动给所有人**

1. 在页面上完成隐藏/删除/改集数/改链接
2. 点击「📤 发布配置」→「📋 复制到剪贴板」
3. 用复制的内容**整体覆盖**仓库中的 [`excluded.json`](excluded.json)
4. 提交并推送：

```bash
git add excluded.json
git commit -m "更新共享配置"
git push
```

推送后所有访客刷新页面即生效（页面每次加载都会强制拉取最新 `excluded.json`，不受浏览器缓存影响）。

**2. 批量补齐封面**

新番开播后，新条目在本地 `covers/` 中没有图，页面会临时回退到远程图。想让所有人都走本地缓存：

```bash
node scripts/fetch-covers.js
# 输出示例：拉取 Bangumi 番组日历 ... → have 104 missing 5 → downloaded 712926 → done: ok 5 failed 0

git add covers/
git commit -m "补充本周新番封面"
git push
```

- 只下载**缺失**的封面，已有的自动跳过；每个请求间隔 350ms，不会对 Bangumi 造成压力
- 仅覆盖 Bangumi 当前周日历中的番剧（即页面正在展示的当季新番）
- 若终端访问 `api.bgm.tv` 需要代理，先设置环境变量再执行（PowerShell，端口按你的代理软件实际值改）：
  ```powershell
  $env:HTTPS_PROXY = "http://127.0.0.1:7897"
  node scripts/fetch-covers.js
  ```
- 执行失败时用诊断模式分步定位断点（环境变量 → 代理端口 → CONNECT 隧道 → API/封面下载）：
  ```powershell
  node scripts/fetch-covers.js doctor
  ```

**3. 更新数据快照**

`data/calendar.json` 是给「访问不了 Bangumi 的访客」（如国内无代理网络）兜底的数据，同时缓存每部番的剧集播出表（用于精确计算当前集数）。新番列表变动时（开新季度、番剧增删）更新：

```bash
node scripts/fetch-data.js
# 输出示例：episodes: ok 113 failed 0 → 已写入 data/calendar.json（7 天 / 113 部 / 107.8 KB）

git add data/calendar.json
git commit -m "更新数据快照"
git push
```

- 脚本会逐部请求剧集表（限速 500ms/请求，全量约 1-2 分钟），对 Bangumi 友好
- 终端连不上 Bangumi 时同样先设代理环境变量（同上方封面脚本）
- 只保存页面用到的字段（约 100 KB）；脚本校验到 0 部数据时会拒绝覆盖旧快照
- 个别剧集拉取失败不影响写入，页面会自动回退为日期估算，重跑可补齐

**4. 维护翻译表与过滤规则**（可选）

- 某条目缺少中文名或翻译不满意 → 修改 `app.js` 中的 `TITLE_CN_OVERRIDE`
- 有国漫漏网 → 在 `app.js` 的 `CN_NAME_PATTERNS` 黑名单中追加关键词

## 共享配置同步机制

所有访客打开页面时都会读取仓库根目录的 [`excluded.json`](excluded.json)：

```json
{
  "deleted": [712926, 713001],
  "hidden": [688797],
  "episodeOverride": { "712926": 5 },
  "linkOverride": { "712926": "https://example.com/watch" }
}
```

| 字段 | 类型 | 含义 | 合并规则 |
|---|---|---|---|
| `deleted` | `number[]` | 已删除番剧的 Bangumi ID | 共享 ∪ 本机 |
| `hidden` | `number[]` | 已隐藏番剧的 Bangumi ID | 共享 ∪ 本机 |
| `episodeOverride` | `{ [id]: number }` | 手动指定的集数 | 共享打底，本机覆盖优先 |
| `linkOverride` | `{ [id]: string }` | 自定义跳转链接 | 共享打底，本机覆盖优先 |

要点：

- **本机操作永远优先于自己**——即使不发布，你的隐藏/删除/改集数也立即生效并存于 localStorage
- **发布 = 合并导出**——发布弹窗里的 JSON 已包含共享配置与本机改动的并集，直接覆盖文件即可，不会丢掉别人的改动
- **已发布的项显示「📌 需改文件」**——UI 不提供对已发布项的撤销按钮（避免误操作覆盖他人同步的配置），需手动编辑 `excluded.json` 并推送
- localStorage 键名（供排查用）：`anime_hidden_ids`、`anime_deleted_ids`、`anime_episode_override`、`anime_link_override`

## 目录结构

```
new_anime/
├── start.bat               # Windows 双击启动本地预览（Node 优先，Python 兜底）
├── index.html              # 页面结构（顶栏、星期标签、三个弹窗）
├── app.js                  # 全部业务逻辑
├── style.css               # 自定义样式
├── excluded.json           # 共享配置（所有访客读取，维护者推送更新）
├── data/
│   └── calendar.json       # 数据快照（Bangumi 不可达时兜底，由 fetch-data.js 生成）
├── covers/                 # 本地图库，文件名 = {Bangumi ID}.jpg
│   ├── 712926.jpg
│   └── ...
└── scripts/
    ├── fetch-covers.js     # 批量下载缺失封面（Node.js，无第三方依赖）
    ├── fetch-data.js       # 生成数据快照 data/calendar.json（Node.js，无第三方依赖）
    └── serve.js            # 本地静态服务器（Node.js，无第三方依赖，自动开浏览器）
```

## 数据与隐私

- 所有个人设置仅存于浏览器 localStorage，不上传任何服务器
- 共享配置 `excluded.json` 随仓库公开，**仅包含 Bangumi 数字 ID 与链接**，不含任何个人信息
- 页面无统计脚本、无 Cookie；唯一外部请求为 Bangumi API、Tailwind CDN 与 Bangumi 图床

## 常见问题

**Q：我删了一部番，为什么朋友还能看到？**
删除默认只写入你的 localStorage。需要点「📤 发布配置」→ 复制 → 覆盖 `excluded.json` → `git push`，改动才会同步给所有人。

**Q：弹窗里某个条目显示「📌 需改文件」，点不了按钮？**
该项已存在于共享配置中，本机 UI 故意不提供撤销入口。手动编辑 `excluded.json`，从对应数组中删掉该 ID，推送即可恢复显示。

**Q：新番封面显示不出来 / 想让封面加载更快？**
页面加载失败会自动回退远程图，一般不会裂图。若想固化为本地缓存，运行 `node scripts/fetch-covers.js` 后提交 `covers/`。

**Q：`node scripts/fetch-covers.js` 执行超时/失败？**
多为终端连不上 Bangumi（API 为 https、封面图为 http，两者都要过代理）。先设置代理环境变量再跑（端口按代理软件实际值，Clash Verge 混合端口默认 7897）：
```powershell
$env:HTTPS_PROXY = "http://127.0.0.1:7897"
node scripts/fetch-covers.js
```
仍失败则运行 `node scripts/fetch-covers.js doctor` 分步排查，它会逐步检查环境变量、代理端口连通性、CONNECT 隧道、API 请求，输出首个断点及处理建议。注意新开的终端窗口不会继承已设置的环境变量，需重新设置。

**Q：本地双击 `index.html` 打开，控制台报 `excluded.json` / `data/calendar.json` 加载失败，或页脚没有数据日期？**
`file://` 协议下浏览器禁止 fetch 本地 JSON，属正常现象——番剧能显示，但共享配置和数据快照都读不到。用 HTTP 方式打开即可：Windows 双击 `start.bat`，或执行 `node scripts/serve.js` / `python -m http.server 8000` 后访问 `http://localhost:8000`。

**Q：`start.bat` 双击没反应 / 中文乱码？**
脚本会优先用 Node.js，其次 Python；两者都没装时会提示安装地址。若窗口一闪而过，说明服务启动失败，请在该目录打开命令行执行 `node scripts/serve.js` 查看具体错误。`start.bat` 以 GBK 编码保存（cmd 原生解析），用编辑器修改后请保持 ANSI/GBK 编码，存成 UTF-8 会导致批处理语法错。

**Q：集数显示不对？**
现在优先依据 Bangumi 剧集表的真实播出日期计算（能反映停播、特番、延期），只有缺少剧集数据的条目才回退为「开播日期按每周一集」的粗略估算。仍不准可点击集数角标手动指定（0 或留空恢复自动）。注意角标带 ✏️ 表示之前手动改过、手动值优先于自动值。

**Q：数据多久更新一次？**
页面打开时先用仓库内置快照 `data/calendar.json` 秒开，随后后台尝试实时拉取 Bangumi API，成功会静默替换成最新数据；共享配置每次打开强制拉取最新版。快照由维护者在新番列表变动时更新（见「更新数据快照」）。

**Q：国内网络打开页面，番剧列表出不来？**
之前数据完全依赖实时接口，Bangumi 不可达时会显示加载失败。现在页面优先渲染仓库内置的数据快照 `data/calendar.json`，只要该文件存在并已推送，国内无代理也能正常打开（页脚会标注「数据更新于 YYYY-MM-DD」）。若仍失败，说明快照文件缺失，或你的网络连 GitHub Pages 本身都不通。

## 已知限制

- 静态页面无账号体系，同步依赖「发布 → 推送」的人工流程，多人同时发布时以后推送者为准（发布弹窗内是合并结果，正常操作不会覆盖丢失他人改动）
- 封面批量下载仅覆盖当季（Bangumi 当前周日历），历史季度番剧不补图（不影响显示，走远程回退）
- 日漫过滤基于标题特征启发式判断，极少数无假名/汉字特征的条目可能误判（默认保留宁滥勿缺）

## 致谢

数据与番剧信息均来自 [Bangumi 番组计划](https://bgm.tv)，感谢社区维护的开放 API。
