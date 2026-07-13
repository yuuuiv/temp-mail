// ============================================================
// API 层 — 对接 dreamhunter2333/cloudflare_temp_email worker
// 认证:
//   - 地址 JWT: Authorization: Bearer <jwt>   -> /api/*
//   - 站点密码: x-custom-auth: <auth>
// 存储 key: tm-jwt / tm-auth
// ============================================================

const API_BASE = import.meta.env.VITE_API_BASE || ''
const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE || ''
const AUTH_APP_ID = import.meta.env.VITE_AUTH_APP_ID || 'demo'
const AUTH_APP_SECRET = import.meta.env.VITE_AUTH_APP_SECRET || ''
const AUTH_CALLBACK_PATH = import.meta.env.VITE_AUTH_CALLBACK_PATH || '/auth/callback'

function getFingerprint() {
  if (typeof localStorage === 'undefined') return ''
  let fp = localStorage.getItem('tm-fingerprint')
  if (!fp) {
    const seed = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    ].join('|')
    fp = btoa(unescape(encodeURIComponent(seed))).slice(0, 64)
    localStorage.setItem('tm-fingerprint', fp)
  }
  return fp
}

export const store = {
  get jwt() {
    return localStorage.getItem('tm-jwt') || ''
  },
  set jwt(v) {
    if (v) localStorage.setItem('tm-jwt', v)
    else localStorage.removeItem('tm-jwt')
  },
  get auth() {
    // 站点访问密码（明文，作为 x-custom-auth header）
    return localStorage.getItem('tm-auth') || ''
  },
  set auth(v) {
    if (v) localStorage.setItem('tm-auth', v)
    else localStorage.removeItem('tm-auth')
  },
  get adminAuth() {
    // 管理员密码（明文，作为 x-admin-auth header）
    return localStorage.getItem('tm-admin-auth') || ''
  },
  set adminAuth(v) {
    if (v) localStorage.setItem('tm-admin-auth', v)
    else localStorage.removeItem('tm-admin-auth')
  },
  get authModuleJwt() {
    return localStorage.getItem('tm-auth-module-jwt') || ''
  },
  set authModuleJwt(v) {
    if (v) localStorage.setItem('tm-auth-module-jwt', v)
    else localStorage.removeItem('tm-auth-module-jwt')
  },
  get authModuleUser() {
    const raw = localStorage.getItem('tm-auth-module-user') || ''
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  },
  set authModuleUser(v) {
    if (v) localStorage.setItem('tm-auth-module-user', JSON.stringify(v))
    else localStorage.removeItem('tm-auth-module-user')
  },
}

// 401 拦截回调：由 UI 层注册（弹出访问密码 / admin 登录框）
export const authHandlers = {
  onNeedSiteAuth: null, // needAuth 且 401
  onNeedAdminAuth: null, // /admin/* 且 401
}

/** 头部值安全检查，避免 "Invalid character in header" */
function safeHeader(value) {
  if (typeof value !== 'string') return ''
  const v = value.trim()
  if (!v || v === 'undefined' || v === 'null') return ''
  // 排除控制字符
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(v)) return ''
  return v
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * 统一请求方法
 * @param {string} path  以 / 开头的路径
 * @param {RequestInit & {jwt?:string}} [options]
 */
// 仅开发预览（?mock=1）：拦截 admin 请求返回假数据以验证 UI
function mockAdmin(path, options) {
  const method = (options.method || 'GET').toUpperCase()
  if (path.startsWith('/admin/address') && method === 'GET') {
    return {
      count: 3,
      results: [
        { id: 101, name: 'quiet-otter-4821@example.com', mail_count: 12, send_count: 2, created_at: new Date(Date.now() - 2 * 864e5).toISOString() },
        { id: 102, name: 'admin@example.com', mail_count: 340, send_count: 88, created_at: new Date(Date.now() - 40 * 864e5).toISOString() },
        { id: 103, name: 'test.no.prefix@example.com', mail_count: 0, send_count: 0, created_at: new Date().toISOString() },
      ],
    }
  }
  if (path.startsWith('/admin/statistics')) {
    return {
      addressCount: 1287, userCount: 342, mailCount: 58213, sendCount: 4021,
      activeAddressCount7days: 156, activeAddressCount30days: 489,
    }
  }
  if (path.startsWith('/admin/users') && method === 'GET') {
    return {
      count: 2,
      results: [
        { id: 1, user_email: 'owner@example.com', address_count: 5, role_text: 'admin', created_at: new Date(Date.now() - 90 * 864e5).toISOString() },
        { id: 2, user_email: 'guest@example.com', address_count: 1, role_text: '', created_at: new Date(Date.now() - 3 * 864e5).toISOString() },
      ],
    }
  }
  if (path.startsWith('/admin/sendbox')) {
    return { count: 1, results: [{ id: 9, address: 'admin@example.com', to_mail: 'someone@dest.com', subject: '测试发件', created_at: new Date().toISOString() }] }
  }
  if (path.startsWith('/admin/account_settings') && method === 'GET') {
    return { blockList: ['admin', 'root'], sendBlockList: ['spam'], verifiedAddressList: [] }
  }
  if (path.startsWith('/admin/auto_cleanup') && method === 'GET') {
    return { enableMailsAutoCleanup: true, mailsActiveDaysToCleanup: 30 }
  }
  return { success: true }
}

