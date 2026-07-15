import { ref, computed } from 'vue'
import { api, store, ApiError } from '@/lib/api'
import { parseAddress, parseRawEml } from '@/lib/utils'

// ---- 全局单例状态 ----
const openSettings = ref({ fetched: false, title: 'Temp Email' })
const settings = ref({ fetched: false, address: '', send_balance: 0 })

const mails = ref([])
const totalCount = ref(0)
const currentMail = ref(null)
const currentPage = ref(1)
const pageSize = 20

const loadingList = ref(false)
const loadingMail = ref(false)

const hasAddress = computed(() => !!settings.value.address)
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalCount.value / pageSize))
)

// 把 parsed_mail 归一化成列表项
function normalize(m) {
  const candidates = [m.from, m.sender, m.source].filter(Boolean)
  const fromRaw = candidates.find((value) => !/^bounces?[+=-]/i.test(String(value).trim())) || candidates[0] || ''
  const { name, email } = parseAddress(fromRaw)
  const isBounceAddress = /^bounces?[+=-]/i.test(email || fromRaw)
  const domainLabel = isBounceAddress && email.includes('@')
    ? email.split('@')[1].split('.').slice(-2, -1)[0]
    : ''
  const fallbackName = domainLabel ? `${domainLabel[0].toUpperCase()}${domainLabel.slice(1)}` : ''
  return {
    id: m.id,
    subject: (m.subject || '').trim() || '(无主题)',
    fromName: name || fallbackName || email || '未知发件人',
    fromEmail: email || fromRaw,
    preview: (m.text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140),
    text: m.text || '',
    html: m.html || '',
    to: m.address || m.to || '',
    createdAt: m.created_at || m.createdAt || Date.now(),
    attachments: m.attachments || [],
    raw: m,
  }
}

async function loadOpenSettings() {
  try {
    const res = await api.getOpenSettings()
    const domains = res.domains || res.defaultDomains || []
    const labels = res.domainLabels || []
    const allDomainOptions = domains.map((d, i) => ({
      label: labels[i] || d,
      value: d,
    }))
    const defaultDomains = Array.isArray(res.defaultDomains) ? res.defaultDomains : []
    const domainOptions = defaultDomains.length
      ? allDomainOptions.filter((d) => defaultDomains.includes(d.value))
      : allDomainOptions
    openSettings.value = {
      ...res,
      fetched: true,
      title: res.title || 'Temp Email',
      announcement: res.announcement || '',
      alwaysShowAnnouncement: res.alwaysShowAnnouncement || false,
      prefix: res.prefix || '',
      addressRegex: res.addressRegex || '',
      minAddressLen: res.minAddressLen || 1,
      maxAddressLen: res.maxAddressLen || 30,
      needAuth: res.needAuth || false,
      defaultDomains,
      randomSubdomainDomains: res.randomSubdomainDomains || [],
      allDomainOptions,
      enableAddressPassword: res.enableAddressPassword || false,
      enableSendMail: res.enableSendMail || false,
      enableUserCreateEmail: res.enableUserCreateEmail ?? true,
      disableAnonymousUserCreateEmail: res.disableAnonymousUserCreateEmail || false,
      disableCustomAddressName: res.disableCustomAddressName || false,
      enableUserDeleteEmail: res.enableUserDeleteEmail || false,
      enableWebhook: res.enableWebhook || false,
      enableIndexAbout: res.enableIndexAbout || false,
      isS3Enabled: res.isS3Enabled || false,
      showGithub: res.showGithub ?? true,
      statusUrl: res.statusUrl || '',
      adminContact: res.adminContact || '',
      smtpImapProxyConfig: res.smtpImapProxyConfig || null,
      cfTurnstileSiteKey: res.cfTurnstileSiteKey || '',
      enableGlobalTurnstileCheck: res.enableGlobalTurnstileCheck || false,
      copyright: res.copyright || '',
      domainOptions,
    }
  } catch (e) {
    openSettings.value.fetched = true
    throw e
  }
}

async function loadSettings() {
  if (!store.jwt) {
    settings.value = { fetched: true, address: '', send_balance: 0 }
    return
  }
  try {
    const res = await api.getSettings()
    settings.value = {
      fetched: true,
      address: res.address || '',
      send_balance: res.send_balance || 0,
    }
  } catch (e) {
    // JWT 失效
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      store.jwt = ''
      settings.value = { fetched: true, address: '', send_balance: 0 }
    } else {
      settings.value.fetched = true
      throw e
    }
  }
}

