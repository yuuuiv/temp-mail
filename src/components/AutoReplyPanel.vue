<script setup>
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import Icon from './Icon.vue'

const toast = useToast()
const saving = ref(false)
const loading = ref(false)
const form = ref({
  enabled: false,
  name: '',
  source_prefix: '',
  subject: '',
  message: '',
})

async function load() {
  loading.value = true
  try {
    const res = await api.getAutoReply()
    Object.assign(form.value, {
      enabled: res.enabled || false,
      name: res.name || '',
      source_prefix: res.source_prefix || '',
      subject: res.subject || '',
      message: res.message || '',
    })
  } catch (e) {
    toast.error(e.message || '加载自动回复失败')
  } finally { loading.value = false }
}

async function save() {
  saving.value = true
  try {
    await api.saveAutoReply(form.value)
    toast.success('自动回复设置已保存')
  } catch (e) {
    toast.error(e.message || '保存失败')
  } finally { saving.value = false }
}

onMounted(load)
</script>

<template>
  <div class="autoreply panel">
    <div class="card">
      <div class="card__head">
        <h2 class="view-title">自动回复</h2>
        <button class="btn btn--primary" :disabled="saving" @click="save">
          <Icon name="check" :size="16" /> {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
      <p class="hint">收到邮件后自动回复对方。源地址前缀可用于覆盖自动回复发件地址前缀。</p>
      <div class="form-grid">
        <label class="switch-row">
          <span class="switch-row__label">启用自动回复</span>
          <input v-model="form.enabled" type="checkbox" />
        </label>
        <div class="form-row">
          <label>发件昵称</label>
          <input v-model="form.name" class="field" :disabled="!form.enabled" />
        </div>
        <div class="form-row">
          <label>源地址前缀</label>
          <input v-model="form.source_prefix" class="field mono" :disabled="!form.enabled" placeholder="reply" />
        </div>
        <div class="form-row">
          <label>主题</label>
          <input v-model="form.subject" class="field" :disabled="!form.enabled" />
        </div>
        <div class="form-row">
          <label>回复正文</label>
          <textarea v-model="form.message" class="field" rows="8" :disabled="!form.enabled" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./admin/admin-shared.css"></style>
<style scoped>
.autoreply { padding: var(--sp-5); max-width: 920px; height: 100%; overflow-y: auto; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--sp-5); }
.card__head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); margin-bottom: var(--sp-2); }
.view-title { margin: 0; font-size: 18px; }
</style>
