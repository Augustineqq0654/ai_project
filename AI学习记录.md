# AI学习记录

## 项目开发

做项目，是检验学习成果的唯一标准。

**要求：**

1. 知道自己想做什么
2. 能够清楚地表达需求
3. 会用AI工具来实现

### 项目开发流程

主要包括5个步骤：

1. 需求研究
2. 产品需求文档
3. 技术设计文档
4. AI代理指令
5. 实现和迭代

#### 1. 需求研究

- 明确你的目标（做什么？为什么？）
- 调研类似产品（解决什么问题？有哪些核心功能）
- 记录你的发现（RESEARCH.md）

```markdown
# 记账应用需求研究

## 目标
做一个简单易用的个人记账应用，帮助自己养成记账习惯。

## 调研发现
- 市面上的记账应用功能都太复杂了
- 我只需要快速记录收入和支出
- 最好能看到每月的统计数据

## 核心需求
1. 快速添加收支记录
2. 按日期查看记录
3. 查看月度统计
4. 数据本地存储
```

#### 2. 产品需求文档PRD

一份完整的PRD通常包含：

- 产品概述（简单介绍这个产品是什么）
- 目标用户（谁会用这个产品）
- 核心功能（列出所有要做的功能）
- 功能优先级（哪些是必须要做的，哪些是后续可以添加的）
- 界面设计（界面是什么样的）
- 技术栈建议
- 代码风格和架构模式
- 限制条件和边界场景

例子：

```markdown
# 记账应用 PRD

## 产品概述
一个简单的个人记账应用，帮助用户快速记录日常收支。

## 目标用户
需要记账但不想用复杂应用的个人用户。

## 核心功能

### 必须做（MVP）
1. 添加收支记录
   - 输入金额
   - 选择类型（收入/支出）
   - 选择分类（餐饮、交通、工资等）
   - 添加备注（可选）
   - 选择日期

2. 查看记录列表
   - 按日期倒序显示
   - 显示金额、类型、分类、备注
   - 可以删除记录

3. 月度统计
   - 显示当月总收入
   - 显示当月总支出
   - 显示当月结余

### 后续可以做
- 数据导出
- 图表展示
- 预算设置
- 多账户管理

## 界面设计
- 首页：显示记录列表和添加按钮
- 添加页面：表单输入
- 统计页面：展示月度数据

```

#### 3. 技术设计文档

创建一个TECH_DESIGN.md文件，包含：

- 技术栈选择（前端用什么，后端用什么，数据库用什么）
- 项目结构（代码怎么组织）
- 数据模型（需要存储哪些数据）
- 关键技术点（有哪些技术难点需要注意）

```markdown
# 记账应用技术设计

## 技术栈
- 前端：React + TypeScript + Vite
- 样式：Tailwind CSS
- 数据存储：LocalStorage
- 部署：Vercel

## 项目结构

src/
  components/     # 组件
  pages/          # 页面
  hooks/          # 自定义 Hooks
  utils/          # 工具函数
  types/          # 类型定义

## 数据模型

### Transaction（交易记录）
- id: string
- amount: number
- type: 'income' | 'expense'
- category: string
- note: string
- date: string

## 关键技术点
1. 使用 LocalStorage 存储数据
2. 使用 React Hooks 管理状态
3. 使用日期库处理日期（date-fns）

```

如果不熟悉技术选型，可以问AI：**我要做一个记账应用，应该用什么技术栈？**

#### 4. AI代理指令（AGENTS.md）

创建一个专门给AI看的指令文件，告诉AI在这个项目中应该遵循什么规则

推荐使用`AGENTS.md`这个名称，一般包含：

- 项目概述
- 开发规范
- 测试要求
- 代码风格
- 注意事项

