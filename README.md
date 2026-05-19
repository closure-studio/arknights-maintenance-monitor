# ak-maintenance-monitor

Serverless 明日方舟停机维护公告监控。项目每小时抓取 `https://ak.hypergryph.com/news`，发现新的停机维护、版本更新停机维护或服务器维护公告后，通过 QQBot API 发送提醒。

推荐仓库名：`ak-maintenance-monitor`

## 功能

- GitHub Actions 每小时自动运行一次。
- 默认检查最新 10 条公告。
- 使用 `processed.json` 记录已处理公告，避免重复通知。
- 优先使用规则判断维护公告。
- 只有规则不确定时才使用 NVIDIA API 兜底。
- QQBot 配置和 NVIDIA API key 全部从环境变量读取。
- 不使用 Playwright，不依赖 axios。

## 文件结构

```text
src/
  classifier/
  notifier/
  config.ts
  http.ts
  index.ts
  logger.ts
  news.ts
  state.ts
  time.ts
  types.ts
processed.json
.github/workflows/monitor.yml
```

## GitHub Secrets

在仓库 `Settings -> Secrets and variables -> Actions -> Secrets` 配置：

- `QQBOT_HOST`：QQBot 服务地址，例如 `https://your-qqbot-host.example.com`
- `QQBOT_TOKEN`：QQBot token，例如 `your-qqbot-token`
- `QQBOT_UID`：QQ 接收者 UID，例如 `123456789`
- `NVIDIA_API_KEY`：NVIDIA API key，例如 `your-nvidia-api-key`

`NVIDIA_API_KEY` 是可选兜底。未配置时，规则无法确定的公告会按非维护处理，不会导致 workflow 失败。

可选 Repository Variables：

- `NVIDIA_BASE_URL`：默认 `https://integrate.api.nvidia.com/v1`
- `NVIDIA_MODEL`：默认 `deepseek-ai/deepseek-v4-pro`

## 本地运行

```bash
npm install
cp .env.example .env
npm run dev
```

`.env` 示例：

```dotenv
QQBOT_HOST=https://your-qqbot-host.example.com
QQBOT_TOKEN=your-qqbot-token
QQBOT_UID=123456789
NVIDIA_API_KEY=your-nvidia-api-key
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=deepseek-ai/deepseek-v4-pro
```

不要提交 `.env`。

## QQBot API

请求格式：

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

如果 `QQBOT_HOST`、`QQBOT_TOKEN`、`QQBOT_UID` 任一缺失，脚本会打印 warning 并跳过通知，不会失败。

## processed.json

`processed.json` 记录已经处理过的公告 ID。`news_id` 从 `/news/{数字}` 中提取。已存在的 ID 会跳过，因此不会重复通知。

只有处理到新公告时才更新 `processed.json`。没有新公告时文件不变，GitHub Actions 不会产生无意义提交。

时间字段使用北京时间 `Asia/Shanghai`，格式示例：`2026-05-19T11:30:00+08:00`。

每条记录会保存公告链接、标题、首次发现时间、最后发现时间、分类结果、通知结果、原因、摘要和通知错误。

## 判断策略

规则优先判断维护公告：

- 标题包含 `停机维护` 或 `版本更新停机维护`。
- 正文同时包含 `维护时间` 和 `无法登录`。
- 正文同时包含 `停机维护` 和 `维护期间`。

普通公告排除词包括 `活动公告`、`寻访公告`、`时装`、`组合包`、`礼包`、`通讯`、`限时活动`。

只有规则无法确定时才调用 NVIDIA API。未配置 `NVIDIA_API_KEY` 时不会调用 AI，也不会让 workflow 失败。

## GitHub Actions

workflow 每小时第 17 分钟运行：

```yaml
cron: "17 * * * *"
```

GitHub Actions 的 schedule 使用 UTC。也可以在 Actions 页面使用 `workflow_dispatch` 手动触发。

workflow 使用 Node.js 22，执行安装依赖、构建 TypeScript、运行监控脚本。如果 `processed.json` 有变化，会自动 commit 并 push 回仓库。

## 实战校验

开发时可用真实维护公告样本验证：

- `https://ak.hypergryph.com/news/9692`

该页面应被识别为版本更新停机维护公告，并能提取维护时间。

## 常见问题

### 没有收到 QQ 消息

检查 `QQBOT_HOST`、`QQBOT_TOKEN`、`QQBOT_UID` 是否配置。确认 `QQBOT_UID` 是数字。

### Workflow 没有提交 processed.json

如果没有新公告，`processed.json` 不会被修改，因此不会提交。

### 没有 NVIDIA_API_KEY 会失败吗

不会。AI 只是规则不确定时的兜底。

### 主新闻页抓取失败

脚本会退出 1，让 GitHub Actions 显示失败。检查网络、官网可用性或页面结构变化。
