<script setup>
import { onMounted, ref } from 'vue'
import { useMailbox } from '@/composables/useMailbox'
import { useToast } from '@/composables/useToast'
import { useAdmin } from '@/composables/useAdmin'
import { useAuthGate } from '@/composables/useAuthGate'
import { useAuthModule } from '@/composables/useAuthModule'
import { store } from '@/lib/api'

import Sidebar from '@/components/Sidebar.vue'
import MailList from '@/components/MailList.vue'
import MailReader from '@/components/MailReader.vue'
import SendMail from '@/components/SendMail.vue'
import AddressCreator from '@/components/AddressCreator.vue'
import SentBoxList from '@/components/SentBoxList.vue'
import AccountPanel from '@/components/AccountPanel.vue'
import AutoReplyPanel from '@/components/AutoReplyPanel.vue'
import WebhookSettingsPanel from '@/components/WebhookSettingsPanel.vue'
import AttachmentPanel from '@/components/AttachmentPanel.vue'
import AboutPanel from '@/components/AboutPanel.vue'
import ToastHost from '@/components/ToastHost.vue'
import Icon from '@/components/Icon.vue'
import SiteAuthModal from '@/components/SiteAuthModal.vue'
import AdminAuthModal from '@/components/AdminAuthModal.vue'
import AdminConsole from '@/components/admin/AdminConsole.vue'
import UserPanel from '@/components/UserPanel.vue'
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
const composeOpen = ref(false)
const userOpen = ref(false)
const activeView = ref('inbox')

function handleAdmin() {
  sidebarOpen.value = false
  if (adminAuthed.value) enterAdmin()
  else openAdminAuth()
}

async function boot() {
  // URL 参数自动登录：?jwt=xxx 直接设置地址凭证，?auth=xxx 设置站点密码
  const sp = new URLSearchParams(location.search)
  if (location.pathname.startsWith('/auth/callback/')) {
    const loginType = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '')
    try {
      await authModule.handleCallback(loginType, sp)
      toast.success('用户登录成功')
      userOpen.value = true
    } catch (e) {
      toast.error(e.message || '用户登录失败')
    } finally {
      history.replaceState(null, '', '/')
    }
  } else if (location.pathname === '/auth/complete') {
    try {
      await authModule.exchangeAuthCode(sp.get('code') || '')
      toast.success('用户登录成功')
      userOpen.value = true
    } catch (e) {
      toast.error(e.message || '用户登录失败')
    } finally {
      history.replaceState(null, '', '/')
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
    userOpen.value = true
  }
  const urlJwt = sp.get('jwt')
  const urlAuth = sp.get('auth')
  if (urlJwt) store.jwt = urlJwt
  if (urlAuth) store.auth = urlAuth
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
  if (store.jwt) {
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
  activeView.value = view
  sidebarOpen.value = false
  readerOpen.value = false
}

function openUserMailboxes() {
  userOpen.value = false
  sidebarOpen.value = false
  readerOpen.value = false
  activeView.value = 'user-mailboxes'
}

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
        @home="navigate('inbox')"
      />
    </template>

    <!-- 未登录：创建/登录（仍可进入管理台） -->
    <template v-else-if="!hasAddress">
      <AddressCreator @user="userOpen = true" />
      <button class="floating-admin" title="控制台" @click="handleAdmin">
        <Icon name="settings" :size="20" />
      </button>
    </template>

    <!-- 主界面 -->
    <template v-else>
      <!-- 移动端顶栏 -->
      <header class="topbar">
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
            @navigate="navigate"
            @compose="composeOpen = true; sidebarOpen = false"
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

        <div v-else class="pane pane--content">
          <SentBoxList v-if="activeView === 'sent'" />
          <AccountPanel v-else-if="activeView === 'account'" />
          <AutoReplyPanel v-else-if="activeView === 'auto-reply'" />
          <WebhookSettingsPanel v-else-if="activeView === 'webhook'" />
          <AttachmentPanel v-else-if="activeView === 'attachments'" />
          <AboutPanel v-else-if="activeView === 'about'" />
        </div>
      </div>
    </template>

    <SendMail v-model:show="composeOpen" />

    <!-- 全局：用户账户面板 -->
    <UserPanel v-model:show="userOpen" @mailboxes="openUserMailboxes" />

    <!-- 全局：站点访问密码 / 管理员登录 -->
    <SiteAuthModal v-model:show="showSiteAuth" @unlocked="boot" />
    <AdminAuthModal v-model:show="showAdminAuth" />

    <ToastHost />

    <a
      class="repo-badge"
      href="https://github.com/yuuuiv/temp-mail-frontend"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="GitHub 仓库 yuuuiv/temp-mail-frontend"
    >
      GitHub · yuuuiv/temp-mail-frontend
    </a>
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

.repo-badge {
  position: fixed;
  right: calc(env(safe-area-inset-right, 0px) + var(--sp-4));
  bottom: calc(env(safe-area-inset-bottom, 0px) + var(--sp-4));
  z-index: 35;
  max-width: min(280px, calc(100vw - var(--sp-8)));
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  color: var(--text-muted);
  box-shadow: var(--shadow);
  backdrop-filter: blur(10px);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.repo-badge:hover {
  color: var(--accent);
  border-color: var(--accent);
}

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

.drawer-scrim { display: none; }

/* ===== 平板：折叠侧边栏为抽屉，保留 列表 + 阅读 ===== */
@media (max-width: 1100px) {
  .layout { grid-template-columns: var(--list-w) 1fr; }
  .pane--content { grid-column: 1 / -1; }
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
}
</style>
