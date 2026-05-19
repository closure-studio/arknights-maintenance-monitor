# 明日方舟维护公告监控设计

## 背景

本项目是一个 serverless 监控任务。它通过 GitHub Actions 每小时抓取明日方舟官网新闻页 `https://ak.hypergryph.com/news`，识别新的停机维护类公告，并通过 QQBot API 发送通知。

项目第一版不使用浏览器自动化，不依赖 axios。运行环境使用 Node.js 22 和 TypeScript strict。状态使用仓库内的 `processed.json` 保存，避免重复通知。

## 推荐方案

采用 Node.js 内置 `fetch` 静态抓取 HTML，使用 `cheerio` 解析列表页和详情页。维护公告判断优先使用规则，只有规则无法确定时才调用 NVIDIA API。NVIDIA API 通过 `openai` npm package 的 `chat.completions` 兼容接口调用。

不采用 `jsdom`。本项目不需要执行页面脚本，也不需要模拟浏览器 DOM 行为；`cheerio` 更轻量，足以完成静态 HTML 的链接、标题和正文提取。后续若官网 HTML 结构变化，核心维护点仍是选择器和正文提取策略，`jsdom` 并不能消除这类维护成本。

## 项目结构

```text
.
├── .env.example
├── .github/workflows/monitor.yml
├── .gitignore
├── README.md
├── package.json
├── processed.json
├── tsconfig.json
└── src
    ├── index.ts
    ├── config.ts
    ├── http.ts
    ├── logger.ts
    ├── news.ts
    ├── state.ts
    ├── time.ts
    ├── types.ts
    ├── classifier
    │   ├── ai.ts
    │   └── rules.ts
    └── notifier
        └── qqbot.ts
```

各模块职责单一：

- `index.ts` 只负责整体编排。
- `config.ts` 读取环境变量并提供安全配置对象。
- `http.ts` 统一 `fetch`、15 秒超时、User-Agent 和网络错误处理。
- `news.ts` 抓取新闻列表和详情页，使用 `cheerio` 解析 HTML。
- `classifier/rules.ts` 实现确定性规则和维护时间提取。
- `classifier/ai.ts` 处理 NVIDIA AI 兜底分类。
- `notifier/qqbot.ts` 校验 QQBot 配置并发送通知。
- `state.ts` 读取、初始化和写入 `processed.json`。
- `time.ts` 生成北京时间字符串。
- `logger.ts` 提供基础日志，避免打印完整 secret。
- `types.ts` 保存跨模块共享类型。

## 数据流

1. 启动时加载本地 `.env`，GitHub Actions 中使用 Secrets 和 Variables。
2. 读取 `processed.json`；如果不存在，本地运行可自动创建初始结构。
3. 抓取 `https://ak.hypergryph.com/news`。
4. 从列表 HTML 中提取 `ak.hypergryph.com` 域名下的 `/news/{数字}` 链接。
5. 去重后默认只检查最新 10 条。
6. 对已存在于 `processed.processed` 的 `news_id` 直接跳过。
7. 对新公告抓取详情页，解析标题和正文文本。
8. 先执行规则判断：
   - 强匹配命中则确定为维护公告。
   - 普通公告排除命中且无强匹配则确定不是维护公告。
   - 无法确定时进入 AI 兜底。
9. 只有维护公告才尝试 QQBot 通知。
10. 每处理一条新公告后，在内存状态中记录处理结果。
11. 若本次没有任何新公告，不写入 `processed.json`。
12. 若有新公告，更新 `last_check` 和 `processed` 后写入 `processed.json`。

## 规则分类

强匹配条件：

- 标题包含 `停机维护`。
- 标题包含 `版本更新停机维护`。
- 正文同时包含 `维护时间` 和 `无法登录`。
- 正文同时包含 `停机维护` 和 `维护期间`。

普通公告排除词：

- `活动公告`
- `寻访公告`
- `时装`
- `组合包`
- `礼包`
- `通讯`
- `限时活动`

规则结果分三类：

- `maintenance`：确定是维护公告。
- `not_maintenance`：确定不是维护公告。
- `uncertain`：需要调用 AI。

维护时间提取使用正则尽量覆盖以下形式：

- `2026年03月10日06:00 ~ 12:00`
- `03月10日06:00 ~ 12:00`
- `3月10日 06:00 - 12:00`
- `维护时间：xxxx`

