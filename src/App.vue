<script setup>
import { onMounted, ref, watch } from 'vue'
import { useMailbox } from '@/composables/useMailbox'
import { useToast } from '@/composables/useToast'
import { useAdmin } from '@/composables/useAdmin'
import { useAuthGate } from '@/composables/useAuthGate'
import { useAuthModule } from '@/composables/useAuthModule'
import { api, store } from '@/lib/api'

import Sidebar from '@/components/Sidebar.vue'
import MailList from '@/components/MailList.vue'
import MailReader from '@/components/MailReader.vue'
import ComposeMail from '@/components/ComposeMail.vue'
import AddressCreator from '@/components/AddressCreator.vue'
import SentBoxList from '@/components/SentBoxList.vue'
import AccountPanel from '@/components/AccountPanel.vue'
import WebhookSettingsPanel from '@/components/WebhookSettingsPanel.vue'
import AttachmentPanel from '@/components/AttachmentPanel.vue'
import AboutPanel from '@/components/AboutPanel.vue'
import ToastHost from '@/components/ToastHost.vue'
import Icon from '@/components/Icon.vue'
import SiteAuthModal from '@/components/SiteAuthModal.vue'
import AdminAuthModal from '@/components/AdminAuthModal.vue'
import AdminConsole from '@/components/admin/AdminConsole.vue'
import UserPanel from '@/components/UserPanel.vue'

const appRevision = __APP_REVISION__
import UserMailboxOverview from '@/components/UserMailboxOverview.vue'

const {
  openSettings,
  settings,
  hasAddress,
  currentMail,
  loadOpenSettings,
  loadSettings,
  loadMails,
  loadMockData,
} = useMailbox()
const { adminMode, adminAuthed, enterAdmin, setAdminPassword } = useAdmin()
const { showSiteAuth, showAdminAuth, openAdminAuth } = useAuthGate()
const authModule = useAuthModule()
const toast = useToast()

const booting = ref(true)
const sidebarOpen = ref(false) // 移动端抽屉
const readerOpen = ref(false) // 移动端阅读全屏
const userOpen = ref(false)
const activeView = ref('inbox')
const repoExpanded = ref(false)
const tempMode = ref(false)

function handleAdmin() {
  sidebarOpen.value = false
  if (adminAuthed.value) enterAdmin()
  else openAdminAuth()
}

async function boot() {
  // URL 参数自动登录：?jwt=xxx 直接设置地址凭证，?auth=xxx 设置站点密码
  const sp = new URLSearchParams(location.search)
  const urlJwt = sp.get('jwt')
  const urlAuth = sp.get('auth')
  tempMode.value = location.pathname === '/temp' || location.pathname === '/temp/'
  if (location.pathname === '/temp') history.replaceState(null, '', '/temp/')
  if (urlJwt) {
    store.jwt = urlJwt
    tempMode.value = true
    history.replaceState(null, '', '/temp/' + (urlAuth ? `?auth=${encodeURIComponent(urlAuth)}` : ''))
  }
  if (urlAuth) store.auth = urlAuth
  if (location.pathname.startsWith('/auth/callback/')) {
    const loginType = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '')
    try {
      await authModule.handleCallback(loginType, sp)
      toast.success('用户登录成功')
      tempMode.value = false
      history.replaceState(null, '', '/user')
      openUserMailboxes()
    } catch (e) {
      toast.error(e.message || '用户登录失败')
    } finally {
      history.replaceState(null, '', '/user')
    }
  } else if (location.pathname === '/auth/complete') {
    try {
      await authModule.exchangeAuthCode(sp.get('code') || '')
      toast.success('用户登录成功')
      tempMode.value = false
      history.replaceState(null, '', '/user')
      openUserMailboxes()
    } catch (e) {
      toast.error(e.message || '用户登录失败')
    } finally {
      history.replaceState(null, '', '/user')
    }
  }
  if (location.pathname === '/user') {
    const authCode = sp.get('code') || ''
    if (authCode) {
      try {
        await authModule.exchangeAuthCode(authCode)
        toast.success('用户登录成功')
      } catch (e) {
        toast.error(e.message || '用户登录失败')
      } finally {
        history.replaceState(null, '', '/user')
      }
    }
    if (store.authModuleJwt) openUserMailboxes()
    else userOpen.value = true
  }
  if (location.pathname === '/admin') {
    if (adminAuthed.value) enterAdmin()
    else openAdminAuth()
  }
  // 清除 URL 参数（避免刷新重复登录/泄漏）
  if (urlJwt || urlAuth) {
    const u = new URL(location.href)
    u.searchParams.delete('jwt')
    u.searchParams.delete('auth')
    history.replaceState(null, '', u.toString())
  }

  // 开发预览：?mock=1 注入假数据以验证完整界面
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('mock')) {
    loadMockData()
    setAdminPassword('mock') // 开发预览：允许直接进入管理台
    booting.value = false
    return
  }
  try {
    await loadOpenSettings()
  } catch (e) {
    toast.error(e.message || '无法连接服务器')
  }
  // 私人站点：需要访问密码且尚未提供 -> 弹出验证
  if (openSettings.value.needAuth && !store.auth) {
    showSiteAuth.value = true
  }
  if (tempMode.value && store.jwt) {
    try {
      await loadSettings()
      if (hasAddress.value) await loadMails(1)
    } catch (e) {
      toast.error(e.message || '加载邮箱失败')
    }
  } else {
    settings.value.fetched = true
  }
  booting.value = false
}

