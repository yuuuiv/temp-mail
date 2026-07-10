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
const users = ref([])
const selectedUserIds = ref([])
const userForwarding = ref('')
const applying = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await api.admin.getAccountSettings()
    fullSettings.value = res || {}
    emailRuleSettings.value = res.emailRuleSettings || emailRuleSettings.value
    const usersRes = await api.admin.listUsers({ limit: 100, offset: 0 })
    users.value = usersRes.results || []
  } catch (e) {
    toast.error(e.message || '加载失败')
  } finally { loading.value = false }
}

function toggleUser(id) {
  selectedUserIds.value = selectedUserIds.value.includes(id)
    ? selectedUserIds.value.filter((value) => value !== id)
    : [...selectedUserIds.value, id]
}

async function applyToUsers() {
  if (!selectedUserIds.value.length) {
    toast.warning('请至少选择一个用户')
    return
  }
  const targets = userForwarding.value.split(',').map((value) => value.trim()).filter(Boolean)
  applying.value = true
  try {
    for (const userId of selectedUserIds.value) {
      const res = await api.admin.listUserAddresses(userId)
      for (const address of res.results || []) {
        await api.admin.saveAddressForwardingRules(
          address.id,
          targets.map((forward) => ({ domains: [], sourcePatterns: [], sourceMatchMode: 'any', forward }))
        )
      }
    }
    toast.success('已将转发规则应用到所选用户的全部邮箱')
  } catch (e) {
    toast.error(e.message || '应用用户转发规则失败')
  } finally {
    applying.value = false
  }
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

    <div class="card">
      <div class="card__head">
        <h3 class="card__title">用户邮件规则与转发</h3>
        <button class="btn btn--primary" :disabled="applying" @click="applyToUsers">
          <Icon name="check" :size="16" /> {{ applying ? '应用中…' : '应用到所选用户' }}
        </button>
      </div>
      <p class="hint">选择一个或多个用户。规则会应用到其当前已绑定的全部临时邮箱。</p>
      <div class="user-picker">
        <label v-for="user in users" :key="user.id" class="user-option">
          <input type="checkbox" :checked="selectedUserIds.includes(user.id)" @change="toggleUser(user.id)" />
          <span class="mono">{{ user.user_email }}</span>
          <small>{{ user.address_count || 0 }} 个邮箱</small>
        </label>
        <p v-if="!users.length && !loading" class="hint">暂无可选用户。</p>
      </div>
      <div class="form-row">
        <label>转发到（多个地址用逗号分隔）</label>
        <input v-model="userForwarding" class="field mono" placeholder="forward@example.com" />
        <p class="hint">留空后应用，会清除所选用户邮箱的转发规则。</p>
      </div>
    </div>
  </div>
</template>

<style scoped src="./admin-shared.css"></style>
<style scoped>
.card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:var(--sp-5); }
.card__head { display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--sp-4); }
.card__title { margin:0; font-size:17px; }
.panel { display:grid; gap:var(--sp-4); }
.user-picker { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:8px; margin:var(--sp-3) 0; }
.user-option { display:flex; align-items:center; gap:8px; padding:10px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface-2); min-width:0; }
.user-option span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.user-option small { margin-left:auto; color:var(--text-faint); white-space:nowrap; }
.field { width:100%; padding:var(--sp-3); border:1px solid var(--border-strong); border-radius:var(--radius); background:var(--surface-2); color:var(--text); }
</style>