提取不到时不影响通知，通知中写 `未提取，请查看原文`。

## AI 兜底

AI 只在规则结果为 `uncertain` 时调用。调用方式使用 `openai` npm package：

- `NVIDIA_API_KEY` 从环境变量读取。
- `NVIDIA_BASE_URL` 从环境变量读取，默认 `https://integrate.api.nvidia.com/v1`。
- `NVIDIA_MODEL` 从环境变量读取，默认 `deepseek-ai/deepseek-v4-pro`。
- 使用 `chat.completions.create`。
- 不使用 Responses API。
- 不读取 `OPENAI_API_KEY` 或 `OPENAI_MODEL`。
- `stream: false`。
- `temperature: 0`。
- `max_tokens` 使用 1024 到 2048 范围。

Prompt 要求模型只返回 JSON：

```json
{
  "is_maintenance": true,
  "confidence": 0.95,
  "maintenance_start": "2026-03-10 06:00",
  "maintenance_end": "2026-03-10 12:00",
  "reason": "标题和正文均指向停机维护",
  "summary": "服务器将在指定时间停机维护。"
}
```

如果缺少 `NVIDIA_API_KEY`，不报错，不调用 AI，将不确定公告按非维护处理，reason 写 `AI skipped because NVIDIA_API_KEY is not set`。如果 NVIDIA API 调用失败或返回无法解析，也按非维护处理并记录错误原因，不打印 API key。

## QQBot 通知

通知接口：

```text
POST {QQBOT_HOST}/api/send_msg_auto
Content-Type: application/json
```

请求体：

```json
{
  "token": "your-qqbot-token",
  "uid": 123456789,
  "msg": "消息内容"
}
```

`QQBOT_HOST`、`QQBOT_TOKEN`、`QQBOT_UID` 必须全部从环境变量读取。如果任一缺失，打印 warning，不发送通知，不让脚本失败，状态记录 `notified=false` 和缺失项。若 `QQBOT_UID` 不能转换为数字，也不发送通知。

QQBot 请求超时 15 秒。非 2xx 响应记录 status 和响应正文前 300 字，不打印 token。发送成功时记录 `notified=true` 和 `notify_channel="qqbot"`。

通知格式：

```text
【明日方舟停机维护提醒】

标题：
{title}

维护时间：
{maintenance_start} ~ {maintenance_end}

摘要：
{summary}

原因：
{reason}

链接：
{url}
```

## 状态文件

仓库提供初始 `processed.json`：

```json
{
  "version": 1,
  "last_check": null,
  "processed": {}
}
```

`news_id` 从 URL 的 `/news/{数字}` 提取。若 `processed.processed` 中已存在该 ID，则跳过，避免重复通知。

每条记录包含：

- `url`
- `title`
- `first_seen_at`
- `last_seen_at`
- `is_maintenance`
- `notified`
- `notify_channel`
- `reason`
- `summary`
- `notify_error`

如果单条公告抓取失败，也记录失败摘要，避免同一坏数据每小时重复导致噪声。主列表页完全抓取失败时脚本退出 1。

## 时间

所有写入 `processed.json` 的时间使用北京时间 `Asia/Shanghai` 语义，格式为带 `+08:00` 偏移的 ISO-like 字符串，例如：

```text
2026-05-19T11:30:00+08:00
```

这样比 UTC `Z` 更符合使用者阅读习惯，也避免 README 和状态文件里的时间语义不一致。

## GitHub Actions

Workflow 文件为 `.github/workflows/monitor.yml`：

- `schedule` 使用 `17 * * * *`，即 UTC 每小时第 17 分钟。
- 支持 `workflow_dispatch` 手动触发。
- 运行环境 `ubuntu-latest`。
- Node.js 版本 22。
- 步骤包含安装依赖、构建 TypeScript、运行监控脚本。
- `permissions: contents: write`，用于提交 `processed.json` 变化。
- 使用 `concurrency` 避免并发运行。
- 若 `processed.json` 有变化，自动 commit 并 push。
- 若没有变化，不 commit。

GitHub Secrets：

- `QQBOT_HOST`
- `QQBOT_TOKEN`
- `QQBOT_UID`
- `NVIDIA_API_KEY`

GitHub Variables 可选：

- `NVIDIA_BASE_URL`
- `NVIDIA_MODEL`