export async function apiFetch(path, options = {}) {
  // 开发预览拦截
  if (
    import.meta.env.DEV &&
    typeof location !== 'undefined' &&
    new URLSearchParams(location.search).has('mock') &&
    path.startsWith('/admin')
  ) {
    await new Promise((r) => setTimeout(r, 250))
    return mockAdmin(path, options)
  }

  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (!headers.has('x-lang')) headers.set('x-lang', navigator.language?.startsWith('zh') ? 'zh' : 'en')
  const fp = safeHeader(getFingerprint())
  if (fp && !headers.has('x-fingerprint')) headers.set('x-fingerprint', fp)

  const bearer = safeHeader(options.jwt ?? store.jwt)
  if (bearer) headers.set('Authorization', `Bearer ${bearer}`)

  const custom = safeHeader(store.auth)
  if (custom) headers.set('x-custom-auth', custom)

  // 管理接口带上 admin 密码
  if (path.startsWith('/admin')) {
    const adminPwd = safeHeader(store.adminAuth)
    if (adminPwd) headers.set('x-admin-auth', adminPwd)
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const ct = res.headers.get('content-type') || ''
  const isJson = ct.includes('application/json')
  const payload = isJson ? await res.json().catch(() => null) : await res.text()

  if (res.status < 200 || res.status >= 300) {
    // 401 拦截：交给 UI 弹出对应登录框
    if (res.status === 401) {
      if (path.startsWith('/admin')) authHandlers.onNeedAdminAuth?.()
      else authHandlers.onNeedSiteAuth?.()
    }
    const msg =
      (isJson && payload && (payload.error || payload.message || payload.detail)) ||
      (typeof payload === 'string' && payload) ||
      `请求失败 (${res.status})`
    throw new ApiError(msg, res.status)
  }
  return payload
}

export async function authFetch(path, options = {}) {
  if (!AUTH_API_BASE) throw new ApiError('未配置 VITE_AUTH_API_BASE，无法连接统一账户服务', 0)

  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${AUTH_API_BASE}${path}`, {
    ...options,
    headers,
  })

  const ct = res.headers.get('content-type') || ''
  const isJson = ct.includes('application/json')
  const payload = isJson ? await res.json().catch(() => null) : await res.text()

  if (res.status < 200 || res.status >= 300) {
    const msg =
      (isJson && payload && (payload.error || payload.message || payload.detail)) ||
      (typeof payload === 'string' && payload) ||
      `Auth 请求失败 (${res.status})`
    throw new ApiError(msg, res.status)
  }
  return payload
}

  // ---- 具体端点封装 ----
export const api = {
  fetch: apiFetch,
  authFetch,

  getOpenSettings: () => apiFetch('/open_api/settings'),

  getSettings: (jwt) => apiFetch('/api/settings', { jwt }),

  newAddress: ({ name, domain, cf_token, enableRandomSubdomain }) =>
    apiFetch('/api/new_address', {
      method: 'POST',
      body: JSON.stringify({ name, domain, cf_token, enableRandomSubdomain }),
    }),

  addressLogin: ({ email, password, cf_token }) =>
    apiFetch('/api/address_login', {
      method: 'POST',
      body: JSON.stringify({ email, password, cf_token }),
    }),

  credentialLogin: ({ credential, cf_token }) =>
    apiFetch('/open_api/credential_login', {
      method: 'POST',
      body: JSON.stringify({ credential, cf_token }),
    }),

  // 服务端已解析好的邮件列表（无需前端 eml 解析）
  listParsedMails: (limit, offset) =>
    apiFetch(`/api/parsed_mails?limit=${limit}&offset=${offset}`),

  getParsedMail: (id) => apiFetch(`/api/parsed_mail/${id}`),

  // 原始邮件（兜底，前端用 postal-mime 解析）
  listMails: (limit, offset) =>
    apiFetch(`/api/mails?limit=${limit}&offset=${offset}`),

  getMail: (id) => apiFetch(`/api/mail/${id}`),

  deleteMail: (id) => apiFetch(`/api/mails/${id}`, { method: 'DELETE' }),

  clearInbox: () => apiFetch('/api/clear_inbox', { method: 'DELETE' }),

  clearSentItems: () => apiFetch('/api/clear_sent_items', { method: 'DELETE' }),

  deleteAddress: () => apiFetch('/api/delete_address', { method: 'DELETE' }),

  changeAddressPassword: (newPassword) =>
    apiFetch('/api/address_change_password', {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword }),
    }),

  sendMail: (mail) =>
    apiFetch('/api/send_mail', {
      method: 'POST',
      body: JSON.stringify(mail),
    }),

  requestSendMailAccess: () =>
    apiFetch('/api/request_send_mail_access', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  listSendbox: (limit, offset) =>
    apiFetch(`/api/sendbox?limit=${limit}&offset=${offset}`),

  deleteSendboxMail: (id) =>
    apiFetch(`/api/sendbox/${id}`, { method: 'DELETE' }),

  getWebhookSettings: () => apiFetch('/api/webhook/settings'),

  saveWebhookSettings: (payload) =>
    apiFetch('/api/webhook/settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  testWebhookSettings: (payload) =>
    apiFetch('/api/webhook/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listAttachments: () => apiFetch('/api/attachment/list'),

  getAttachmentUrl: (key) =>
    apiFetch('/api/attachment/get_url', {
      method: 'POST',
      body: JSON.stringify({ key }),
    }),

  getAttachmentPutUrl: (key) =>
    apiFetch('/api/attachment/put_url', {
      method: 'POST',
      body: JSON.stringify({ key }),
    }),

  deleteAttachment: (key) =>
    apiFetch('/api/attachment/delete', {
      method: 'POST',
      body: JSON.stringify({ key }),
    }),

  // ---- 站点访问密码（私人站点） ----
  // password 为 sha256(明文)；成功后由 UI 把明文存入 store.auth 作 x-custom-auth
  siteLogin: ({ password, cf_token }) =>
    apiFetch('/open_api/site_login', {
      method: 'POST',
      body: JSON.stringify({ password, cf_token }),
    }),

  // ---- 管理员登录校验 ----
  adminLogin: ({ password, cf_token }) =>
    apiFetch('/open_api/admin_login', {
      method: 'POST',
      body: JSON.stringify({ password, cf_token }),
    }),

  // ---- 管理接口（x-admin-auth 自动带上） ----
  admin: {
    listAddresses: ({ limit, offset, query = '', sortBy = 'id', sortOrder = 'descend' }) =>
      apiFetch(
        `/admin/address?limit=${limit}&offset=${offset}` +
          (query ? `&query=${encodeURIComponent(query)}` : '') +
          `&sort_by=${sortBy}&sort_order=${sortOrder}`
      ),

    // 创建地址（可无前缀 enablePrefix:false）
    newAddress: ({ name, domain, enablePrefix, enableRandomSubdomain }) =>
      apiFetch('/admin/new_address', {
        method: 'POST',
        body: JSON.stringify({ name, domain, enablePrefix, enableRandomSubdomain }),
      }),

    deleteAddress: (id) =>
      apiFetch(`/admin/delete_address/${id}`, { method: 'DELETE' }),

    clearInbox: (id) =>
      apiFetch(`/admin/clear_inbox/${id}`, { method: 'DELETE' }),

    clearSentItems: (id) =>
      apiFetch(`/admin/clear_sent_items/${id}`, { method: 'DELETE' }),

    showCredential: (id) => apiFetch(`/admin/show_password/${id}`),

    getAddressForwardingRules: (addressId) => apiFetch(`/admin/address_forwarding_rules/${addressId}`),
    saveAddressForwardingRules: (addressId, rules) =>
      apiFetch(`/admin/address_forwarding_rules/${addressId}`, {
        method: 'POST',
        body: JSON.stringify({ rules }),
      }),

    resetPassword: (id, password) =>
      apiFetch(`/admin/address/${id}/reset_password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),

    listMails: ({ limit, offset, address = '' }) =>
      apiFetch(
        `/admin/mails?limit=${limit}&offset=${offset}` +
          (address ? `&address=${encodeURIComponent(address)}` : '')
      ),

    listUnknownMails: ({ limit, offset, address = '' }) =>
      apiFetch(
        `/admin/mails_unknow?limit=${limit}&offset=${offset}` +
          (address ? `&address=${encodeURIComponent(address)}` : '')
      ),

    deleteMail: (id) =>
      apiFetch(`/admin/mails/${id}`, { method: 'DELETE' }),

    listSendbox: ({ limit, offset, address = '' }) =>
      apiFetch(
        `/admin/sendbox?limit=${limit}&offset=${offset}` +
          (address ? `&address=${encodeURIComponent(address)}` : '')
      ),

    deleteSendboxMail: (id) =>
      apiFetch(`/admin/sendbox/${id}`, { method: 'DELETE' }),

    sendMail: (payload) =>
      apiFetch('/admin/send_mail', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    listSenderAccess: ({ limit, offset, address = '' }) =>
      apiFetch(
        `/admin/address_sender?limit=${limit}&offset=${offset}` +
          (address ? `&address=${encodeURIComponent(address)}` : '')
      ),
    updateSenderAccess: (payload) =>
      apiFetch('/admin/address_sender', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    deleteSenderAccess: (id) =>
      apiFetch(`/admin/address_sender/${id}`, { method: 'DELETE' }),

    statistics: () => apiFetch('/admin/statistics'),

    getAccountSettings: () => apiFetch('/admin/account_settings'),
    saveAccountSettings: (payload) =>
      apiFetch('/admin/account_settings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    getIpBlacklist: () => apiFetch('/admin/ip_blacklist/settings'),
    saveIpBlacklist: (payload) =>
      apiFetch('/admin/ip_blacklist/settings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    getWebhookSettings: () => apiFetch('/admin/webhook/settings'),
    saveWebhookSettings: (payload) =>
      apiFetch('/admin/webhook/settings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    testWebhookSettings: (payload) =>
      apiFetch('/admin/webhook/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    getMailWebhookSettings: () => apiFetch('/admin/mail_webhook/settings'),
    saveMailWebhookSettings: (payload) =>
      apiFetch('/admin/mail_webhook/settings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    testMailWebhookSettings: (payload) =>
      apiFetch('/admin/mail_webhook/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    getDbVersion: () => apiFetch('/admin/db_version'),
    initDb: () => apiFetch('/admin/db_initialize', { method: 'POST', body: JSON.stringify({}) }),
    migrateDb: () => apiFetch('/admin/db_migration', { method: 'POST', body: JSON.stringify({}) }),
    getWorkerConfigs: () => apiFetch('/admin/worker/configs'),

    getUserSettings: () => apiFetch('/admin/user_settings'),
    saveUserSettings: (payload) =>
      apiFetch('/admin/user_settings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getUserOauth2Settings: () => apiFetch('/admin/user_oauth2_settings'),
    saveUserOauth2Settings: (payload) =>
      apiFetch('/admin/user_oauth2_settings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getUserRoles: () => apiFetch('/admin/user_roles'),
    updateUserRole: ({ user_id, role_text }) =>
      apiFetch('/admin/user_roles', {
        method: 'POST',
        body: JSON.stringify({ user_id, role_text }),
      }),
    getRoleAddressConfig: () => apiFetch('/admin/role_address_config'),
    saveRoleAddressConfig: (configs) =>
      apiFetch('/admin/role_address_config', {
        method: 'POST',
        body: JSON.stringify({ configs }),
      }),
    listUserAddresses: (userId) => apiFetch(`/admin/users/bind_address/${userId}`),
    bindUserAddress: (payload) =>
      apiFetch('/admin/users/bind_address', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    telegramStatus: () => apiFetch('/admin/telegram/status'),
    initTelegram: (payload) =>
      apiFetch('/admin/telegram/init', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getTelegramSettings: () => apiFetch('/admin/telegram/settings'),
    saveTelegramSettings: (payload) =>
      apiFetch('/admin/telegram/settings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    // 清理
    getAutoCleanup: () => apiFetch('/admin/auto_cleanup'),
    saveAutoCleanup: (payload) =>
      apiFetch('/admin/auto_cleanup', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    cleanupNow: (payload) =>
      apiFetch('/admin/cleanup', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    // 用户管理
    listUsers: ({ limit, offset, query = '' }) =>
      apiFetch(
        `/admin/users?limit=${limit}&offset=${offset}` +
          (query ? `&query=${encodeURIComponent(query)}` : '')
      ),
    createUser: ({ email, password }) =>
      apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    deleteUser: (userId) =>
      apiFetch(`/admin/users/${userId}`, { method: 'DELETE' }),
    resetUserPassword: (userId, password) =>
      apiFetch(`/admin/users/${userId}/reset_password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
  },

  // ---- 统一账户服务（awsl-auth，Vercel/Supabase） ----
  auth: {
    enabled: !!AUTH_API_BASE,
    appId: AUTH_APP_ID,
    hasAppSecret: !!AUTH_APP_SECRET,
    callbackPath: AUTH_CALLBACK_PATH,
    callbackUrl: (loginType) => `${location.origin}${AUTH_CALLBACK_PATH}/${encodeURIComponent(loginType)}`,
    completeUrl: () => `${location.origin}/auth/complete`,
    settings: () => authFetch('/api/settings'),
    loginUrl: ({ loginType, redirectUrl }) =>
      authFetch(
        `/api/login?login_type=${encodeURIComponent(loginType)}` +
          `&redirect_url=${encodeURIComponent(redirectUrl)}`
      ),
    oauth: ({ loginType, code, web3Account, redirectUrl }) =>
      authFetch('/api/oauth', {
        method: 'POST',
        body: JSON.stringify({
          app_id: AUTH_APP_ID,
          login_type: loginType,
          code,
          web3_account: web3Account,
          redirect_url: redirectUrl,
        }),
      }),
    token: (code) => {
      if (!AUTH_APP_SECRET) {
        throw new ApiError('未配置 VITE_AUTH_APP_SECRET，无法用账户登录 code 换取 JWT', 0)
      }
      return authFetch('/api/token', {
        method: 'POST',
        body: JSON.stringify({
          app_id: AUTH_APP_ID,
          app_secret: AUTH_APP_SECRET,
          code,
        }),
      })
    },
    info: (jwt) =>
      authFetch(`/api/info?app_id=${encodeURIComponent(AUTH_APP_ID)}`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }),
    emailLogin: ({ email, password }) =>
      authFetch('/api/email/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    emailVerifyCode: ({ email, cf_token }) =>
      authFetch('/api/email/verify_code', {
        method: 'POST',
        body: JSON.stringify({ email, cf_token }),
      }),
    emailRegister: ({ email, password, code }) =>
      authFetch('/api/email/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, code }),
      }),
    tempMailSyncUser: (jwt) =>
      authFetch(`/api/temp-mail/sync_user?app_id=${encodeURIComponent(AUTH_APP_ID)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }),
    tempMailAddresses: (jwt) =>
      authFetch(`/api/temp-mail/addresses?app_id=${encodeURIComponent(AUTH_APP_ID)}`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }),
    tempMailAddressJwt: (jwt, addressId) =>
      authFetch(
        `/api/temp-mail/address_jwt/${encodeURIComponent(addressId)}?app_id=${encodeURIComponent(AUTH_APP_ID)}`,
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
        }
      ),
    tempMailAddressForwardingRules: (jwt, addressId) =>
      authFetch(
        `/api/temp-mail/address_forwarding_rules/${encodeURIComponent(addressId)}?app_id=${encodeURIComponent(AUTH_APP_ID)}`,
        { headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' } }
      ),
    saveTempMailAddressForwardingRules: (jwt, addressId, rules) =>
      authFetch(
        `/api/temp-mail/address_forwarding_rules/${encodeURIComponent(addressId)}?app_id=${encodeURIComponent(AUTH_APP_ID)}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ rules }),
        }
      ),
    tempMailDeleteAddressMail: (jwt, addressId, mailId) =>
      authFetch(
        `/api/temp-mail/address_mail/${encodeURIComponent(addressId)}/${encodeURIComponent(mailId)}?app_id=${encodeURIComponent(AUTH_APP_ID)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        }
      ),
    tempMailMails: (jwt, { limit, offset, address = '' }) =>
      authFetch(
        `/api/temp-mail/mails?app_id=${encodeURIComponent(AUTH_APP_ID)}` +
          `&limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}` +
          (address ? `&address=${encodeURIComponent(address)}` : ''),
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
        }
      ),
    tempMailSendbox: (jwt, { limit, offset, address = '' }) =>
      authFetch(
        `/api/temp-mail/sendbox?app_id=${encodeURIComponent(AUTH_APP_ID)}` +
          `&limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}` +
          (address ? `&address=${encodeURIComponent(address)}` : ''),
        { headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' } }
      ),
    tempMailNewAddress: (jwt, payload) =>
      authFetch(`/api/temp-mail/new_address?app_id=${encodeURIComponent(AUTH_APP_ID)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
    tempMailBindAddress: (jwt, addressJwt) =>
      authFetch(`/api/temp-mail/bind_address?app_id=${encodeURIComponent(AUTH_APP_ID)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jwt: addressJwt }),
      }),
  },
}