```markdown
# 记账应用 AI 开发指令

## 项目概述
这是一个简单的个人记账应用，使用 React + TypeScript 开发。

## 开发规范
- 使用 TypeScript，确保类型安全
- 组件使用函数式组件 + Hooks
- 使用 Tailwind CSS 编写样式
- 所有数据存储在 LocalStorage

## 代码风格
- 使用 ESLint 和 Prettier
- 组件名使用 PascalCase
- 函数名使用 camelCase
- 常量使用 UPPER_SNAKE_CASE

## 测试要求
- 每个功能完成后手动测试
- 确保数据正确存储和读取
- 测试各种边界情况

## 注意事项
- 保持代码简洁，避免过度设计
- 优先实现核心功能
- 确保移动端适配

```

#### 5. 实现和迭代

3步走策略：

**1. 生成基础框架，确保项目能够正常运行**

```markdown
请根据 PRD.md、TECH_DESIGN.md 和 AGENTS.md 的要求，
初始化项目并创建基本的项目结构，包括：
1. 安装必要的依赖
2. 创建目录结构
3. 配置开发环境
4. 创建基础的路由和页面框架
确保项目能够正常启动。

```

**2. 逐步实现核心功能**

先跑通核心业务流程，实现核心功能，把项目拆分成多个小功能，一个一个来实现。

比如记账应用可以这样拆分：

- 实现数据模型和存储
- 实现添加记录功能
- 实现记录列表显示
- 实现删除功能
- 实现月度统计

```markdown
我要实现添加记录功能，请根据 PRD.md 和 TECH_DESIGN.md 中的要求，
创建一个 AddTransaction 组件，包含表单输入和提交功能。
```

**3. 优化实现细节**

保证在不影响功能的前提下，优化性能、改进用户体验、美化界面等

#### 避免AI失控的关键技巧

- 项目模块化——把一个大项目分割成多个小模块
- 限定修改范围
- 抽象和复用——把功能进行包装，需要时直接调用
- 版本控制——git
- 人工控制——指定上下文，更换prompt，清空历史对话，手动修改代码
- 多元AI协作





## MCP相关

**opencode 管理MCP服务器命令**

```bash 
# 添加 MCP 服务器（交互式）
opencode mcp add

# 列出所有已配置的 MCP 服务器
opencode mcp list

# 启用/禁用某个 MCP 服务器
opencode mcp enable <server-name>
opencode mcp disable <server-name>

# 触发 OAuth 认证（用于远程服务器）
opencode mcp auth <server-name>

# 查看认证状态和调试信息
opencode mcp debug <server-name>
```

**手动配置**

配置文件位置

opencode 支持两种级别的配置：

| 类型         | 路径                               | 说明                         |
| :----------- | :--------------------------------- | :--------------------------- |
| **全局配置** | `~/.config/opencode/opencode.json` | 对所有项目生效               |
| **项目配置** | `./opencode.json`                  | 仅在当前项目生效，优先级更高 |

**配置文件结构**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "服务器名称": {
      "type": "local",
      "enabled": true,
      "command": ["npx", "-y", "包名"],
      "environment": {
        "API_KEY": "your-key-here"
      }
    }
  }
}
```

**配置示例 - Firecrawl MCP：**

```json
{
  "mcp": {
    "firecrawl": {
      "type": "local",
      "enabled": true,
      "command": ["npx", "-y", "firecrawl-mcp"],
      "environment": {
        "FIRECRAWL_API_KEY": "你的API密钥"
      }
    }
  }
}
```





## Skills相关

#### 1. 安装技能

```bash
# 基本安装命令
npx skills add <owner/repo> -y

# 示例：安装 superpowers 完整开发框架
npx skills add obra/superpowers -y

# 安装特定技能（如果仓库包含多个技能）
npx skills add vercel-labs/agent-skills --skill frontend-design -y
```

#### 2. 指定安装范围

```bash
# 全局安装（对所有项目生效）
npx skills add obra/superpowers -g -y

# 只安装到 OpenCode（默认会自动检测已安装的 Agent）
npx skills add obra/superpowers -a opencode -y

# 一次性安装多个
npx skills add vercel-labs/agent-skills -a opencode -a cursor -y
```

#### 3. 管理已安装的技能

```bash
# 查看已安装的技能
npx skills list

# 检查更新
npx skills check

# 更新所有技能
npx skills update

# 删除技能
npx skills remove <skill-name>
```

