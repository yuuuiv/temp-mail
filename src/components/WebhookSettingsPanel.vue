<script setup>
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import Icon from './Icon.vue'

const toast = useToast()
const props = defineProps({
  scope: { type: String, default: 'user' }, // user | admin-mail | admin-global
  title: { type: String, default: 'Webhook 设置' },
})

const loading = ref(false)
const saving = ref(false)
const cfg = ref({
  enabled: false,
  url: '',
  method: 'POST',
  headers: JSON.stringify({ 'Content-Type': 'application/json' }, null, 2),
  body: JSON.stringify({
    title: '${subject}',
    content: 'From: ${from}\\nTo: ${to}\\n\\n${parsedText}',
  }, null, 2),
})

function endpoints() {
  if (props.scope === 'admin-mail') {
    return {
      get: api.admin.getMailWebhookSettings,
      save: api.admin.saveMailWebhookSettings,
      test: api.admin.testMailWebhookSettings,
    }
  }
  if (props.scope === 'admin-global') {
    return {
      get: api.admin.getWebhookSettings,
      save: api.admin.saveWebhookSettings,
      test: api.admin.testWebhookSettings,
    }
  }
  return {
    get: api.getWebhookSettings,
    save: api.saveWebhookSettings,
    test: api.testWebhookSettings,
  }
}

async function load() {
  loading.value = true
  try {
    const res = await endpoints().get()
    Object.assign(cfg.value, res || {})
  } catch (e) {
    toast.error(e.message || '加载 Webhook 失败')
  } finally { loading.value = false }
}

async function save() {
  if (cfg.value.enabled && !cfg.value.url) {
    toast.warning('启用 Webhook 时必须填写 URL')
    return
  }
  saving.value = true
  try {
    await endpoints().save(cfg.value)
    toast.success('Webhook 已保存')
  } catch (e) {
    toast.error(e.message || '保存失败')
  } finally { saving.value = false }
}

async function test() {
  if (!cfg.value.url) {
    toast.warning('请先填写 URL')
    return
  }
  try {
    await endpoints().test(cfg.value)
    toast.success('测试请求已发送')
  } catch (e) {
    toast.error(e.message || '测试失败')
  }
}

const presets = [
  {
    label: 'ntfy',
    value: {
      enabled: true,
      url: 'https://ntfy.sh/YOUR_TOPIC',
      method: 'POST',
      headers: JSON.stringify({ 'Content-Type': 'application/json' }, null, 2),
      body: JSON.stringify({ topic: 'YOUR_TOPIC', title: '${subject}', message: 'From: ${from}\\nTo: ${to}\\n\\n${parsedText}' }, null, 2),
    },
  },
  {
    label: 'Telegram Bot',
    value: {
      enabled: true,
      url: 'https://api.telegram.org/botYOUR_BOT_TOKEN/sendMessage',
      method: 'POST',
      headers: JSON.stringify({ 'Content-Type': 'application/json' }, null, 2),
      body: JSON.stringify({ chat_id: 'YOUR_CHAT_ID', text: 'New Email\\nFrom: ${from}\\nTo: ${to}\\nSubject: ${subject}\\nURL: ${url}' }, null, 2),
    },
  },
  {
    label: 'Discord',
    value: {
      enabled: true,
      url: 'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN',
      method: 'POST',
      headers: JSON.stringify({ 'Content-Type': 'application/json' }, null, 2),
      body: JSON.stringify({ content: '**New Email**\\nFrom: ${from}\\nTo: ${to}\\nSubject: ${subject}\\nURL: ${url}' }, null, 2),
    },
  },
]

function usePreset(preset) {
  Object.assign(cfg.value, preset.value)
}

onMounted(load)
</script>

<template>
  <div class="webhook panel">
    <div class="card">
      <div class="card__head">
        <h2 class="view-title">{{ title }}</h2>
        <div class="head-actions">
          <select class="field preset" @change="usePreset(presets[$event.target.value])">
            <option value="">模板</option>
            <option v-for="(p, idx) in presets" :key="p.label" :value="idx">{{ p.label }}</option>
          </select>
          <button v-if="cfg.enabled" class="btn btn--ghost" @click="test">测试</button>
          <button class="btn btn--primary" :disabled="saving" @click="save">
            <Icon name="check" :size="16" /> {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>

      <div class="form-grid">
        <label class="switch-row">
          <span class="switch-row__label">启用 Webhook</span>
          <input v-model="cfg.enabled" type="checkbox" />
        </label>
        <div class="form-row">
          <label>URL</label>
          <input v-model="cfg.url" class="field mono" placeholder="https://example.com/webhook" />
        </div>
        <div class="form-row">
          <label>Method</label>
          <select v-model="cfg.method" class="field mono">
            <option>POST</option>
          </select>
        </div>
        <div class="form-row">
          <label>Headers JSON</label>
          <textarea v-model="cfg.headers" class="field mono" rows="5" />
        </div>
        <div class="form-row">
          <label>Body JSON / 模板</label>
          <textarea v-model="cfg.body" class="field mono" rows="8" />
          <p class="hint">可用变量：${subject}、${from}、${to}、${parsedText}、${url}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./admin/admin-shared.css"></style>
<style scoped>
.webhook { padding: var(--sp-5); max-width: 980px; height: 100%; overflow-y: auto; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--sp-5); }
.card__head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); margin-bottom: var(--sp-4); flex-wrap: wrap; }
.head-actions { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.view-title { margin: 0; font-size: 18px; }
.preset { width: 120px; padding: var(--sp-2) var(--sp-3); }
</style>
