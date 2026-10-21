# 日漫新番追踪

一个纯前端的每周新番一览页面。数据实时来自 [Bangumi 番组计划](https://bgm.tv) 官方 API，自动过滤国漫，按周一至周日展示本周更新的日漫，支持隐藏/删除/改集数/自定义链接，并可通过共享配置文件在所有访客之间同步这些改动。

- **技术栈**：原生 HTML + JavaScript + Tailwind CSS（CDN），零构建、零后端、零 npm 依赖
- **数据来源**：[Bangumi Calendar API](https://api.bgm.tv/calendar)（含中文名、评分、开播信息）
- **部署方式**：任意静态托管（当前使用 GitHub Pages，推送仓库即完成部署）

## 功能特性

### 浏览
- 按周一～周日标签切换，显示当天更新的新番；默认选中**今天**并高亮标记
- 番剧卡片展示：封面、中文标题、当前集数角标、评分；点击卡片跳转 Bangumi 详情页
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

## 快速开始

### 在线访问
部署到 GitHub Pages 后，直接访问仓库对应的 Pages 地址即可（例如 `https://<用户名>.github.io/<仓库名>/`）。

### 本地运行
推荐用本地 HTTP 服务器（`file://` 直接双击打开也能浏览番剧，但共享配置 `excluded.json` 会因浏览器 CORS 限制加载失败）：

```bash
# 任选其一，在项目根目录执行
python -m http.server 8000
# 或
npx serve .
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

**3. 维护翻译表与过滤规则**（可选）

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
├── index.html              # 页面结构（顶栏、星期标签、三个弹窗）
├── app.js                  # 全部业务逻辑
├── style.css               # 自定义样式
├── excluded.json           # 共享配置（所有访客读取，维护者推送更新）
├── covers/                 # 本地图库，文件名 = {Bangumi ID}.jpg
│   ├── 712926.jpg
│   └── ...
└── scripts/
    └── fetch-covers.js     # 批量下载缺失封面（Node.js，无第三方依赖）
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

**Q：本地打开 `index.html` 时控制台报 `excluded.json` 加载失败？**
`file://` 协议下浏览器禁止 fetch 本地 JSON，属正常现象，不影响番剧浏览。用本地 HTTP 服务器运行即可消除。

**Q：集数显示不对？**
自动推算基于开播日期按每周一集估算。点击集数角标手动指定即可，0 或留空恢复自动。

**Q：数据多久更新一次？**
番剧数据每次打开页面/点刷新时实时从 Bangumi API 获取；共享配置每次打开强制拉取最新版。Bangumi 日历随新季度更新，无需本项目做任何操作。

## 已知限制

- 静态页面无账号体系，同步依赖「发布 → 推送」的人工流程，多人同时发布时以后推送者为准（发布弹窗内是合并结果，正常操作不会覆盖丢失他人改动）
- 封面批量下载仅覆盖当季（Bangumi 当前周日历），历史季度番剧不补图（不影响显示，走远程回退）
- 日漫过滤基于标题特征启发式判断，极少数无假名/汉字特征的条目可能误判（默认保留宁滥勿缺）

## 致谢

数据与番剧信息均来自 [Bangumi 番组计划](https://bgm.tv)，感谢社区维护的开放 API。
