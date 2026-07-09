<script setup>
import { onMounted, reactive, ref } from 'vue'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import Icon from '../Icon.vue'
import WebhookSettingsPanel from '../WebhookSettingsPanel.vue'

const toast = useToast()
const dbVersion = ref(null)
const telegramStatus = ref(null)
const telegramDomain = ref('')

const cards = reactive([
  {
    key: 'worker',
    title: 'Worker 配置（只读）',
    readonly: true,
    text: '',
    load: api.admin.getWorkerConfigs,
  },
  {
    key: 'userSettings',
    title: '用户系统设置',
    text: '',
    load: api.admin.getUserSettings,
    save: api.admin.saveUserSettings,
  },
  {
    key: 'oauth2',
    title: '用户 OAuth2 设置',
    text: '',
    load: api.admin.getUserOauth2Settings,
    save: api.admin.saveUserOauth2Settings,
  },
  {
    key: 'ipBlacklist',
    title: 'IP / ASN / 指纹黑名单设置',
    text: '',
    load: api.admin.getIpBlacklist,
    save: api.admin.saveIpBlacklist,
  },
  {
    key: 'roleAddress',
    title: '角色地址数量限制',
    text: '',
    load: async () => (await api.admin.getRoleAddressConfig()).configs || {},
    save: api.admin.saveRoleAddressConfig,
  },
  {
    key: 'telegram',
    title: 'Telegram 设置',
    text: '',
    load: api.admin.getTelegramSettings,
    save: api.admin.saveTelegramSettings,
  },
])

async function loadCard(card) {
  try {
    const data = await card.load()
    card.text = JSON.stringify(data ?? {}, null, 2)
  } catch (e) {
    toast.error(`${card.title} 加载失败：${e.message || e}`)
  }
}

async function saveCard(card) {
  try {
    const payload = JSON.parse(card.text || '{}')
    await card.save(payload)
    toast.success(`${card.title} 已保存`)
  } catch (e) {
    toast.error(e instanceof SyntaxError ? 'JSON 格式错误' : (e.message || '保存失败'))
  }
}

async function loadDb() {
  try {
    dbVersion.value = await api.admin.getDbVersion()
  } catch (e) {
    dbVersion.value = { error: e.message || String(e) }
  }
}

async function runDb(action) {
  if (!confirm(action === 'init' ? '确认初始化数据库？' : '确认执行数据库迁移？')) return
  try {
    await (action === 'init' ? api.admin.initDb() : api.admin.migrateDb())
    toast.success('数据库操作完成')
    await loadDb()
  } catch (e) {
    toast.error(e.message || '数据库操作失败')
  }
}

async function loadTelegramStatus() {
  try {
    telegramStatus.value = await api.admin.telegramStatus()
  } catch (e) {
    telegramStatus.value = { error: e.message || String(e) }
  }
}

async function initTelegram() {
  if (!telegramDomain.value.trim()) {
    toast.warning('请输入当前 Worker 域名')
    return
  }
  try {
    await api.admin.initTelegram({ domain: telegramDomain.value.trim() })
    toast.success('Telegram Webhook 已初始化')
    await loadTelegramStatus()
  } catch (e) {
    toast.error(e.message || '初始化失败')
  }
}

onMounted(async () => {
  await Promise.all([loadDb(), loadTelegramStatus(), ...cards.map(loadCard)])
})
</script>

<template>
  <div class="panel">
    <div class="card">
      <div class="card__head">
        <h3 class="card__title">数据库维护</h3>
        <button class="btn btn--ghost icon-only" @click="loadDb"><Icon name="refresh" :size="16" /></button>
      </div>
      <pre class="json mono">{{ JSON.stringify(dbVersion, null, 2) }}</pre>
      <div class="row-actions">
        <button class="btn btn--ghost" @click="runDb('init')">初始化数据库</button>
        <button class="btn btn--primary" @click="runDb('migrate')">执行迁移</button>
      </div>
    </div>

    <WebhookSettingsPanel scope="admin-mail" title="邮件 Webhook 设置" />

    <div class="card">
      <div class="card__head">
        <h3 class="card__title">Telegram 状态 / 初始化</h3>
        <button class="btn btn--ghost icon-only" @click="loadTelegramStatus"><Icon name="refresh" :size="16" /></button>
      </div>
      <pre class="json mono">{{ JSON.stringify(telegramStatus, null, 2) }}</pre>
      <div class="row-inline">
        <input v-model="telegramDomain" class="field mono" placeholder="your-worker.example.com" />
        <button class="btn btn--primary" @click="initTelegram">初始化 Webhook</button>
      </div>
    </div>

    <div v-for="card in cards" :key="card.key" class="card">
      <div class="card__head">
        <h3 class="card__title">{{ card.title }}</h3>
        <div class="row-actions">
          <button class="btn btn--ghost icon-only" @click="loadCard(card)">
            <Icon name="refresh" :size="16" />
          </button>
          <button v-if="!card.readonly" class="btn btn--primary" @click="saveCard(card)">
            <Icon name="check" :size="16" /> 保存
          </button>
        </div>
      </div>
      <textarea v-model="card.text" class="field mono json-edit" :readonly="card.readonly" spellcheck="false" />
    </div>
  </div>
</template>

<style scoped src="./admin-shared.css"></style>
<style scoped>
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--sp-5); }
.card__head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); margin-bottom: var(--sp-3); }
.card__title { margin: 0; font-size: 17px; }
.json { max-height: 260px; overflow: auto; padding: var(--sp-4); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-2); }
.json-edit { min-height: 260px; line-height: 1.5; }
.row-actions, .row-inline { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.row-inline .field { flex: 1; min-width: 260px; }
</style>
