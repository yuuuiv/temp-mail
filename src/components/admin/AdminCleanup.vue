<script setup>
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import Icon from '../Icon.vue'

const toast = useToast()
const loading = ref(false)
const saving = ref(false)

// 自动清理设置
const cfg = ref({
  enableMailsAutoCleanup: false,
  mailsActiveDaysToCleanup: 30,
  enableUnknowMailsAutoCleanup: false,
  unknowMailsActiveDaysToCleanup: 30,
  enableSendBoxAutoCleanup: false,
  sendBoxActiveDaysToCleanup: 30,
  enableAddressAutoCleanup: false,
  addressActiveDaysToCleanup: 30,
})

// 立即清理
const manual = ref({
  cleanType: 'mails',
  cleanDays: 30,
})
const cleanTypes = [
  { label: '收件邮件', value: 'mails' },
  { label: '未知邮件', value: 'mails_unknow' },
  { label: '发件箱', value: 'sendbox' },
  { label: '闲置地址', value: 'addressData' },
]

async function load() {
  loading.value = true
  try {
    const res = await api.admin.getAutoCleanup()
    if (res && typeof res === 'object') Object.assign(cfg.value, res)
  } catch (e) {
    toast.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await api.admin.saveAutoCleanup(cfg.value)
    toast.success('清理策略已保存')
  } catch (e) {
    toast.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function runNow() {
  if (!confirm(`确认立即清理 ${manual.value.cleanDays} 天前的数据？此操作不可撤销。`)) return
  try {
    await api.admin.cleanupNow({
      cleanType: manual.value.cleanType,
      cleanDays: Number(manual.value.cleanDays),
    })
    toast.success('清理任务已执行')
  } catch (e) {
    toast.error(e.message || '清理失败')
  }
}

onMounted(load)
</script>

<template>
  <div class="panel">
    <div class="card">
      <h3 class="card__title">立即清理</h3>
      <p class="hint">按类型和天数手动清理数据。</p>
      <div class="row-inline">
        <select v-model="manual.cleanType" class="field">
          <option v-for="t in cleanTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
        <input v-model="manual.cleanDays" class="field" type="number" min="0" style="max-width:120px" />
        <span class="dim">天前</span>
        <button class="btn btn--primary" @click="runNow">
          <Icon name="trash" :size="16" /> 执行
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card__head">
        <h3 class="card__title">定时自动清理</h3>
        <button class="btn btn--primary" :disabled="saving" @click="save">
          <Icon name="check" :size="16" /> {{ saving ? '保存中…' : '保存策略' }}
        </button>
      </div>

      <div class="form-grid">
        <div class="clean-item">
          <label class="switch-row">
            <span class="switch-row__label">自动清理收件邮件</span>
            <input v-model="cfg.enableMailsAutoCleanup" type="checkbox" />
          </label>
          <div v-if="cfg.enableMailsAutoCleanup" class="clean-days">
            保留最近 <input v-model="cfg.mailsActiveDaysToCleanup" class="field" type="number" min="1" /> 天
          </div>
        </div>

        <div class="clean-item">
          <label class="switch-row">
            <span class="switch-row__label">自动清理未知邮件</span>
            <input v-model="cfg.enableUnknowMailsAutoCleanup" type="checkbox" />
          </label>
          <div v-if="cfg.enableUnknowMailsAutoCleanup" class="clean-days">
            保留最近 <input v-model="cfg.unknowMailsActiveDaysToCleanup" class="field" type="number" min="1" /> 天
          </div>
        </div>

        <div class="clean-item">
          <label class="switch-row">
            <span class="switch-row__label">自动清理发件箱</span>
            <input v-model="cfg.enableSendBoxAutoCleanup" type="checkbox" />
          </label>
          <div v-if="cfg.enableSendBoxAutoCleanup" class="clean-days">
            保留最近 <input v-model="cfg.sendBoxActiveDaysToCleanup" class="field" type="number" min="1" /> 天
          </div>
        </div>

        <div class="clean-item">
          <label class="switch-row">
            <span class="switch-row__label">自动清理闲置地址</span>
            <input v-model="cfg.enableAddressAutoCleanup" type="checkbox" />
          </label>
          <div v-if="cfg.enableAddressAutoCleanup" class="clean-days">
            清理 <input v-model="cfg.addressActiveDaysToCleanup" class="field" type="number" min="1" /> 天未活跃地址
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./admin-shared.css"></style>
<style scoped>
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--sp-5);
}
.card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp-2);
}
.card__title { margin: 0; font-size: 17px; }
.card .hint { margin: 4px 0 var(--sp-4); }
.row-inline {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.row-inline .field { width: auto; }
.clean-item { display: flex; flex-direction: column; gap: var(--sp-2); }
.clean-days {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: 13px;
  color: var(--text-muted);
  padding-left: var(--sp-2);
}
.clean-days .field { width: 90px; }
</style>