function onSelectMail() {
  readerOpen.value = true
}
function backToList() {
  readerOpen.value = false
  currentMail.value = null
}
function navigate(view) {
  if (view === 'user-mailboxes') {
    openUserMailboxes()
    return
  }
  activeView.value = view
  sidebarOpen.value = false
  readerOpen.value = false
}
function composeMail() {
  activeView.value = 'compose'
  sidebarOpen.value = false
  readerOpen.value = false
}
function backFromCompose() {
  activeView.value = 'inbox'
}

function returnHome() {
  tempMode.value = false
  if (location.pathname !== '/') history.pushState(null, '', '/')
  navigate('inbox')
}

function enterTempMailbox() {
  tempMode.value = true
  if (location.pathname !== '/temp/') history.pushState(null, '', '/temp/')
  activeView.value = 'inbox'
  sidebarOpen.value = false
  readerOpen.value = false
}

function getAddressIdFromJwt(token) {
  try {
    const part = String(token || '').split('.')[1]
    if (!part) return 0
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - part.length % 4) % 4)))
    return Number(payload.address_id || 0)
  } catch {
    return 0
  }
}

let addressBindingPromise = null
function bindCurrentAddressToUser() {
  if (addressBindingPromise) return addressBindingPromise
  const userJwt = authModule.jwt.value
  const addressJwt = store.jwt
  const addressId = getAddressIdFromJwt(addressJwt)
  if (!userJwt || !addressJwt || !addressId) return Promise.resolve()
  addressBindingPromise = (async () => {
    const result = await api.auth.tempMailAddresses(userJwt)
    const alreadyBound = (result.results || []).some((row) => Number(row.id) === addressId)
    if (alreadyBound) return
    await api.auth.tempMailBindAddress(userJwt, addressJwt)
    toast.success('当前临时邮箱已绑定到用户账户')
  })().finally(() => {
    addressBindingPromise = null
  })
  return addressBindingPromise
}

async function openUserMailboxes() {
  tempMode.value = false
  if (location.pathname !== '/user') history.pushState(null, '', '/user')
  userOpen.value = false
  sidebarOpen.value = false
  readerOpen.value = false
  activeView.value = 'user-mailboxes'
  try {
    await bindCurrentAddressToUser()
  } catch (e) {
    toast.warning(e.message || '当前邮箱未能自动绑定到用户账户')
  }
}

watch(adminMode, (enabled) => {
  if (enabled) {
    if (location.pathname !== '/admin') history.pushState(null, '', '/admin')
    return
  }
  if (location.pathname === '/admin') {
    history.pushState(null, '', tempMode.value ? '/temp/' : '/')
  }
})

watch(authModule.jwt, async (token) => {
  if (!token || !store.jwt) return
  try {
    await bindCurrentAddressToUser()
  } catch (e) {
    toast.warning(e.message || '当前邮箱未能自动绑定到用户账户')
  }
})

onMounted(boot)
</script>