async function loadMails(page = currentPage.value) {
  if (!hasAddress.value) return
  loadingList.value = true
  const offset = (page - 1) * pageSize
  try {
    let res
    try {
      res = await api.listParsedMails(pageSize, offset)
    } catch {
      // 兜底: 用原始邮件 + 前端解析
      const raw = await api.listMails(pageSize, offset)
      const results = await Promise.all((raw.results || []).map(async (row) => {
        if (row.raw) {
          try {
            return { ...row, ...(await parseRawEml(row.raw)) }
          } catch {
            return row
          }
        }
        return row
      }))
      res = { count: raw.count, results }
    }
    totalCount.value = res.count ?? 0
    mails.value = (res.results || []).map(normalize)
    currentPage.value = page
  } finally {
    loadingList.value = false
  }
}

async function openMail(item) {
  currentMail.value = item
  // 若列表项已含 html/text 直接用，否则拉取详情
  if (!item.html && !item.text) {
    loadingMail.value = true
    try {
      const detail = await api.getParsedMail(item.id).catch(() => api.getMail(item.id))
      currentMail.value = normalize(detail)
    } finally {
      loadingMail.value = false
    }
  }
}

async function removeMail(id) {
  await api.deleteMail(id)
  mails.value = mails.value.filter((m) => m.id !== id)
  if (currentMail.value?.id === id) currentMail.value = null
  totalCount.value = Math.max(0, totalCount.value - 1)
}

function logout() {
  store.jwt = ''
  settings.value = { fetched: true, address: '', send_balance: 0 }
  mails.value = []
  currentMail.value = null
  totalCount.value = 0
}

// 仅用于开发预览（?mock=1），注入假数据以验证完整界面
function loadMockData() {
  openSettings.value = {
    ...openSettings.value,
    fetched: true,
    title: 'Temp Email',
    enableUserCreateEmail: true,
    enableUserDeleteEmail: true,
    enableSendMail: true,
    enableWebhook: true,
    enableIndexAbout: true,
    isS3Enabled: true,
    enableAddressPassword: true,
    domainOptions: [{ label: 'example.com', value: 'example.com' }],
    allDomainOptions: [{ label: 'example.com', value: 'example.com' }],
  }
  settings.value = {
    fetched: true,
    address: 'quiet-otter-4821@example.com',
    send_balance: 12,
  }
  const samples = [
    {
      id: 1,
      subject: 'GitHub 登录验证码：284917',
      source: 'GitHub <noreply@github.com>',
      text: '你的一次性验证码是 284917，10 分钟内有效。如果这不是你本人操作，请忽略此邮件。',
      html: '<div style="font-family:sans-serif"><h2 style="margin:0 0 12px">验证你的登录</h2><p>你的一次性验证码：</p><p style="font-size:32px;letter-spacing:8px;font-weight:700;font-family:monospace">284917</p><p style="color:#888">10 分钟内有效。</p></div>',
      created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      subject: '欢迎使用 Vercel — 部署你的第一个项目',
      source: 'Vercel <team@vercel.com>',
      text: '感谢注册 Vercel！点击下方按钮开始部署你的第一个前端项目，几秒钟即可上线。',
      html: '<div style="font-family:sans-serif"><h2>欢迎 👋</h2><p>感谢注册 Vercel，几秒即可让你的项目上线。</p><a href="#" style="display:inline-block;background:#000;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;margin-top:8px">立即部署</a></div>',
      created_at: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
      attachments: [{ filename: 'getting-started.pdf' }],
    },
    {
      id: 3,
      subject: '你的订单 #A10293 已发货',
      source: '订单中心 <orders@shop.example>',
      text: '你的订单已发货，预计 2-3 个工作日送达。物流单号：SF1234567890。',
      html: '<div style="font-family:sans-serif"><h3>订单已发货 📦</h3><p>预计 2-3 个工作日送达。</p><p>物流单号：<b>SF1234567890</b></p></div>',
      created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    },
  ]
  totalCount.value = samples.length
  mails.value = samples.map(normalize)
}

export function useMailbox() {
  return {
    openSettings,
    settings,
    mails,
    totalCount,
    totalPages,
    currentPage,
    pageSize,
    currentMail,
    loadingList,
    loadingMail,
    hasAddress,
    loadOpenSettings,
    loadSettings,
    loadMails,
    openMail,
    removeMail,
    logout,
    loadMockData,
  }
}
