<script setup>
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import Icon from '../Icon.vue'
import TagInput from '../TagInput.vue'

const toast = useToast()
const saving = ref(false)
const loading = ref(false)

const emailRuleSettings = ref({
  blockReceiveUnknowAddressEmail: false,
  emailForwardingList: [],
})
const fullSettings = ref({})

async function load() {
  loading.value = true
  try {
    const res = await api.admin.getAccountSettings()
    fullSettings.value = res || {}
    emailRuleSettings.value = res.emailRuleSettings || emailRuleSettings.value
  } catch (e) {
    toast.error(e.message || '加载失败')
  } finally { loading.value = false }
}

async function save() {
  saving.value = true
  try {
    await api.admin.saveAccountSettings({
      ...fullSettings.value,
      blockList: fullSettings.value.blockList || [],
      sendBlockList: fullSettings.value.sendBlockList || [],
      verifiedAddressList: fullSettings.value.verifiedAddressList || [],
      emailRuleSettings: emailRuleSettings.value,
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
        <h3 class="card__title">邮件规则与转发</h3>
        <button class="btn btn--primary" :disabled="saving" @click="save">
          <Icon name="check" :size="16" /> {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
      <p class="hint">配置邮件接收规则、转发地址等。此设置与"黑名单/设置"共享后端端点。</p>

      <div class="form-grid">
        <label class="switch-row">
          <span class="switch-row__label">拦截未知地址邮件</span>
          <input v-model="emailRuleSettings.blockReceiveUnknowAddressEmail" type="checkbox" />
        </label>

        <div class="form-row">
          <label>邮件转发地址列表</label>
          <p class="hint">所有收件将转发到这些地址。</p>
          <TagInput v-model="emailRuleSettings.emailForwardingList" placeholder="forward@example.com" />
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
