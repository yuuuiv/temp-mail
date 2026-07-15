<script setup>
import { ref } from 'vue'
import { useAdmin } from '@/composables/useAdmin'
import { useToast } from '@/composables/useToast'
import Icon from '../Icon.vue'
import ThemeToggle from '../ThemeToggle.vue'

import AdminAddresses from './AdminAddresses.vue'
import AdminCreateAddress from './AdminCreateAddress.vue'
import AdminUsers from './AdminUsers.vue'
import AdminStatistics from './AdminStatistics.vue'
import AdminCleanup from './AdminCleanup.vue'
import AdminSettings from './AdminSettings.vue'
import AdminSendBox from './AdminSendBox.vue'
import AdminWebhook from './AdminWebhook.vue'
import AdminAiExtract from './AdminAiExtract.vue'
import AdminMailRules from './AdminMailRules.vue'
import AdminMails from './AdminMails.vue'
import AdminSenderAccess from './AdminSenderAccess.vue'
import AdminSendMail from './AdminSendMail.vue'
import AdminAdvanced from './AdminAdvanced.vue'

const { exitAdmin, logoutAdmin } = useAdmin()
const toast = useToast()

const tabs = [
  { key: 'stats', label: '统计', icon: 'chart', hue: 210, comp: AdminStatistics },
  { key: 'addresses', label: '地址管理', icon: 'addressBook', hue: 185, comp: AdminAddresses },
  { key: 'create', label: '创建地址', icon: 'mailPlus', hue: 150, comp: AdminCreateAddress },
  { key: 'users', label: '用户管理', icon: 'users', hue: 260, comp: AdminUsers },
  { key: 'mails', label: '邮件管理', icon: 'mailOpen', hue: 200, comp: AdminMails },
  { key: 'sendbox', label: '发件箱', icon: 'outbox', hue: 35, comp: AdminSendBox },
  { key: 'admin-send', label: '管理员发信', icon: 'feather', hue: 20, comp: AdminSendMail },
  { key: 'sender-access', label: '发信权限', icon: 'shieldCheck', hue: 115, comp: AdminSenderAccess },
  { key: 'webhook', label: 'Webhook', icon: 'webhook', hue: 285, comp: AdminWebhook },
  { key: 'rules', label: '邮件规则', icon: 'filter', hue: 48, comp: AdminMailRules },
  { key: 'ai-extract', label: 'AI 提取', icon: 'sparkles', hue: 315, comp: AdminAiExtract },
  { key: 'cleanup', label: '定时清理', icon: 'calendarClock', hue: 5, comp: AdminCleanup },
  { key: 'settings', label: '黑名单/设置', icon: 'shieldBan', hue: 350, comp: AdminSettings },
  { key: 'advanced', label: '高级设置', icon: 'sliders', hue: 225, comp: AdminAdvanced },
]
const active = ref('stats')
const navOpen = ref(false)

function pick(k) {
  active.value = k
  navOpen.value = false
}
function doLogout() {
  logoutAdmin()
  toast.info('已退出管理员')
}
</script>

<template>
  <div class="admin">
    <!-- 顶栏 -->
    <header class="admin__top">
      <button class="icon-btn admin__menu" aria-label="菜单" @click="navOpen = true">
        <Icon name="menu" :size="20" />
      </button>
      <div class="admin__brand">
        <Icon name="settings" :size="18" />
        <span>控制台</span>
      </div>
      <div class="admin__top-actions">
        <ThemeToggle />
        <button class="btn btn--ghost" @click="exitAdmin">
          <Icon name="back" :size="16" /> 返回
        </button>
        <button class="icon-btn danger" title="退出管理员" @click="doLogout">
          <Icon name="logout" :size="18" />
        </button>
      </div>
    </header>

    <div class="admin__body">
      <!-- 抽屉遮罩 -->
      <div v-if="navOpen" class="nav-scrim" @click="navOpen = false" />

      <!-- 侧边 tab -->
      <nav class="admin__nav" :class="{ 'is-open': navOpen }">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="admin__navitem"
          :class="{ 'is-active': active === t.key }"
          @click="pick(t.key)"
        >
          <span class="admin__navicon" :style="{ '--nav-icon-hue': t.hue }">
            <Icon :name="t.icon" :size="17" />
          </span>
          <span>{{ t.label }}</span>
        </button>
      </nav>

      <!-- 内容 -->
      <main class="admin__content">
        <component :is="tabs.find((t) => t.key === active).comp" :key="active" />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.admin__top {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  height: var(--header-h);
  padding: 0 var(--sp-4);
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
  flex-shrink: 0;
}
.admin__brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--text);
}
.admin__top-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.admin__menu { display: none; }

.admin__body {
  flex: 1;
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 0;
}
.admin__nav {
  border-right: 1px solid var(--border);
  background: var(--sidebar-bg);
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}
.admin__navitem {
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
.admin__navicon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  margin: -5px 0;
  border-radius: 9px;
  color: hsl(var(--nav-icon-hue) 42% 42%);
  background: hsl(var(--nav-icon-hue) 48% 50% / 0.1);
  flex-shrink: 0;
  transition: background var(--dur), color var(--dur), box-shadow var(--dur);
}
.admin__navitem:hover { background: var(--surface-hover); color: var(--text); }
.admin__navitem.is-active {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 600;
}
.admin__navitem.is-active .admin__navicon {
  color: hsl(var(--nav-icon-hue) 48% 36%);
  background: hsl(var(--nav-icon-hue) 52% 50% / 0.18);
  box-shadow: inset 0 0 0 1px hsl(var(--nav-icon-hue) 42% 45% / 0.14);
}
:global([data-theme='dark']) .admin__navicon {
  color: hsl(var(--nav-icon-hue) 52% 68%);
  background: hsl(var(--nav-icon-hue) 45% 55% / 0.13);
}
:global([data-theme='dark']) .admin__navitem.is-active .admin__navicon {
  color: hsl(var(--nav-icon-hue) 60% 74%);
  background: hsl(var(--nav-icon-hue) 50% 58% / 0.2);
}
.admin__content {
  overflow-y: auto;
  padding: var(--sp-5);
}

.nav-scrim { display: none; }

.icon-btn {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
}
.icon-btn:hover { background: var(--surface-hover); }
.icon-btn.danger:hover { background: var(--danger-soft); color: var(--danger); }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
}
.btn--ghost:hover { background: var(--surface-hover); }

@media (max-width: 860px) {
  .admin__menu { display: grid; }
  .admin__top-actions .btn span { display: none; }
  .admin__body { grid-template-columns: 1fr; }
  .admin__nav {
    position: fixed;
    top: 0; left: 0; bottom: 0;
    z-index: 60;
    width: min(80vw, 280px);
    transform: translateX(-100%);
    transition: transform var(--dur) var(--ease);
    box-shadow: var(--shadow-lg);
  }
  .admin__nav.is-open { transform: translateX(0); }
  .nav-scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 50;
    background: var(--scrim);
  }
}
</style>
