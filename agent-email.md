# Agent 读取 Temp Mail

本文件定义了 Agent 如何只读访问一个临时邮箱。它不包含浏览器自动化、TicketJam 下单或付款操作。

## 凭证

Agent 需要以下值：

```text
TM_BASE_URL=https://<你的-temp-mail-worker>
TM_ADDRESS_JWT=<该临时邮箱的 Address JWT>
TM_SITE_PASSWORD=<可选；仅站点启用访问密码时填写>
```

`TM_ADDRESS_JWT` 是地址凭证，不是统一账户 JWT。所有 Worker `/api/*` 请求必须使用：

```http
Authorization: Bearer <TM_ADDRESS_JWT>
```

如果站点启用了访问密码，同时带上：

```http
x-custom-auth: <TM_SITE_PASSWORD>
```

不要将凭证写入 Git、日志或聊天记录。建议仅保存到本机私有 `.env` 文件。

## 只读 API

### 校验地址凭证

```bash
curl "$TM_BASE_URL/api/settings" \
  -H "Authorization: Bearer $TM_ADDRESS_JWT"
```

### 列出已解析邮件

```bash
curl "$TM_BASE_URL/api/parsed_mails?limit=20&offset=0" \
  -H "Authorization: Bearer $TM_ADDRESS_JWT"
```

返回的每封邮件包含 `id`、`source`、`sender`、`to`、`subject`、`text`、`html`、`created_at` 与附件元数据。

### 获取单封已解析邮件

```bash
curl "$TM_BASE_URL/api/parsed_mail/<MAIL_ID>" \
  -H "Authorization: Bearer $TM_ADDRESS_JWT"
```

## 轮询约定

- 初始间隔至少 3 秒；建议指数退避，最大 10 秒。
- 按邮件 `id` 去重。
- 不得高于每秒一次请求。
- 收到 `429` 时等待后重试。
- 收到 `401` 时停止，并要求用户提供新的 Address JWT。

## TicketJam 匹配规则

监控程序可将以下内容视为候选邮件：

1. 发件人地址或显示名包含 `ticketjam`。
2. `subject`、`text` 或 `html` 包含：`のチケットが出品されました！`
3. 从正文中提取 `ticketjam.jp` 的 HTTPS 链接。

命中后只能通知用户或打开目标页面；付款确认必须由用户在浏览器中完成。
