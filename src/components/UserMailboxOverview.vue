<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthModule } from '@/composables/useAuthModule'
import { useMailbox } from '@/composables/useMailbox'
import { useUserMailboxes } from '@/composables/useUserMailboxes'
import { useToast } from '@/composables/useToast'
import { formatFull, hueFrom, initials, timeAgo } from '@/lib/utils'
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
  activateAddress,
  createAddress,
  openMail,
} = useUserMailboxes()
const toast = useToast()

const newName = ref('')
const newDomain = ref('')
const enableRandomSubdomain = ref(false)
const showNewBox = ref(false)

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
const currentTitle = computed(() => selectedAddress.value || '收件箱总览')
const bridgeEnabled = computed(() => auth.settings.value.temp_mail_bridge_enabled !== false)
const allInboxCount = computed(() =>
  addresses.value.reduce((sum, item) => sum + Number(item.mail_count || 0), 0)
)
const randomSubdomainAvailable = computed(() =>
  !!newDomain.value && (openSettings.value.randomSubdomainDomains || []).includes(newDomain.value)
)

function ensureDefaultDomain() {
  if (!newDomain.value && domains.value.length) newDomain.value = domains.value[0].value
}

async function refreshAll() {
  try {
    await auth.loadSettings()
    if (!openSettings.value.fetched) await loadOpenSettings()
    ensureDefaultDomain()
    await loadAddresses()
    await loadMails(1)
  } catch (e) {
    toast.error(e.message || '加载用户邮箱失败')
  }
}

async function chooseAddress(row) {
  try {
    await activateAddress(row)
    toast.success(`已切换到 ${row.address || row.name}`)
  } catch (e) {
    toast.error(e.message || '切换邮箱失败')
  }
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
  } catch (e) {
    toast.error(e.message || '创建临时邮箱失败')
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
    <aside class="mailboxes__side">
      <div class="side-head">
        <div class="logo"><span class="logo__mark">✉</span></div>
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
        <button class="mailbox-item" :class="{ 'is-active': !selectedAddress }" @click="selectAddress('')">
          <span class="mailbox-icon"><Icon name="inbox" :size="18" /></span>
          <span class="mailbox-item__main">
            <span>收件箱总览</span>
            <small>All Inboxes</small>
          </span>
          <span class="mailbox-count mono">{{ allInboxCount }}</span>
        </button>

        <button
          v-for="item in addresses"
          :key="item.id"
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
      </nav>
      </div>

      <button class="nav-btn" @click="showNewBox = true">
        <Icon name="plus" :size="18" /> 获取新的临时邮箱
      </button>

      <div class="side-spacer" />

      <button class="nav-btn nav-btn--home" @click="emit('home')">
        <Icon name="chevronL" :size="18" /> 回到首页
      </button>
      <button class="nav-btn" @click="emit('user')">
        <Icon name="key" :size="18" /> 用户账户
      </button>
      <button class="nav-btn" @click="emit('admin')">
        <Icon name="settings" :size="18" /> 管理控制台
      </button>
      <div class="side-footer"><ThemeToggle /></div>
    </aside>

    <main class="mailboxes__main">
      <header class="main-head">
        <div>
          <h1>{{ currentTitle }}</h1>
          <p>{{ selectedAddress ? '当前邮箱收件箱' : '当前用户绑定的全部临时邮箱' }}</p>
        </div>
        <button class="btn btn--ghost" :class="{ 'is-spinning': loadingMails }" @click="refreshAll">
          <Icon name="refresh" :size="16" /> 刷新
        </button>
      </header>

      <div class="mail-grid">
        <section class="mail-list">
          <div v-if="loadingMails && !mails.length" class="empty">
            <span class="spinner" /> 正在加载邮件…
          </div>
          <div v-else-if="!mails.length" class="empty">
            <Icon name="inbox" :size="38" />
            <p>暂无邮件</p>
          </div>
          <button
            v-for="mail in mails"
            :key="mail.id"
            class="mail-row"
            :class="{ 'is-active': currentMail?.id === mail.id }"
            @click="openMail(mail)"
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

        <section class="mail-reader">
          <div v-if="!currentMail" class="reader-empty">
            <Icon name="mail" :size="44" />
            <p>选择一封邮件查看详情</p>
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
</template>

<style scoped>
.mailboxes {
  height: 100%;
  display: grid;
  grid-template-columns: 340px 1fr;
  background: var(--bg);
  overflow: hidden;
}
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
  width: 40px;
  height: 40px;
  border-radius: var(--radius);
  display: grid;
  place-items: center;
  background: var(--accent);
  color: var(--accent-contrast);
  flex-shrink: 0;
}
.logo__mark { font-size:20px; line-height:1; }
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
  height:var(--header-h);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:var(--sp-4);
  padding:0 var(--sp-5);
  border-bottom:1px solid var(--border);
  background:var(--bg-elevated);
  flex-shrink:0;
}
.main-head h1 { font-size:20px; margin:0; }
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
.mail-row__body { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.mail-row__top { display:flex; justify-content:space-between; gap:var(--sp-2); }
.mail-row__from,
.mail-row__subject,
.mail-row__preview,
.mail-row__to {
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.mail-row__from { font-weight:700; font-size:14px; }
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
}
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
  .mailboxes { grid-template-columns:1fr; overflow:auto; }
  .mailboxes__side { border-right:0; border-bottom:1px solid var(--border); }
  .mailboxes__main { min-height:720px; }
  .mail-grid { grid-template-columns:1fr; }
  .mail-list { border-right:0; border-bottom:1px solid var(--border); max-height:420px; }
}
</style>