<template>
  <div class="app-shell">
    <!-- 启动加载 -->
    <div v-if="booting" class="boot">
      <span class="boot__logo">✉</span>
      <span class="spinner" />
    </div>

    <!-- 管理控制台（优先） -->
    <template v-else-if="adminMode">
      <AdminConsole />
    </template>

    <!-- 用户邮箱一览：可在未选择具体地址时使用 -->
    <template v-else-if="activeView === 'user-mailboxes'">
      <UserMailboxOverview
        @admin="handleAdmin"
        @user="userOpen = true"
        @home="returnHome"
      />
    </template>

    <!-- 未登录：创建/登录（仍可进入管理台） -->
    <template v-else-if="!tempMode || !hasAddress">
      <AddressCreator @user="userOpen = true" @authenticated="enterTempMailbox" />
      <button class="floating-admin" title="控制台" @click="handleAdmin">
        <Icon name="settings" :size="20" />
      </button>
    </template>

    <!-- 主界面 -->
    <template v-else>
      <!-- 移动端顶栏（撰写视图隐藏，用 ComposeMail 自身的头） -->
      <header v-if="activeView !== 'compose'" class="topbar">
        <button class="icon-btn" aria-label="菜单" @click="sidebarOpen = true">
          <Icon name="menu" :size="22" />
        </button>
        <span class="topbar__title">{{ openSettings.title || 'Temp Email' }}</span>
      </header>

      <div class="layout" :class="{ 'reader-open': readerOpen }">
        <!-- 抽屉遮罩 -->
        <div
          v-if="sidebarOpen"
          class="drawer-scrim"
          @click="sidebarOpen = false"
        />
        <div class="pane pane--sidebar" :class="{ 'is-open': sidebarOpen }">
          <Sidebar
            :active-view="activeView"
            :drawer-open="sidebarOpen"
            @navigate="navigate"
            @compose="composeMail()"
            @admin="handleAdmin"
            @user="userOpen = true; sidebarOpen = false"
            @close="sidebarOpen = false"
          />
        </div>

        <template v-if="activeView === 'inbox'">
          <div class="pane pane--list">
            <MailList @select="onSelectMail" />
          </div>

          <div class="pane pane--reader">
            <MailReader @back="backToList" />
          </div>
        </template>

        <template v-else-if="activeView === 'compose'">
          <div class="pane pane--full">
            <ComposeMail @back="backFromCompose" @sent="backFromCompose" />
          </div>
        </template>

        <div v-else class="pane pane--content">
          <SentBoxList v-if="activeView === 'sent'" />
          <AccountPanel v-else-if="activeView === 'account'" />
          <WebhookSettingsPanel v-else-if="activeView === 'webhook'" />
          <AttachmentPanel v-else-if="activeView === 'attachments'" />
          <AboutPanel v-else-if="activeView === 'about'" />
        </div>
      </div>
    </template>

    <!-- 全局：用户账户面板 -->
    <UserPanel v-model:show="userOpen" @mailboxes="openUserMailboxes" />

    <!-- 全局：站点访问密码 / 管理员登录 -->
    <SiteAuthModal v-model:show="showSiteAuth" @unlocked="boot" />
    <AdminAuthModal v-model:show="showAdminAuth" />

    <ToastHost />

    <div class="repo-fab" :class="{ 'is-expanded': repoExpanded }" :data-revision="appRevision">
      <button class="repo-fab__toggle" type="button" aria-label="展开 GitHub 仓库信息" @click="repoExpanded = !repoExpanded">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.89-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.43c.85 0 1.71.12 2.51.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.93.68 1.87 0 1.35-.01 2.44-.01 2.77 0 .27.18.6.69.49A10.23 10.23 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" /></svg>
      </button>
      <a v-if="repoExpanded" class="repo-fab__link" href="https://github.com/yuuuiv/temp-mail" target="_blank" rel="noopener noreferrer">
        yuuuiv/temp-mail
      </a>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  height: 100dvh;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 未登录时的悬浮管理入口 */
.floating-admin {
  position: fixed;
  bottom: calc(env(safe-area-inset-bottom, 0px) + var(--sp-5));
  left: var(--sp-5);
  z-index: 40;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text-muted);
  box-shadow: var(--shadow);
  transition: color var(--dur), border-color var(--dur), transform var(--dur);
}
.floating-admin:hover {
  color: var(--accent);
  border-color: var(--accent);
  transform: translateY(-2px);
}

