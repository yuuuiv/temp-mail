<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthModule } from '@/composables/useAuthModule'
import { useMailbox } from '@/composables/useMailbox'
import { useUserMailboxes } from '@/composables/useUserMailboxes'
import { useToast } from '@/composables/useToast'
import { formatFull, hueFrom, initials, parseAddress, parseRawEml, timeAgo } from '@/lib/utils'
import { api } from '@/lib/api'
import Icon from './Icon.vue'
import ThemeToggle from './ThemeToggle.vue'
import Modal from './Modal.vue'

const emit = defineEmits(['admin', 'user', 'home'])

const auth = useAuthModule()
const { openSettings, loadOpenSettings } = useMailbox()
const {
  addresses,
  selectedAddress,
  mails,
  totalCount,
  currentMail,
  currentPage,
  totalPages,
  loadingAddresses,
  loadingMails,
  creating,
  loadAddresses,
  loadMails,
  selectAddress,
  createAddress,
  openMail,
} = useUserMailboxes()
const toast = useToast()

const newName = ref('')
const newDomain = ref('')
const enableRandomSubdomain = ref(false)
const showNewBox = ref(false)
const navOpen = ref(false)
const showForwarding = ref(false)
const forwardingAddress = ref('')
const forwardingBusy = ref(false)
const forwardingAddressIds = ref([])
const headerHidden = ref(false)
const mobileReaderOpen = ref(false)
const starredMailIds = ref(new Set())
const starredMailAddresses = ref({})
const blockedSenders = ref(new Set())
const sentMails = ref([])
const activeFolder = ref('inbox')
const overviewExpanded = ref(false)
let lastMailListScrollTop = 0

function genRandomName() {
  const words = ['quiet', 'swift', 'silver', 'green', 'nova', 'pixel', 'river', 'cloud', 'mist', 'ember']
  const animals = ['otter', 'fox', 'lynx', 'panda', 'raven', 'koala', 'mink', 'heron', 'wolf', 'hawk']
  const max = openSettings.value.maxAddressLen || 30
  return `${words[Math.floor(Math.random() * words.length)]}-${animals[Math.floor(Math.random() * animals.length)]}-${Math.floor(1000 + Math.random() * 9000)}`.slice(0, max)
}

function fillRandomName() {
  newName.value = genRandomName()
}

const domains = computed(() => openSettings.value.domainOptions || [])
const currentTitle = computed(() => {
  const folderNames = { inbox: '收件箱', sent: '发件箱', starred: '星标邮件' }
  const overviewNames = { inbox: '收件箱总览', sent: '发件箱总览', starred: '星标邮件总览' }
  return selectedAddress.value
    ? `${selectedAddress.value} · ${folderNames[activeFolder.value] || '收件箱'}`
    : overviewNames[activeFolder.value] || '收件箱总览'
})
const bridgeEnabled = computed(() => auth.settings.value.temp_mail_bridge_enabled !== false)
const allInboxCount = computed(() =>
  addresses.value.reduce((sum, item) => sum + Number(item.mail_count || 0), 0)
)
const allSentCount = computed(() =>
  addresses.value.reduce((sum, item) => sum + Number(item.send_count || 0), 0)
)
const allForwardingSelected = computed(() =>
  addresses.value.length > 0 && forwardingAddressIds.value.length === addresses.value.length
)
const randomSubdomainAvailable = computed(() =>
  !!newDomain.value && (openSettings.value.randomSubdomainDomains || []).includes(newDomain.value)
)
const selectedAddressRow = computed(() =>
  addresses.value.find((item) => item.address === selectedAddress.value || item.name === selectedAddress.value)
)
const accountStorageKey = computed(() => auth.user.value?.user_email || auth.user.value?.user_name || 'anonymous')
const visibleMails = computed(() => {
  if (activeFolder.value === 'sent') return sentMails.value
  const list = activeFolder.value === 'starred'
    ? mails.value.filter((mail) => starredMailIds.value.has(mail.id))
    : mails.value
  return list.filter((mail) => !blockedSenders.value.has(mail.fromEmail))
})
const starredTotalCount = computed(() => starredMailIds.value.size)

function starredCountForAddress(address) {
  return Object.values(starredMailAddresses.value).filter((value) => value === address).length
}

function reconcileStarredMailAddresses() {
  const next = { ...starredMailAddresses.value }
  for (const mail of mails.value) {
    if (starredMailIds.value.has(mail.id) && !next[mail.id]) next[mail.id] = mail.to
  }
  starredMailAddresses.value = next
}

