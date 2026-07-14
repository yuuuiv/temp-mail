# Temp Email — 现代化临时邮箱前端

GitHub 仓库：[yuuuiv/temp-mail](https://github.com/yuuuiv/temp-mail)

基于 **Vue 3 + Vite** 从零重构的临时邮箱前端，对接
[dreamhunter2333/cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email)
的公开 API。

## 特性

- **Nextcloud Mail 风格** 三栏布局（侧边栏 / 邮件列表 / 阅读窗格）
- **完整响应式**：桌面三栏 → 平板抽屉侧边栏 → 手机单栏切换
- **深 / 浅 / 跟随系统** 三态主题切换，首帧无闪烁（FOUC-safe）
- **配色**：Coolors `1c2321-7d98a1-5e6572-a9b4c2-eef1ef`（Steel Slate）
- 显示字体 Space Grotesk + 等宽 JetBrains Mono，拒绝通用 AI 审美
- iframe 沙箱安全渲染 HTML 邮件，自动适配主题
- **AI 邮件提取** — 展示验证码 / 认证链接 / 服务链接等
- **附件下载** — 邮件列表和阅读页均可下载附件
- **URL 参数自动登录** — `?jwt=xxx` 自动登录邮箱，`?auth=xxx` 自动解锁私人站点
- **统一账户服务** — 对接 `awsl-auth`（邮箱登录、GitHub / Google / Microsoft / Web3 登录）
- **完整 Admin 控制台**：统计 / 地址管理 / 创建地址（含无前缀）/ 用户管理 / 发件箱 / Webhook / 邮件规则转发 / AI 提取 / 定时清理 / 黑名单设置
- **私人站点访问密码**（`x-custom-auth`）：`needAuth` 时弹出访问验证
- PWA 可安装

## 管理功能（对应原项目）

进入方式：侧边栏底部「管理控制台」入口（或未登录时左下角悬浮按钮）→ 输入管理员密码。

| 功能 | 说明 | 对接端点 |
|------|------|---------|
| 数据统计 | 地址/用户/收发件/活跃数 | `GET /admin/statistics` |
| 地址管理 | 列表、搜索、删除、清空收件箱、查看凭证、重置密码 | `GET /admin/address`、`DELETE /admin/delete_address/:id` 等 |
| 创建地址 | 支持**无前缀**（`enablePrefix:false`）、随机子域名 | `POST /admin/new_address` |
| 用户管理 | 列表、创建、删除、重置密码、地址数查看 | `GET/POST/DELETE /admin/users` |
| 发件箱 | 按地址查询发件记录 | `GET /admin/sendbox` |
| Webhook | 配置推送地址、密钥、发送测试 | `GET/POST /admin/webhook/settings`、`/admin/webhook/test` |
| 邮件规则 | 拦截未知地址邮件、全局转发地址列表 | `GET/POST /admin/account_settings` |
| AI 提取 | 地址白名单配置（支持通配符） | `GET/POST /admin/ai_extract/settings` |
| 定时清理 | 多种清理策略（收件/未知/发件/闲置地址）+ 立即清理 | `GET/POST /admin/auto_cleanup`、`POST /admin/cleanup` |
| 黑名单/设置 | 地址创建黑名单、发件黑名单、验证发件地址 | `GET/POST /admin/account_settings` |
| 访问密码 | 私人站点验证 | `POST /open_api/site_login` |

**认证约定**：
- 站点访问密码：明文存 `x-custom-auth` header；`site_login` 用 `sha256(密码)` 校验。
- 管理员密码：明文存 `x-admin-auth` header；`admin_login` 用 `sha256(密码)` 校验。
- 地址 JWT：`Authorization: Bearer <jwt>`。

## 开发

```bash
npm install
npm run dev          # http://localhost:5173
npm run dev          # 追加 ?mock=1 可用假数据预览完整界面
```

开发时后端 API 通过 `vite.config.js` 的 proxy 转发到 `http://127.0.0.1:8787`，
按需修改 target 指向你的 worker。

## 构建 / 部署

```bash
npm run build        # 输出到 dist/
```

将 `dist/` 目录部署到静态托管（Cloudflare Pages / Nginx / 任意静态服务器）。

### API 基地址

- **同源部署（推荐）**：前端与 worker 同域，无需配置，`VITE_API_BASE` 留空。
- **分离部署**：复制 `.env.example` 为 `.env`，填写 `VITE_API_BASE=https://你的worker地址`。

### 统一账户服务

若使用 `C:\Users\yuuuiv\Downloads\auth-main` 部署出的 Vercel 账户服务，在前端 `.env` 中补充：

```dotenv
VITE_AUTH_API_BASE=https://你的-auth-vercel域名
VITE_AUTH_APP_ID=demo
VITE_AUTH_APP_SECRET=demo_secret
VITE_AUTH_CALLBACK_PATH=/auth/callback
```

统一账户服务回调支持这些路径：

- 直接第三方回调：`https://你的前端域名/auth/callback/github`、`/auth/callback/google`、`/auth/callback/ms`
- 账户服务中转回调：把 `auth-main` 的 `app_settings__N__redirect_url` 配成 `https://你的前端域名/auth/complete`
- 用户页回调：也可以把 `auth-main` 的 `app_settings__N__redirect_url` 配成 `https://你的前端域名/user`，前端会读取 `?code=` 并打开用户账户面板

本地测试时使用 `http://localhost:5173/auth/callback/<provider>`、`http://localhost:5173/auth/complete` 或 `http://localhost:5173/user`。

若要启用「用户邮箱一览」和“登录用户自动绑定/新建临时邮箱”，还需要在 `auth-main` 后端配置：

```dotenv
temp_mail_api_base=https://你的-temp-mail-worker
temp_mail_admin_auth=你的 Worker 管理员密码
```

这两个变量只应放在 Vercel 的 auth 后端项目中，不要放到 Cloudflare Pages 前端变量里。

## Agent 读取临时邮箱

仓库根目录的 [agent-email.md](./agent-email.md) 定义了 Codex、Cursor、OpenClaw 等 Agent
只读消费临时邮箱的凭证与 API 约定。它不是常驻服务，也不包含网页自动化或付款操作。

1. 在前端创建或登录临时邮箱；在「邮箱设置」中复制该地址的 **Address JWT**。
2. 取得 Worker API 地址（即 `VITE_API_BASE` 对应的地址）。
3. 让 Agent 阅读 `agent-email.md`，并仅向其提供运行时环境变量：

```text
TM_BASE_URL=https://你的-worker-域名
TM_ADDRESS_JWT=该邮箱的Address JWT
TM_SITE_PASSWORD=可选；仅私有站点需要
```

Address JWT 必须作为 `Authorization: Bearer <JWT>` 访问 Worker `/api/*`；不要误用统一账户 JWT，
也不要把 JWT 写入 Git、日志或 Prompt 记录。可先用以下命令校验：

```bash
curl "$TM_BASE_URL/api/settings" \
  -H "Authorization: Bearer $TM_ADDRESS_JWT"
```

随后可读取解析后的邮件：

```bash
curl "$TM_BASE_URL/api/parsed_mails?limit=20&offset=0" \
  -H "Authorization: Bearer $TM_ADDRESS_JWT"
```

## 目录结构

```
src/
  main.js                 入口
  App.vue                 应用外壳 / 响应式三栏编排
  styles/theme.css        主题变量 + 全局样式
  lib/
    api.js                API 层（fetch 封装 + 端点）
    utils.js              SHA-256 / 时间 / 地址解析 / eml 兜底解析
  composables/
    useTheme.js           深浅色主题
    useMailbox.js         设置 / 地址 / 邮件列表 状态
    useToast.js           轻量通知
  components/
    Sidebar.vue           左侧导航
    MailList.vue          邮件列表（骨架屏 / 分页 / 空态）
    MailReader.vue        阅读窗格（iframe 沙箱）
    SendMail.vue          撰写邮件（模态）
    AddressCreator.vue    创建 / 密码登录
    Turnstile.vue         Cloudflare 人机验证
    Modal.vue / Icon.vue / ThemeToggle.vue / ToastHost.vue
```

## 致谢

本项目基于 [dreamhunter2333/cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email)
的 Worker API、数据模型和功能设计构建前端体验，感谢原项目作者与贡献者。
