import { computed, ref } from 'vue'
import { api, store } from '@/lib/api'
import { parseAddress, parseRawEml } from '@/lib/utils'
import { useAuthModule } from './useAuthModule'
import { useMailbox } from './useMailbox'

const addresses = ref([])
const selectedAddress = ref('')
const mails = ref([])
const totalCount = ref(0)
const currentMail = ref(null)
const currentPage = ref(1)
const pageSize = 20
const loadingAddresses = ref(false)
const loadingMails = ref(false)
const creating = ref(false)
let mailRequestId = 0

const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))

function normalizeAddress(row) {
  return {
    ...row,
    id: row.id,
    address: row.address || row.name || '',
    mail_count: row.mail_count || 0,
    send_count: row.send_count || 0,
  }
}

function normalizeMail(m) {
  const candidates = [m.from, m.sender, m.source].filter(Boolean).map((value) => ({
    raw: String(value).trim(),
    ...parseAddress(value),
  }))
  // SMTP envelope senders may be VERP/bounce tracking addresses. They are
  // transport metadata, not the From identity shown to users.
  const sender = candidates.find(({ email, raw }) => !/^bounces?[+=-]/i.test(email || raw)) || null
  const envelope = candidates[0] || { raw: '', name: '', email: '' }
  const isBounceAddress = /^bounces?[+=-]/i.test(envelope.email || envelope.raw)
  const domainLabel = isBounceAddress && envelope.email.includes('@')
    ? envelope.email.split('@')[1].split('.').slice(-2, -1)[0]
    : ''
  const fallbackName = domainLabel ? `${domainLabel[0].toUpperCase()}${domainLabel.slice(1)}` : ''
  return {
    id: m.id,
    subject: (m.subject || '').trim() || '(无主题)',
    fromName: m.fromName || sender?.name || fallbackName || sender?.email || '未知发件人',
    fromEmail: sender?.email || '',
    preview: (m.text || '').replace(/\s+/g, ' ').trim().slice(0, 140),
    text: m.text || '',
    html: m.html || '',
    to: m.address || m.to || '',
    createdAt: m.created_at || m.createdAt || Date.now(),
    attachments: m.attachments || [],
    raw: m,
  }
}

async function normalizeMailRows(rows) {
  return Promise.all((rows || []).map(async (row) => {
    if (row.raw && !row.text && !row.html) {
      try {
        return normalizeMail({ ...row, ...(await parseRawEml(row.raw)) })
      } catch {
        return normalizeMail(row)
      }
    }
    return normalizeMail(row)
  }))
}

function randomName(max = 30) {
  const words = ['quiet', 'swift', 'silver', 'green', 'nova', 'pixel', 'river', 'cloud']
  const animals = ['otter', 'fox', 'lynx', 'panda', 'raven', 'koala', 'mink', 'heron']
  return `${words[Math.floor(Math.random() * words.length)]}-${animals[Math.floor(Math.random() * animals.length)]}-${Math.floor(1000 + Math.random() * 9000)}`.slice(0, max)
}

async function loadAddresses() {
  const { jwt } = useAuthModule()
  if (!jwt.value) {
    addresses.value = []
    return []
  }
  loadingAddresses.value = true
  try {
    const res = await api.auth.tempMailAddresses(jwt.value)
    addresses.value = (res.results || []).map(normalizeAddress)
    return addresses.value
  } finally {
    loadingAddresses.value = false
  }
}

async function loadMails(page = currentPage.value) {
  const { jwt } = useAuthModule()
  if (!jwt.value) return
  const requestId = ++mailRequestId
  loadingMails.value = true
  // Clear the previous mailbox immediately: it prevents stale messages being
  // displayed while the selected address has already changed.
  mails.value = []
  totalCount.value = 0
  currentPage.value = page
  const offset = (page - 1) * pageSize
  try {
    const res = await api.auth.tempMailMails(jwt.value, {
      limit: pageSize,
      offset,
      address: selectedAddress.value,
    })
    const normalized = await normalizeMailRows(res.results || [])
    // A slower request for the previously selected mailbox must never replace
    // the newest selection after users click through addresses quickly.
    if (requestId !== mailRequestId) return
    totalCount.value = res.count ?? 0
    mails.value = normalized
  } finally {
    if (requestId === mailRequestId) loadingMails.value = false
  }
}

async function selectAddress(address = '') {
  selectedAddress.value = address
  currentMail.value = null
  currentPage.value = 1
  await loadMails(1)
}

async function activateAddress(row) {
  const { jwt } = useAuthModule()
  const { loadSettings, loadMails: loadAddressMails } = useMailbox()
  const addressId = row?.id
  if (!jwt.value || !addressId) return
  const res = await api.auth.tempMailAddressJwt(jwt.value, addressId)
  if (!res?.jwt) throw new Error('未获取到地址凭证')
  store.jwt = res.jwt
  selectedAddress.value = row.address || row.name || ''
  await loadSettings()
  await loadAddressMails(1)
  await loadMails(1)
}

async function createAddress({ name, domain, enableRandomSubdomain } = {}) {
  const { jwt } = useAuthModule()
  const { openSettings, loadSettings, loadMails: loadAddressMails } = useMailbox()
  if (!jwt.value) throw new Error('请先登录用户账户')
  const domains = openSettings.value.domainOptions || []
  const chosenDomain = domain || domains[0]?.value || ''
  if (!chosenDomain) throw new Error('当前站点未配置可用域名')

  creating.value = true
  try {
    const res = await api.auth.tempMailNewAddress(jwt.value, {
      name: name || randomName(openSettings.value.maxAddressLen || 30),
      domain: chosenDomain,
      enablePrefix: true,
      enableRandomSubdomain: !!enableRandomSubdomain,
    })
    if (res?.jwt) {
      store.jwt = res.jwt
      await loadSettings()
      await loadAddressMails(1)
    }
    await loadAddresses()
    selectedAddress.value = res.address || ''
    await loadMails(1)
    return res
  } finally {
    creating.value = false
  }
}

function openMail(mail) {
  currentMail.value = mail
}

export function useUserMailboxes() {
  return {
    addresses,
    selectedAddress,
    mails,
    totalCount,
    currentMail,
    currentPage,
    pageSize,
    totalPages,
    loadingAddresses,
    loadingMails,
    creating,
    loadAddresses,
    loadMails,
    selectAddress,
    activateAddress,
    createAddress,
    openMail,
  }
}