function loadMailPreferences() {
  try {
    const raw = JSON.parse(localStorage.getItem(`tm-mail-preferences:${accountStorageKey.value}`) || '{}')
    starredMailIds.value = new Set(raw.starred || [])
    starredMailAddresses.value = raw.starredAddresses || {}
    blockedSenders.value = new Set(raw.blocked || [])
  } catch {
    starredMailIds.value = new Set()
    starredMailAddresses.value = {}
    blockedSenders.value = new Set()
  }
}

function saveMailPreferences() {
  localStorage.setItem(`tm-mail-preferences:${accountStorageKey.value}`, JSON.stringify({
    starred: [...starredMailIds.value],
    starredAddresses: starredMailAddresses.value,
    blocked: [...blockedSenders.value],
  }))
}

function ensureDefaultDomain() {
  if (!newDomain.value && domains.value.length) newDomain.value = domains.value[0].value
}

async function refreshAll() {
  try {
    await auth.loadSettings()
    loadMailPreferences()
    if (!openSettings.value.fetched) await loadOpenSettings()
    ensureDefaultDomain()
    await loadAddresses()
    await loadMails(1)
    reconcileStarredMailAddresses()
  } catch (e) {
    toast.error(e.message || '加载用户邮箱失败')
  }
}

function openUserMail(mail) {
  openMail(mail)
  mobileReaderOpen.value = true
}

function closeMobileReader() {
  mobileReaderOpen.value = false
}

function toggleStar(mail) {
  const next = new Set(starredMailIds.value)
  const addresses = { ...starredMailAddresses.value }
  if (next.has(mail.id)) {
    next.delete(mail.id)
    delete addresses[mail.id]
  } else {
    next.add(mail.id)
    addresses[mail.id] = mail.to
  }
  starredMailIds.value = next
  starredMailAddresses.value = addresses
  saveMailPreferences()
}

function blockSender(mail) {
  if (!mail?.fromEmail || !confirm(`确认封锁 ${mail.fromEmail}？该发件人将不再显示在此用户邮箱一览中。`)) return
  const next = new Set(blockedSenders.value)
  next.add(mail.fromEmail)
  blockedSenders.value = next
  saveMailPreferences()
  currentMail.value = null
  mobileReaderOpen.value = false
  toast.success('已封锁该发件人')
}