.repo-fab {
  position: fixed;
  right: calc(env(safe-area-inset-right, 0px) + var(--sp-4));
  bottom: calc(env(safe-area-inset-bottom, 0px) + var(--sp-4));
  z-index: 35;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  box-shadow: var(--shadow);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  overflow: visible;
  transition: border-color var(--dur), color var(--dur);
}

.repo-fab:hover {
  color: var(--accent);
  border-color: var(--accent);
}
.repo-fab::after {
  content: 'commit: ' attr(data-revision);
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  background: var(--text);
  color: var(--bg);
  font: 11px var(--font-mono);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translateY(3px);
  transition: opacity var(--dur), transform var(--dur);
}
.repo-fab:hover::after { opacity: 1; transform: translateY(0); }
.repo-fab__toggle {
  display:grid;
  place-items:center;
  width:42px;
  height:42px;
  border:0;
  border-radius:50%;
  background:transparent;
  color:var(--text-muted);
}
.repo-fab__toggle:hover { color:var(--accent); }
.repo-fab__toggle svg { width:21px; height:21px; fill:currentColor; }
.repo-fab__link {
  max-width:0;
  overflow:hidden;
  margin-right:0;
  color:var(--text-muted);
  font:600 12px var(--font-mono);
  text-decoration:none;
  white-space:nowrap;
  transition:max-width var(--dur) var(--ease), margin-right var(--dur) var(--ease);
}
.repo-fab.is-expanded .repo-fab__link { max-width:190px; margin-right:14px; }
.repo-fab__link:hover { color:var(--accent); }

/* 启动屏 */
.boot {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-5);
  background: var(--bg);
}
.boot__logo {
  font-size: 48px;
  color: var(--accent);
  animation: floaty 2s ease-in-out infinite;
}
@keyframes floaty {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.spinner {
  width: 26px; height: 26px;
  border: 3px solid var(--border-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* 移动端顶栏（桌面隐藏） */
.topbar {
  display: none;
  align-items: center;
  gap: var(--sp-3);
  height: 56px;
  padding: 0 var(--sp-3);
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
  flex-shrink: 0;
}
.topbar__title { font-family: var(--font-display); font-weight: 600; }
.icon-btn {
  display: grid;
  place-items: center;
  width: 40px; height: 40px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
}
.icon-btn:hover { background: var(--surface-hover); }

/* 桌面三栏 */
.layout {
  flex: 1;
  display: grid;
  grid-template-columns: var(--sidebar-w) var(--list-w) 1fr;
  min-height: 0;
}
.pane { min-height: 0; min-width: 0; height: 100%; }
.pane--reader { overflow: hidden; }
.pane--content { grid-column: span 2; overflow: hidden; background: var(--bg); }
.pane--full { grid-column: 2 / -1; overflow: hidden; }

.drawer-scrim { display: none; }

/* ===== 平板：折叠侧边栏为抽屉，保留 列表 + 阅读 ===== */
@media (max-width: 1100px) {
  .layout { grid-template-columns: var(--list-w) 1fr; }
  .pane--content { grid-column: 1 / -1; }
  .pane--full { grid-column: 1 / -1; }
  .pane--sidebar {
    position: fixed;
    top: 0; left: 0; bottom: 0;
    z-index: 60;
    transform: translateX(-100%);
    transition: transform var(--dur) var(--ease);
  }
  .pane--sidebar.is-open { transform: translateX(0); }
  .drawer-scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 50;
    background: var(--scrim);
    backdrop-filter: blur(2px);
  }
}

/* ===== 手机：单栏切换（列表 <-> 阅读），顶栏出现 ===== */
@media (max-width: 900px) {
  .topbar { display: flex; }
  .layout { grid-template-columns: 1fr; position: relative; }
  .pane--list {
    grid-column: 1;
    grid-row: 1;
  }
  .pane--reader {
    position: absolute;
    inset: 0;
    z-index: 30;
    background: var(--bg);
    transform: translateX(100%);
    transition: transform var(--dur) var(--ease);
  }
  .layout.reader-open .pane--reader { transform: translateX(0); }
  .pane--content { grid-column: 1; grid-row: 1; }
  .pane--full { grid-column: 1; grid-row: 1; }
}
</style>