缺少 `NVIDIA_API_KEY` 不会导致 workflow 失败。缺少 QQBot 配置时脚本可成功运行，但不会发送通知。

## 本地开发

本地通过 `.env` 配置，仓库只提交 `.env.example`。`.gitignore` 必须忽略 `.env`、`node_modules`、`dist` 等文件。

`.env.example` 只包含占位符：

```dotenv
QQBOT_HOST=https://your-qqbot-host.example.com
QQBOT_TOKEN=your-qqbot-token
QQBOT_UID=123456789
NVIDIA_API_KEY=your-nvidia-api-key
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=deepseek-ai/deepseek-v4-pro
```

npm scripts：

- `npm run dev`：本地 TypeScript 直接运行。
- `npm run build`：编译到 `dist`。
- `npm run start`：运行编译产物。
- `npm run typecheck`：执行 TypeScript 类型检查。

## 错误处理策略

- 主新闻列表页抓取失败：退出 1。
- 单条公告抓取失败：记录清晰日志，继续处理其他公告。
- AI 缺 key、调用失败、JSON 解析失败：按非维护处理，不崩溃。
- QQBot 配置缺失、UID 非数字、请求失败、非 2xx：不崩溃，记录 `notify_error`。
- 日志不打印完整 token、完整 uid、完整 API key。

## 测试与验证

基础验证包括：

- `npm run typecheck`
- `npm run build`
- 本地缺少 QQBot 配置时运行脚本，不应崩溃。
- 缺少 NVIDIA API key 时，不确定公告应跳过 AI 并按非维护处理。
- 手动修改或删除 `processed.json` 后运行，能自动读取或初始化状态。
- GitHub Actions 中无新公告时不提交 `processed.json`。

## 实战校验策略

开发过程中必须用真实页面做最小闭环验证，避免只根据想象设计选择器和解析逻辑。

本项目指定真实维护公告样本：

- URL：`https://ak.hypergryph.com/news/9692`
- 预期类型：停机维护公告。
- 已确认页面可访问，HTTP 状态码为 200。
- 已确认标题包含 `版本更新停机维护公告`。
- 已确认正文包含维护时间信息，示例为 `2026年05月01日06:00 ~ 12:00`。

该 URL 必须作为开发期回归样本使用，用于验证详情页抓取、标题提取、正文提取、强规则命中、维护时间提取和通知消息格式。实现时不要把完整 HTML 写入仓库；需要 fixture 时优先保存人工最小化后的标题和正文片段，而不是保存整页源码。

实战校验步骤：

1. 使用 `curl` 或项目内 `fetch` 请求 `https://ak.hypergryph.com/news`，确认页面可访问、HTTP 状态码正常、返回内容是预期 HTML。
2. 基于真实 HTML 验证新闻链接提取逻辑，确认只保留 `ak.hypergryph.com` 域名下的 `/news/{数字}` 链接，并完成去重。
3. 从提取结果中选择 1 到 2 条真实公告详情链接，请求详情页 HTML。
4. 基于真实详情页验证标题和正文提取逻辑，确保正文不是空字符串，也没有只提取到导航、页脚或脚本内容。
5. 用真实标题和正文样本执行规则分类，检查普通公告不会误判为维护公告。
6. 使用 `https://ak.hypergryph.com/news/9692` 验证强匹配、维护时间提取和通知消息格式。
7. 若当前列表没有维护公告，构造一条本地 fixture 文本验证维护规则和通知格式，但必须清楚区分真实样本验证和构造样本验证。

实战校验约束：

- 不把抓取到的完整 HTML 提交到仓库。
- 不在日志中输出大段 HTML，只输出链接数量、标题、正文长度、分类结果等摘要信息。
- 不把真实 QQBot token、uid、host 或 NVIDIA API key 写入命令、README、测试文件或日志。
- 网络校验失败时先确认错误边界：DNS、HTTP 状态码、超时、页面结构变化分别记录不同日志。
- 如果真实页面结构与预期不同，优先调整 `news.ts` 的解析逻辑，而不是把特殊情况散落到编排层。

## 安全约束

- 代码、README、`.env.example`、日志和测试中不得出现真实 token、uid、host 或 API key。
- QQBot 和 NVIDIA 所有敏感配置均来自环境变量。
- 不提交 `.env`。
- 日志仅输出缺失变量名、状态码、截断后的响应文本等非敏感信息。