function forwardMail(mail) {
  const target = prompt('转发到哪个邮箱？')?.trim()
  if (!target) return
  const subject = `Fwd: ${mail.subject || ''}`
  const body = `转发邮件\n\nFrom: ${mail.fromEmail}\nTo: ${mail.to}\nDate: ${formatFull(mail.createdAt)}\nSubject: ${mail.subject}\n\n${mail.text || ''}`
  location.href = `mailto:${encodeURIComponent(target)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

async function deleteCurrentMail() {
  const mail = currentMail.value
  const row = addresses.value.find((item) => (item.address || item.name) === mail?.to) || selectedAddressRow.value
  if (!mail || !row || !confirm('删除后不可恢复，确认删除这封邮件？')) return
  try {
    await api.auth.tempMailDeleteAddressMail(auth.jwt.value, row.id, mail.id)
    mails.value = mails.value.filter((item) => item.id !== mail.id)
    totalCount.value = Math.max(0, totalCount.value - 1)
    currentMail.value = null
    mobileReaderOpen.value = false
    toast.success('已删除邮件')
  } catch (e) {
    toast.error(e.message || '删除邮件失败')
  }
}

async function chooseAddress(row) {
  await selectAddress(row.address || row.name || '')
  activeFolder.value = 'inbox'
  navOpen.value = false
  headerHidden.value = false
}

async function chooseOverview(folder) {
  await selectAddress('')
  activeFolder.value = folder
  currentMail.value = null
  mobileReaderOpen.value = false
  navOpen.value = false
  headerHidden.value = false
  if (folder === 'sent') await loadSentMails()
}

async function selectFolder(folder) {
  activeFolder.value = folder
  currentMail.value = null
  mobileReaderOpen.value = false
  if (folder === 'sent') await loadSentMails()
}

async function loadSentMails() {
  try {
    const res = await api.auth.tempMailSendbox(auth.jwt.value, { limit: 100, offset: 0, address: selectedAddress.value })
    sentMails.value = await Promise.all((res.results || []).map(async (row) => {
      const parsed = row.raw ? await parseRawEml(row.raw).catch(() => ({})) : {}
      const from = parsed.source || parsed.from || row.address || ''
      const { name, email } = parseAddress(from)
      return {
        ...row, ...parsed, id: `sent-${row.id}`, subject: parsed.subject || row.subject || '(无主题)',
        fromName: name || email || row.address || '我', fromEmail: email || from,
        preview: (parsed.text || '').replace(/\s+/g, ' ').trim().slice(0, 140), text: parsed.text || '', html: parsed.html || '',
        to: parsed.to || row.to_mail || '', createdAt: row.created_at || Date.now(),
      }
    }))
  } catch (e) {
    toast.error(e.message || '加载发件箱失败')
  }
}

function onMailListScroll(event) {
  const top = event.currentTarget.scrollTop
  if (top <= 8) {
    headerHidden.value = false
  } else if (top > lastMailListScrollTop + 6) {
    headerHidden.value = true
  } else if (top < lastMailListScrollTop - 6) {
    headerHidden.value = false
  }
  lastMailListScrollTop = top
}

async function handleCreate() {
  try {
    const finalName = newName.value.trim() || genRandomName()
    const res = await createAddress({
      name: finalName,
      domain: newDomain.value,
      enableRandomSubdomain: enableRandomSubdomain.value,
    })
    newName.value = ''
    showNewBox.value = false
    toast.success(`已获取新的临时邮箱：${res.address}`)
    emit('home')
  } catch (e) {
    toast.error(e.message || '创建临时邮箱失败')
  }
}

async function openForwarding() {
  if (!addresses.value.length) {
    toast.warning('请先获取至少一个临时邮箱')
    return
  }
  forwardingAddress.value = ''
  forwardingAddressIds.value = []
  showForwarding.value = true
}

function toggleAllForwardingAddresses() {
  forwardingAddressIds.value = allForwardingSelected.value ? [] : addresses.value.map((row) => row.id)
}

function toggleForwardingAddress(addressId) {
  const next = new Set(forwardingAddressIds.value)
  if (next.has(addressId)) next.delete(addressId)
  else next.add(addressId)
  forwardingAddressIds.value = [...next]
}

async function saveForwarding() {
  const selectedRows = addresses.value.filter((row) => forwardingAddressIds.value.includes(row.id))
  if (!selectedRows.length) {
    toast.warning('请选择至少一个邮箱')
    return
  }
  const targets = forwardingAddress.value.split(',').map((value) => value.trim()).filter(Boolean)
  forwardingBusy.value = true
  try {
    const rules = targets.map((forward) => ({ domains: [], sourcePatterns: [], sourceMatchMode: 'any', forward }))
    await Promise.all(selectedRows.map((row) =>
      api.auth.saveTempMailAddressForwardingRules(auth.jwt.value, row.id, rules)
    ))
    toast.success(`已为 ${selectedRows.length} 个邮箱保存转发规则`)
    showForwarding.value = false
  } catch (e) {
    toast.error(e.message || '保存转发规则失败')
  } finally {
    forwardingBusy.value = false
  }
}

function prev() {
  if (currentPage.value > 1) loadMails(currentPage.value - 1)
}

function next() {
  if (currentPage.value < totalPages.value) loadMails(currentPage.value + 1)
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

onMounted(refreshAll)
</script>

<template>
  <div class="mailboxes">
    <header class="mobile-head">
      <button class="icon-btn" aria-label="打开邮箱列表" @click="navOpen = true">
        <Icon name="menu" :size="21" />
      </button>
      <div>
        <strong>{{ currentTitle }}</strong>
        <small>{{ selectedAddress ? '当前邮箱' : '收件箱总览' }}</small>
      </div>
      <button class="icon-btn" aria-label="刷新" @click="refreshAll">
        <Icon name="refresh" :size="18" />
      </button>
    </header>
    <div v-if="navOpen" class="nav-scrim" @click="navOpen = false" />
    <aside class="mailboxes__side" :class="{ 'is-open': navOpen }">
      <div class="side-head">
        <div class="logo" aria-label="Temp Mail">
          <span class="logo__mark">TM</span>
          <span class="logo__spark" />
        </div>
        <div class="side-head__text">
          <div class="side-title">用户邮箱一览</div>
          <div class="side-sub">
            <span class="side-user mono">{{ auth.user.value?.user_email || auth.user.value?.user_name || 'Temp Mail' }}</span>
            <span class="side-count-badge mono">{{ addresses.length }} 个邮箱</span>
          </div>
        </div>
      </div>

      <div v-if="!bridgeEnabled" class="notice danger">
        账户服务未启用 Temp Mail 桥接。
      </div>

      <div class="mailbox-nav-wrap">
      <nav class="mailbox-nav">
        <div class="mailbox-group">
          <div class="mailbox-item" :class="{ 'is-active': !selectedAddress && activeFolder === 'inbox' }">
            <button class="mailbox-item__select" @click="chooseOverview('inbox')">
              <span class="mailbox-icon"><Icon name="inbox" :size="18" /></span>
              <span class="mailbox-item__main">
                <span>总览</span>
                <small>All Mailboxes</small>
              </span>
              <span class="mailbox-count mono">{{ allInboxCount }}</span>
            </button>
            <button class="mailbox-expand" :class="{ 'is-open': overviewExpanded }" :aria-expanded="overviewExpanded" aria-label="展开总览文件夹" @click="overviewExpanded = !overviewExpanded">
              <Icon name="chevronR" :size="16" />
            </button>
          </div>
          <div v-if="overviewExpanded" class="mailbox-folders mailbox-folders--overview">
            <button :class="{ 'is-active': !selectedAddress && activeFolder === 'inbox' }" @click="chooseOverview('inbox')"><Icon name="inbox" :size="15" /> 收件箱总览 <small>{{ allInboxCount }}</small></button>
            <button :class="{ 'is-active': !selectedAddress && activeFolder === 'sent' }" @click="chooseOverview('sent')"><Icon name="send" :size="15" /> 发件箱总览 <small>{{ allSentCount }}</small></button>
            <button :class="{ 'is-active': !selectedAddress && activeFolder === 'starred' }" @click="chooseOverview('starred')"><Icon name="star" :size="15" /> 星标邮件总览 <small>{{ starredTotalCount }}</small></button>
          </div>
        </div>

        <template v-for="item in addresses" :key="item.id">
          <button
            class="mailbox-item"
            :class="{ 'is-active': selectedAddress === item.address }"
            @click="chooseAddress(item)"
          >
            <span class="mailbox-icon"><Icon name="mail" :size="18" /></span>
            <span class="mailbox-item__main">
              <span class="mono">{{ item.address }}</span>
              <small>{{ item.mail_count }} 收件 · {{ item.send_count }} 发件</small>
            </span>
            <Icon name="chevronR" :size="16" />
          </button>
          <div v-if="selectedAddress === (item.address || item.name)" class="mailbox-folders">
            <button :class="{ 'is-active': activeFolder === 'inbox' }" @click="selectFolder('inbox')"><Icon name="inbox" :size="15" /> 收件箱</button>
            <button :class="{ 'is-active': activeFolder === 'sent' }" @click="selectFolder('sent')"><Icon name="send" :size="15" /> 发件箱</button>
            <button :class="{ 'is-active': activeFolder === 'starred' }" @click="selectFolder('starred')"><Icon name="star" :size="15" /> 星标邮件 <small>{{ starredCountForAddress(item.address || item.name) }}</small></button>
          </div>
        </template>
      </nav>
      </div>

      <button class="nav-btn" @click="showNewBox = true">
        <Icon name="plus" :size="18" /> 获取新的临时邮箱
      </button>
      <button class="nav-btn" :disabled="forwardingBusy" @click="openForwarding">
        <Icon name="send" :size="18" /> 邮件规则与转发
      </button>

      <div class="side-spacer" />

      <button class="nav-btn nav-btn--home" @click="navOpen = false; emit('home')">
        <Icon name="chevronL" :size="18" /> 返回
      </button>
      <button class="nav-btn" @click="navOpen = false; emit('user')">
        <Icon name="key" :size="18" /> 用户账户
      </button>
      <button class="nav-btn" @click="navOpen = false; emit('admin')">
        <Icon name="settings" :size="18" /> 控制台
      </button>
      <div class="side-footer"><ThemeToggle /></div>
    </aside>

    <main class="mailboxes__main">
      <header class="main-head" :class="{ 'is-hidden': headerHidden }">
        <div class="main-head__title">
          <span class="main-head__icon"><Icon :name="selectedAddress ? 'mail' : 'inbox'" :size="18" /></span>
          <div>
          <h1>{{ currentTitle }}</h1>
          <p>{{ selectedAddress ? '当前邮箱收件箱' : '当前用户绑定的全部临时邮箱' }}</p>
          </div>
        </div>
        <button class="btn btn--ghost" :class="{ 'is-spinning': loadingMails }" @click="refreshAll">
          <Icon name="refresh" :size="16" /> 刷新
        </button>
      </header>

      <div class="mail-grid">
        <section class="mail-list" @scroll="onMailListScroll">
          <div v-if="loadingMails && !mails.length" class="empty">
            <span class="spinner" /> 正在加载邮件…
          </div>
          <div v-else-if="!visibleMails.length" class="empty">
            <Icon name="inbox" :size="38" />
            <p>{{ activeFolder === 'sent' ? '暂无已发送邮件' : activeFolder === 'starred' ? '暂无星标邮件' : '暂无邮件' }}</p>
          </div>
          <button
            v-for="mail in visibleMails"
            :key="mail.id"
            class="mail-row"
            :class="{ 'is-active': currentMail?.id === mail.id }"
            @click="openUserMail(mail)"
          >
            <span
              class="avatar mono"
              :style="{
                background: `hsl(${hueFrom(mail.fromEmail)} 24% 62% / 0.22)`,
                color: `hsl(${hueFrom(mail.fromEmail)} 30% 38%)`,
              }"
            >
              {{ initials(mail.fromName || mail.fromEmail) }}
            </span>
            <span v-if="starredMailIds.has(mail.id)" class="mail-star" title="已星标">
              <Icon name="star" :size="13" />
            </span>
            <span class="mail-row__body">
              <span class="mail-row__top">
                <span class="mail-row__from">{{ mail.fromName || mail.fromEmail }}</span>
                <span class="mono dim">{{ timeAgo(mail.createdAt) }}</span>
              </span>
              <span class="mail-row__subject">{{ mail.subject }}</span>
              <span class="mail-row__preview">{{ mail.preview }}</span>
              <span v-if="!selectedAddress" class="mail-row__to mono">{{ mail.to }}</span>
            </span>
          </button>
          <footer v-if="totalPages > 1" class="pager">
            <button class="icon-btn" :disabled="currentPage <= 1" @click="prev">
              <Icon name="chevronL" :size="18" />
            </button>
            <span class="mono">{{ currentPage }} / {{ totalPages }}</span>
            <button class="icon-btn" :disabled="currentPage >= totalPages" @click="next">
              <Icon name="chevronR" :size="18" />
            </button>
          </footer>
        </section>

        <section class="mail-reader" :class="{ 'is-mobile-open': mobileReaderOpen }">
          <header v-if="currentMail" class="mobile-reader-head">
            <button class="icon-btn" aria-label="返回邮件列表" @click="closeMobileReader"><Icon name="back" :size="21" /></button>
            <div class="mobile-reader-actions">
              <button class="icon-btn" :class="{ 'is-starred': starredMailIds.has(currentMail.id) }" title="星标" @click="toggleStar(currentMail)"><Icon name="star" :size="19" /></button>
              <button class="icon-btn" title="转发" @click="forwardMail(currentMail)"><Icon name="send" :size="19" /></button>
              <button class="icon-btn" title="封锁发件人" @click="blockSender(currentMail)"><Icon name="ban" :size="19" /></button>
              <button class="icon-btn icon-btn--danger" title="删除（不可恢复）" @click="deleteCurrentMail"><Icon name="trash" :size="19" /></button>
            </div>
          </header>
          <div v-if="!currentMail" class="reader-empty">
            <Icon name="mail" :size="44" />
            <p>从列表选择邮件即可阅读</p>
          </div>
          <template v-else>
            <div class="reader-meta">
              <h2>{{ currentMail.subject }}</h2>
              <p class="mono dim">From: {{ currentMail.fromEmail }}</p>
              <p class="mono dim">To: {{ currentMail.to }}</p>
              <p class="mono dim">{{ formatFull(currentMail.createdAt) }}</p>
            </div>
            <iframe
              class="reader-frame"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
              :srcdoc="currentMail.html || `<pre>${escapeHtml(currentMail.text || '(此邮件无正文内容)')}</pre>`"
              title="邮件内容"
            />
          </template>
        </section>
      </div>
    </main>
  </div>

  <Modal v-model:show="showNewBox" title="获取新的临时邮箱" size="sm">
    <div class="new-box-modal">
      <div class="addr-row">
        <input
          v-if="!openSettings.disableCustomAddressName"
          v-model="newName"
          class="field mono"
          type="text"
          placeholder="留空则随机名称"
          :maxlength="openSettings.maxAddressLen || 30"
        />
        <button v-if="!openSettings.disableCustomAddressName" type="button" class="btn btn--ghost btn--sm" @click="fillRandomName">随机名称</button>
      </div>
      <select v-model="newDomain" class="field mono" @focus="ensureDefaultDomain">
        <option v-for="item in domains" :key="item.value" :value="item.value">
          {{ item.label }}
        </option>
      </select>
      <label v-if="randomSubdomainAvailable" class="switch">
        <input v-model="enableRandomSubdomain" type="checkbox" />
        <span>随机子域名</span>
      </label>
      <button class="btn btn--primary btn--block" :disabled="creating || !auth.isLoggedIn.value" @click="handleCreate">
        {{ creating ? '创建中…' : '创建' }}
      </button>
    </div>
    <template #footer>
      <button class="btn btn--ghost" @click="showNewBox = false">取消</button>
    </template>
  </Modal>

  <Modal v-model:show="showForwarding" title="邮件规则与转发" size="sm">
    <div class="new-box-modal">
      <label>应用到</label>
      <label class="check-row">
        <input type="checkbox" :checked="allForwardingSelected" @change="toggleAllForwardingAddresses" />
        <strong>全部邮箱</strong>
      </label>
      <div class="forwarding-addresses">
        <label v-for="row in addresses" :key="row.id" class="check-row">
          <input type="checkbox" :checked="forwardingAddressIds.includes(row.id)" @change="toggleForwardingAddress(row.id)" />
          <code class="mono">{{ row.address || row.name }}</code>
        </label>
      </div>
      <label>转发到（多个地址用逗号分隔）</label>
      <input v-model="forwardingAddress" class="field mono" type="text" placeholder="forward@example.com" />
      <p class="hint">会对选中的邮箱应用相同规则；留空并保存即可停止它们的所有转发。</p>
    </div>
    <template #footer>
      <button class="btn btn--ghost" :disabled="forwardingBusy" @click="showForwarding = false">取消</button>
      <button class="btn btn--primary" :disabled="forwardingBusy" @click="saveForwarding">
        {{ forwardingBusy ? '保存中…' : '保存' }}
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.mailboxes {
  height: 100%;
  display: grid;
  grid-template-columns: 340px 1fr;
  background: var(--bg);
  overflow: hidden;
}
.mobile-head { display:none; }
.mailboxes__side {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  min-width: 0;
  padding: var(--sp-4);
  border-right: 1px solid var(--border);
  background: var(--sidebar-bg);
  overflow-y: auto;
}
.side-head { display:flex; align-items:center; gap:var(--sp-3); padding-bottom:var(--sp-2); }
.logo {
  position:relative;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, var(--accent), var(--accent-strong));
  color: var(--accent-contrast);
  flex-shrink: 0;
  box-shadow: 0 7px 16px color-mix(in srgb, var(--accent) 28%, transparent);
}
.logo__mark { font-family:var(--font-mono); font-size:14px; font-weight:800; letter-spacing:-.12em; transform:translateX(-1px); }
.logo__spark { position:absolute; top:7px; right:7px; width:5px; height:5px; border-radius:50%; background:var(--surface); opacity:.9; }
.side-head__text { min-width:0; }
.side-title { font-family:var(--font-display); font-weight:700; font-size:17px; }
.side-sub { display:flex; align-items:center; gap:var(--sp-2); margin-top:2px; }
.side-user { color:var(--text-faint); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.side-count-badge {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--accent-strong);
  background: var(--accent-soft);
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
}
.notice {
  padding: var(--sp-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 13px;
}
.notice.danger { color:var(--danger); border-color:var(--danger); background:var(--danger-soft); }
.field {
  width:100%;
  padding:var(--sp-3);
  border:1px solid var(--border-strong);
  border-radius:var(--radius);
  background:var(--surface);
  color:var(--text);
  font-size:14px;
}
.field:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  background: var(--surface-2);
}
.mailbox-nav-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0 calc(var(--sp-4) * -1);
  padding: 0 var(--sp-4);
}
.mailbox-nav { display:flex; flex-direction:column; gap:4px; }
.mailbox-item {
  display:flex;
  align-items:center;
  gap:var(--sp-3);
  width:100%;
  padding:var(--sp-3);
  border:1px solid transparent;
  border-radius:var(--radius);
  background:transparent;
  color:var(--text-muted);
  text-align:left;
}
.mailbox-item:hover,
.mailbox-item.is-active { background:var(--surface-hover); color:var(--text); border-color:var(--border); }
.mailbox-item__select {
  display:flex;
  align-items:center;
  gap:var(--sp-3);
  min-width:0;
  flex:1;
  padding:0;
  border:0;
  background:transparent;
  color:inherit;
  text-align:left;
}
.mailbox-expand {
  display:grid;
  place-items:center;
  width:28px;
  height:28px;
  padding:0;
  border:0;
  border-radius:var(--radius-sm);
  background:transparent;
  color:var(--text-faint);
}
.mailbox-expand:hover { background:var(--surface-2); color:var(--text); }
.mailbox-expand.is-open :deep(svg) { transform:rotate(90deg); }
.mailbox-expand :deep(svg) { transition:transform var(--dur); }
.mailbox-icon {
  display:grid;
  place-items:center;
  width:34px;
  height:34px;
  border-radius:var(--radius-pill);
  color:var(--accent-contrast);
  background:var(--accent);
  flex-shrink:0;
}
.mailbox-item__main { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.mailbox-item__main span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mailbox-item__main small { color:var(--text-faint); font-size:12px; }
.mailbox-count { color:var(--text-faint); }
.mailbox-folders { display:grid; gap:3px; margin:-2px 0 var(--sp-2) calc(34px + var(--sp-3)); padding-left:var(--sp-3); border-left:1px solid var(--border); }
.mailbox-folders button { display:flex; align-items:center; gap:7px; padding:6px 8px; border:0; border-radius:var(--radius-sm); background:transparent; color:var(--text-faint); font-size:12px; text-align:left; }
.mailbox-folders button:hover, .mailbox-folders button.is-active { background:var(--accent-soft); color:var(--accent-strong); }
.mailbox-folders small { margin-left:auto; font-size:11px; color:inherit; }
.new-box-modal {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.addr-row {
  display: flex;
  gap: var(--sp-2);
}
.addr-row .field { flex: 1; min-width: 0; }
.btn--sm {
  padding: var(--sp-2) var(--sp-3);
  font-size: 13px;
  flex-shrink: 0;
}
.switch { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-muted); }
.hint { margin:0; color:var(--text-faint); font-size:13px; line-height:1.5; }
.check-row { display:flex; align-items:center; gap:8px; color:var(--text-muted); font-size:13px; cursor:pointer; }
.check-row input { accent-color:var(--accent); }
.forwarding-addresses { display:grid; gap:6px; max-height:180px; overflow:auto; padding:var(--sp-2); border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--surface-2); }
.btn {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  padding:var(--sp-3) var(--sp-4);
  border:1px solid transparent;
  border-radius:var(--radius);
  font-weight:600;
  font-family:var(--font-display);
  font-size:14px;
}
.btn--block { width:100%; }
.btn--primary { background:var(--accent); color:var(--accent-contrast); }
.btn--ghost { background:var(--surface-2); color:var(--text-2); border-color:var(--border); }
.btn:disabled { opacity:.6; cursor:not-allowed; }
.side-spacer { min-height:var(--sp-3); }
.nav-btn {
  display:flex;
  align-items:center;
  gap:var(--sp-3);
  padding:var(--sp-3);
  border:1px solid var(--border);
  border-radius:var(--radius);
  background:transparent;
  color:var(--text-muted);
}
.nav-btn:hover { background:var(--surface-hover); color:var(--text); }
.nav-btn--home {
  color: var(--accent-strong);
  border-color: var(--accent);
  font-weight: 600;
}
.nav-btn--home:hover {
  background: var(--accent-soft);
  color: var(--accent-strong);
}
.side-footer { padding-top:var(--sp-2); border-top:1px solid var(--border); }
.mailboxes__main {
  min-width:0;
  display:flex;
  flex-direction:column;
  overflow:hidden;
}
.main-head {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:var(--sp-4);
  min-height:var(--header-h);
  padding:0 var(--sp-5);
  border-bottom:1px solid var(--border);
  background:var(--sidebar-bg);
  flex-shrink:0;
  overflow:hidden;
  transition:min-height var(--dur) var(--ease), padding var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.main-head.is-hidden { min-height:0; height:0; padding-top:0; padding-bottom:0; border-bottom-color:transparent; }
.main-head__title { display:flex; align-items:center; gap:var(--sp-3); min-width:0; }
.main-head__title > div { min-width:0; }
.main-head__icon { display:grid; place-items:center; width:34px; height:34px; border-radius:var(--radius-pill); color:var(--accent-contrast); background:var(--accent); flex-shrink:0; }
.main-head h1 { font-size:20px; margin:0; }
.main-head h1, .main-head p { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.main-head p { margin:4px 0 0; color:var(--text-faint); font-size:13px; }
.mail-grid {
  flex:1;
  min-height:0;
  display:grid;
  grid-template-columns:minmax(320px, 42%) 1fr;
}
.mail-list {
  min-width:0;
  overflow-y:auto;
  border-right:1px solid var(--border);
  background:var(--bg-elevated);
  padding:var(--sp-2);
}
.mail-row {
  position:relative;
  display:flex;
  gap:var(--sp-3);
  width:100%;
  padding:var(--sp-3);
  border:1px solid transparent;
  border-radius:var(--radius);
  background:transparent;
  text-align:left;
}
.mail-row:hover,
.mail-row.is-active { background:var(--surface-hover); border-color:var(--border); }
.avatar {
  flex-shrink:0;
  width:40px;
  height:40px;
  display:grid;
  place-items:center;
  border-radius:var(--radius);
  font-size:13px;
  font-weight:600;
}
.mail-star {
  position:absolute;
  top:7px;
  left:7px;
  display:grid;
  place-items:center;
  width:20px;
  height:20px;
  border:1px solid color-mix(in srgb, #c58a24 38%, var(--border));
  border-radius:var(--radius-pill);
  background:color-mix(in srgb, #fff4cf 92%, var(--surface));
  color:#b57c12;
  box-shadow:0 2px 6px color-mix(in srgb, #8f6210 20%, transparent);
}
.mail-row__body { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.mail-row__top { display:flex; justify-content:space-between; gap:var(--sp-2); min-width:0; }
.mail-row__from,
.mail-row__subject,
.mail-row__preview,
.mail-row__to {
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.mail-row__from { flex:1 1 auto; min-width:0; font-weight:700; font-size:14px; }
.mail-row__top .dim { flex:0 0 auto; white-space:nowrap; }
.mail-row__subject { color:var(--text-2); font-size:13.5px; }
.mail-row__preview,
.mail-row__to,
.dim { color:var(--text-faint); font-size:12px; }
.empty,
.reader-empty {
  min-height:260px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:var(--sp-2);
  color:var(--text-faint);
  text-align:center;
}
.pager {
  display:flex;
  align-items:center;
  justify-content:center;
  gap:var(--sp-3);
  padding:var(--sp-3);
}
.icon-btn {
  display:grid;
  place-items:center;
  width:36px;
  height:36px;
  border:0;
  border-radius:var(--radius-sm);
  background:transparent;
  color:var(--text-2);
}
.icon-btn:hover { background:var(--surface-hover); }
.mail-reader {
  min-width:0;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  background:var(--bg);
}
.mobile-reader-head {
  display:flex;
  align-items:center;
  min-height:52px;
  padding:0 var(--sp-3);
  border-bottom:1px solid var(--border);
  background:var(--sidebar-bg);
  flex-shrink:0;
}
.mobile-reader-head > .icon-btn:first-child { display:none; }
.mobile-reader-actions { display:flex; align-items:center; gap:2px; margin-left:auto; }
.icon-btn.is-starred { color:#c58a24; }
.icon-btn.is-starred :deep(svg), .mail-star :deep(svg) { fill:currentColor; }
.icon-btn--danger:hover { background:var(--danger-soft); color:var(--danger); }
.reader-meta {
  padding:var(--sp-5);
  border-bottom:1px solid var(--border);
  background:var(--surface);
}
.reader-meta h2 { margin:0 0 var(--sp-3); font-size:22px; }
.reader-meta p { margin:4px 0; }
.reader-frame {
  flex:1;
  width:100%;
  border:0;
  background:var(--bg);
}
.spinner {
  width:20px;
  height:20px;
  border:3px solid var(--border-strong);
  border-top-color:var(--accent);
  border-radius:50%;
  animation:spin .7s linear infinite;
}
.is-spinning svg { animation:spin .7s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

@media (max-width: 920px) {
  .mailboxes { display:flex; flex-direction:column; overflow:hidden; }
  .mobile-head {
    display:flex;
    align-items:center;
    gap:var(--sp-3);
    height:var(--header-h);
    padding:0 var(--sp-3);
    border-bottom:1px solid var(--border);
    background:var(--bg-elevated);
    flex-shrink:0;
  }
  .mobile-head > div { flex:1; min-width:0; display:flex; flex-direction:column; }
  .mobile-head strong,
  .mobile-head small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .mobile-head small { color:var(--text-faint); font-size:12px; }
  .mailboxes__side {
    position:fixed;
    top:0;
    bottom:0;
    left:0;
    z-index:60;
    width:min(86vw, 340px);
    border-right:1px solid var(--border);
    border-bottom:0;
    transform:translateX(-105%);
    transition:transform var(--dur) var(--ease);
    box-shadow:var(--shadow-lg);
  }
  .mailboxes__side.is-open { transform:translateX(0); }
  .nav-scrim {
    position:fixed;
    inset:0;
    z-index:50;
    background:var(--scrim);
    backdrop-filter:blur(2px);
  }
  .mailboxes__main { flex:1; min-height:0; }
  .main-head { display:none; }
  .mail-grid { display:block; overflow:hidden; }
  .mail-list { height:100%; border-right:0; border-bottom:0; max-height:none; }
  .mail-reader { min-height:0; }
  .mail-reader:not(.is-mobile-open) { display:none; }
  .mail-reader.is-mobile-open {
    position:fixed;
    inset:0;
    z-index:80;
    display:flex;
    height:100dvh;
    min-height:100dvh;
  }
  .mobile-reader-head {
    display:flex;
    align-items:center;
    min-height:56px;
    padding:0 var(--sp-2);
    border-bottom:1px solid var(--border);
    background:var(--sidebar-bg);
    flex-shrink:0;
  }
  .mobile-reader-head > .icon-btn:first-child { display:grid; }
  .reader-empty { display:none; }
  .reader-meta { padding:var(--sp-4); }
  .reader-meta h2 { font-size:20px; overflow-wrap:anywhere; }
  .reader-frame { min-height:0; }
}
</style>
