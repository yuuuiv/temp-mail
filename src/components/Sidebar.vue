<script setup>
import { computed } from 'vue'
import { useMailbox } from '@/composables/useMailbox'
import { useAuthModule } from '@/composables/useAuthModule'
import { useToast } from '@/composables/useToast'
import { copyText } from '@/lib/utils'
import Icon from './Icon.vue'
import ThemeToggle from './ThemeToggle.vue'

const props = defineProps({
  activeView: { type: String, default: 'inbox' },
  drawerOpen: { type: Boolean, default: false },
})
const emit = defineEmits(['navigate', 'compose', 'close', 'admin', 'user'])

const { openSettings, settings, totalCount, hasAddress, logout } = useMailbox()
const { isLoggedIn: userLoggedIn } = useAuthModule()
const toast = useToast()

const canViewSentBox = computed(() => hasAddress.value)
const canSend = computed(() => openSettings.value.enableSendMail && hasAddress.value)

async function copyAddress() {
  if (!settings.value.address) return
  const ok = await copyText(settings.value.address)
  toast[ok ? 'success' : 'error'](ok ? '地址已复制' : '复制失败')
}

function doLogout() {
  logout()
  toast.info('已退出当前邮箱')
  emit('close')
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__brand">
      <div class="logo">
        <Icon name="mail" :size="20" />
      </div>
      <div class="brand-text">
        <div class="brand-title">{{ openSettings.title || 'Temp Email' }}</div>
        <div class="brand-sub mono">temporary inbox</div>
      </div>
      <button v-if="drawerOpen" class="icon-btn sidebar__close" aria-label="关闭菜单" @click="emit('close')">
        <Icon name="close" :size="20" />
      </button>
    </div>

    <!-- 当前地址卡片 -->
    <div v-if="hasAddress" class="addr-card">
      <div class="addr-card__label">当前邮箱</div>
      <button class="addr-card__value mono" title="点击复制" @click="copyAddress">
        <span class="addr-card__text">{{ settings.address }}</span>
        <Icon name="copy" :size="15" />
      </button>
    </div>

    <!-- 导航 -->
    <nav class="nav">
      <button
        class="nav__item"
        :class="{ 'is-active': activeView === 'inbox' }"
        @click="emit('navigate', 'inbox')"
      >
        <Icon name="inbox" :size="18" />
        <span>收件箱</span>
        <span v-if="totalCount" class="nav__badge mono">{{ totalCount }}</span>
      </button>

      <button
        v-if="canViewSentBox"
        class="nav__item nav__item--accent"
        :class="{ 'is-active': activeView === 'sent' }"
        @click="emit('navigate', 'sent')"
      >
        <Icon name="send" :size="18" />
        <span>发件箱</span>
      </button>

      <button
        v-if="canSend"
        class="nav__item nav__item--accent"
        @click="emit('compose')"
      >
        <Icon name="send" :size="18" />
        <span>写邮件</span>
      </button>

      <button
        class="nav__item"
        :class="{ 'is-active': activeView === 'account' }"
        @click="emit('navigate', 'account')"
      >
        <Icon name="key" :size="18" />
        <span>邮箱设置</span>
      </button>

      <button
        v-if="openSettings.enableWebhook"
        class="nav__item"
        :class="{ 'is-active': activeView === 'webhook' }"
        @click="emit('navigate', 'webhook')"
      >
        <Icon name="mail" :size="18" />
        <span>Webhook</span>
      </button>

      <button
        v-if="openSettings.isS3Enabled"
        class="nav__item"
        :class="{ 'is-active': activeView === 'attachments' }"
        @click="emit('navigate', 'attachments')"
      >
        <Icon name="paperclip" :size="18" />
        <span>S3 附件</span>
      </button>

      <button
        v-if="openSettings.enableIndexAbout"
        class="nav__item"
        :class="{ 'is-active': activeView === 'about' }"
        @click="emit('navigate', 'about')"
      >
        <Icon name="alert" :size="18" />
        <span>关于</span>
      </button>
    </nav>

    <div class="sidebar__spacer" />

    <!-- 管理入口 -->
    <button class="nav__item nav__item--admin" @click="emit('admin')">
      <Icon name="settings" :size="18" />
      <span>控制台</span>
    </button>
    <!-- 用户入口 -->
    <button
      v-if="userLoggedIn"
      class="nav__item nav__item--admin"
      @click="emit('navigate', 'user-mailboxes')"
    >
      <Icon name="inbox" :size="18" />
      <span>用户邮箱一览</span>
    </button>
    <button class="nav__item nav__item--admin" style="margin-bottom:var(--sp-1)" @click="emit('user')">
      <Icon name="key" :size="18" />
      <span>用户账户</span>
    </button>

    <!-- 底部：主题 + 账户 -->
    <div class="sidebar__footer">
      <ThemeToggle />
      <button v-if="hasAddress" class="icon-btn logout-btn" title="退出邮箱" @click="doLogout">
        <Icon name="logout" :size="18" />
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  padding: var(--sp-4);
}

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-1) var(--sp-1) var(--sp-4);
}
.logo {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-pill);
  display: grid;
  place-items: center;
  background: var(--accent);
  color: var(--accent-contrast);
  flex-shrink: 0;
}
.brand-text { min-width: 0; }
.brand-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.brand-sub { font-size: 11px; color: var(--text-faint); letter-spacing: 0.04em; }
.sidebar__close { margin-left: auto; border: none; background: transparent; }

.addr-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-3);
  margin-bottom: var(--sp-4);
}
.addr-card__label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
  margin-bottom: 6px;
}
.addr-card__value {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  text-align: left;
  padding: 0;
}
.addr-card__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.addr-card__value:hover { color: var(--accent); }

.nav { display: flex; flex-direction: column; gap: 4px; }
.nav__item {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3);
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-2);
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  transition: background var(--dur), color var(--dur);
}
.nav__item:hover { background: var(--surface-hover); color: var(--text); }
.nav__item.is-active {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 600;
}
.nav__item--accent {
  color: var(--accent-strong);
}
.nav__item--admin {
  margin-bottom: var(--sp-2);
  color: var(--text-muted);
  border: 1px dashed var(--border-strong);
}
.nav__item--admin:hover {
  color: var(--text);
  border-color: var(--accent);
}
.nav__badge {
  margin-left: auto;
  font-size: 11px;
  background: var(--surface-2);
  color: var(--text-muted);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
}

.sidebar__spacer { flex: 1; }
.sidebar__footer {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--border);
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  color: var(--text-muted);
  transition: background var(--dur), color var(--dur);
}
.icon-btn:hover { background: var(--surface-hover); color: var(--text); }
.logout-btn:hover { color: var(--danger); border-color: var(--danger); }

@media (max-width: 900px) {
  .sidebar {
    width: min(84vw, 320px);
    box-shadow: var(--shadow-lg);
  }
}
</style>
