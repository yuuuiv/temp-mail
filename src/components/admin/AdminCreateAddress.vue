<script setup>
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { copyText } from '@/lib/utils'
import { useMailbox } from '@/composables/useMailbox'
import { useToast } from '@/composables/useToast'
import Icon from '../Icon.vue'
import Modal from '../Modal.vue'

const { openSettings } = useMailbox()
const toast = useToast()

const name = ref('')
const domain = ref('')
const enablePrefix = ref(false) // 无前缀创建 = false
const enableRandomSubdomain = ref(false)
const busy = ref(false)

const showResult = ref(false)
const result = ref({ address: '', jwt: '', password: '' })

function genRandomName() {
  const words = ['quiet', 'swift', 'silver', 'green', 'nova', 'pixel', 'river', 'cloud', 'mist', 'ember']
  const animals = ['otter', 'fox', 'lynx', 'panda', 'raven', 'koala', 'mink', 'heron', 'wolf', 'hawk']
  const max = openSettings.value.maxAddressLen || 30
  return `${words[Math.floor(Math.random() * words.length)]}-${animals[Math.floor(Math.random() * animals.length)]}-${Math.floor(1000 + Math.random() * 9000)}`.slice(0, max)
}

function fillRandomName() {
  name.value = genRandomName()
}

onMounted(() => {
  domain.value = (openSettings.value.allDomainOptions || openSettings.value.domainOptions)?.[0]?.value || ''
  if (openSettings.value.prefix) enablePrefix.value = true
})

async function create() {
  if (!domain.value) {
    toast.warning('请选择域名')
    return
  }
  if (!name.value.trim()) {
    toast.warning('请填写用户名')
    return
  }
  busy.value = true
  try {
    const res = await api.admin.newAddress({
      name: name.value.trim(),
      domain: domain.value,
      enablePrefix: enablePrefix.value,
      enableRandomSubdomain: enableRandomSubdomain.value,
    })
    result.value = {
      address: res.address || '',
      jwt: res.jwt || '',
      password: res.password || '',
    }
    showResult.value = true
    toast.success('创建成功')
    name.value = ''
  } catch (e) {
    toast.error(e.message || '创建失败')
  } finally {
    busy.value = false
  }
}

async function copy(text) {
  const ok = await copyText(text)
  toast[ok ? 'success' : 'error'](ok ? '已复制' : '复制失败')
}
</script>

<template>
  <div class="panel">
    <div class="card">
      <h3 class="card__title">创建邮箱地址</h3>
      <p class="hint">管理员可创建任意用户名的邮箱（可关闭前缀限制，创建无前缀邮箱）。</p>

      <div class="form-grid">
        <div class="addr-row">
          <div class="addr-input">
            <input v-model="name" class="ai-field mono" placeholder="用户名" />
            <span class="at">@</span>
            <select v-model="domain" class="ai-field ai-field--domain mono">
              <option v-for="d in (openSettings.allDomainOptions || openSettings.domainOptions)" :key="d.value" :value="d.value">
                {{ d.label }}
              </option>
            </select>
          </div>
          <button type="button" class="btn btn--ghost btn--sm" @click="fillRandomName">随机名称</button>
        </div>

        <label class="switch-row">
          <span class="switch-row__label">启用前缀（关闭则创建无前缀邮箱）</span>
          <input v-model="enablePrefix" type="checkbox" />
        </label>
        <label class="switch-row">
          <span class="switch-row__label">启用随机子域名</span>
          <input v-model="enableRandomSubdomain" type="checkbox" />
        </label>

        <button class="btn btn--primary" :disabled="busy" @click="create">
          <Icon name="plus" :size="16" /> {{ busy ? '创建中…' : '创建地址' }}
        </button>
      </div>
    </div>

    <Modal v-model:show="showResult" title="创建成功" size="md">
      <div class="result">
        <div class="result__row">
          <span class="result__label">地址</span>
          <code class="mono">{{ result.address }}</code>
          <button class="tbtn" @click="copy(result.address)"><Icon name="copy" :size="14" /></button>
        </div>
        <div v-if="result.password" class="result__row">
          <span class="result__label">密码</span>
          <code class="mono">{{ result.password }}</code>
          <button class="tbtn" @click="copy(result.password)"><Icon name="copy" :size="14" /></button>
        </div>
        <div class="result__row result__row--stack">
          <span class="result__label">凭证 (JWT)</span>
          <textarea class="field mono" rows="3" readonly :value="result.jwt" />
          <button class="btn btn--ghost" @click="copy(result.jwt)">复制凭证</button>
        </div>
      </div>
      <template #footer>
        <button class="btn btn--primary" @click="showResult = false">完成</button>
      </template>
    </Modal>
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
.card__title { margin: 0 0 6px; font-size: 17px; }
.card .hint { margin: 0 0 var(--sp-4); }

.addr-row {
  display: flex;
  gap: var(--sp-2);
}
.addr-input {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--surface-2);
  overflow: hidden;
}
.addr-input:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.ai-field {
  border: none;
  background: transparent;
  color: var(--text);
  padding: var(--sp-3) var(--sp-4);
  font-size: 15px;
  outline: none;
}
.ai-field:first-child { flex: 1; min-width: 0; }
.ai-field--domain { max-width: 45%; cursor: pointer; }
.btn--sm {
  padding: var(--sp-2) var(--sp-3);
  font-size: 13px;
  flex-shrink: 0;
}
.at { display: grid; place-items: center; padding: 0 var(--sp-2); color: var(--text-faint); font-family: var(--font-mono); }

.result { display: flex; flex-direction: column; gap: var(--sp-3); }
.result__row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.result__row--stack { flex-direction: column; align-items: stretch; }
.result__label {
  font-size: 12px;
  color: var(--text-faint);
  min-width: 68px;
}
.result code {
  flex: 1;
  background: var(--surface-2);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  word-break: break-all;
  font-size: 13px;
}
</style>
