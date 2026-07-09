<script setup>
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import Icon from '../Icon.vue'
import TagInput from '../TagInput.vue'

const toast = useToast()
const loading = ref(false)
const saving = ref(false)

const blockList = ref([])
const sendBlockList = ref([])
const verifiedAddressList = ref([])
const fromBlockList = ref([])
const noLimitSendAddressList = ref([])
const addressCreationSettings = ref({})
const sendMailLimitConfig = ref(null)
const fullSettings = ref({})

async function load() {
  loading.value = true
  try {
    const res = await api.admin.getAccountSettings()
    fullSettings.value = res || {}
    blockList.value = res.blockList || []
    sendBlockList.value = res.sendBlockList || []
    verifiedAddressList.value = res.verifiedAddressList || []
    fromBlockList.value = res.fromBlockList || []
    noLimitSendAddressList.value = res.noLimitSendAddressList || []
    addressCreationSettings.value = res.addressCreationSettings || {}
    sendMailLimitConfig.value = res.sendMailLimitConfig || null
  } catch (e) {
    toast.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await api.admin.saveAccountSettings({
      ...fullSettings.value,
      blockList: blockList.value,
      sendBlockList: sendBlockList.value,
      verifiedAddressList: verifiedAddressList.value,
      fromBlockList: fromBlockList.value,
      noLimitSendAddressList: noLimitSendAddressList.value,
      addressCreationSettings: addressCreationSettings.value,
      sendMailLimitConfig: sendMailLimitConfig.value,
    })
    toast.success('设置已保存')
  } catch (e) {
    toast.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="panel">
    <div class="card">
      <div class="card__head">
        <h3 class="card__title">账户与黑名单设置</h3>
        <button class="btn btn--primary" :disabled="saving" @click="save">
          <Icon name="check" :size="16" /> {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>

      <div class="form-grid">
        <div class="form-row">
          <label>地址创建黑名单关键词</label>
          <p class="hint">包含这些关键词的地址将禁止普通用户创建（管理员可跳过）。</p>
          <TagInput v-model="blockList" placeholder="输入关键词后回车" />
        </div>

        <div class="form-row">
          <label>发件黑名单关键词</label>
          <p class="hint">发件目标包含这些关键词将被拒绝。</p>
          <TagInput v-model="sendBlockList" placeholder="输入关键词后回车" />
        </div>

        <div class="form-row">
          <label>已验证发件地址列表</label>
          <p class="hint">这些地址可通过 Cloudflare 内部 API 发信。</p>
          <TagInput v-model="verifiedAddressList" placeholder="输入地址后回车" />
        </div>

        <div class="form-row">
          <label>发件免额度地址列表</label>
          <p class="hint">这些发件地址不消耗发信额度。</p>
          <TagInput v-model="noLimitSendAddressList" placeholder="sender@example.com" />
        </div>

        <div class="form-row">
          <label>发件人黑名单（KV）</label>
          <p class="hint">需要后端启用 KV；用于过滤来源地址。</p>
          <TagInput v-model="fromBlockList" placeholder="spam@example.com" />
        </div>

        <label class="switch-row">
          <span class="switch-row__label">允许子域名匹配创建地址</span>
          <input v-model="addressCreationSettings.enableSubdomainMatch" type="checkbox" />
        </label>
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
  margin-bottom: var(--sp-4);
}
.card__title { margin: 0; font-size: 17px; }
</style>
