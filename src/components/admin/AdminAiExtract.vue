<script setup>
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import Icon from '../Icon.vue'
import TagInput from '../TagInput.vue'

const toast = useToast()
const loading = ref(false)
const saving = ref(false)

const cfg = ref({ enableAllowList: false, allowList: [] })

async function load() {
  loading.value = true
  try {
    const res = await api.fetch('/admin/ai_extract/settings')
    Object.assign(cfg.value, res || {})
  } catch (e) {
    toast.error(e.message || '加载失败')
  } finally { loading.value = false }
}

async function save() {
  saving.value = true
  try {
    await api.fetch('/admin/ai_extract/settings', {
      method: 'POST',
      body: JSON.stringify(cfg.value),
    })
    toast.success('已保存')
  } catch (e) {
    toast.error(e.message || '保存失败')
  } finally { saving.value = false }
}

onMounted(load)
</script>

<template>
  <div class="panel">
    <div class="card">
      <div class="card__head">
        <h3 class="card__title">AI 邮件提取设置</h3>
        <button class="btn btn--primary" :disabled="saving" @click="save">
          <Icon name="check" :size="16" /> {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
      <p class="hint">此功能依赖 Cloudflare Workers AI 绑定（或内置正则兜底）。启用白名单后仅匹配地址进行 AI 提取。</p>

      <div class="form-grid">
        <label class="switch-row">
          <span class="switch-row__label">启用地址白名单</span>
          <input v-model="cfg.enableAllowList" type="checkbox" />
        </label>
        <div v-if="cfg.enableAllowList" class="form-row">
          <label>允许地址列表（支持通配符如 *@example.com）</label>
          <TagInput v-model="cfg.allowList" placeholder="*@example.com" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./admin-shared.css"></style>
<style scoped>
.card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:var(--sp-5); }
.card__head { display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--sp-4); }
.card__title { margin:0; font-size:17px; }
</style>
