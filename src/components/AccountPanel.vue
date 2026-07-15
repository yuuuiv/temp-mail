<script setup>
import { ref } from 'vue'
import { api, store } from '@/lib/api'
import { sha256Hex, copyText } from '@/lib/utils'
import { useMailbox } from '@/composables/useMailbox'
import { useToast } from '@/composables/useToast'
import Icon from './Icon.vue'
import Modal from './Modal.vue'

const { openSettings, settings, logout, loadMails } = useMailbox()
const toast = useToast()

const showCredential = ref(false)
const showPassword = ref(false)
const newPassword = ref('')
const confirmPassword = ref('')
const busy = ref(false)

async function copyCredential() {
  const ok = await copyText(store.jwt)
  toast[ok ? 'success' : 'error'](ok ? '凭证已复制' : '复制失败')
}

async function changePassword() {
  if (!newPassword.value || newPassword.value !== confirmPassword.value) {
    toast.warning('两次输入的新密码不一致')
    return
  }
  busy.value = true
  try {
    await api.changeAddressPassword(await sha256Hex(newPassword.value))
    toast.success('地址密码已修改')
    newPassword.value = ''
    confirmPassword.value = ''
    showPassword.value = false
  } catch (e) {
    toast.error(e.message || '修改失败')
  } finally { busy.value = false }
}

async function clearInbox() {
  if (!confirm('确认清空当前邮箱收件箱？此操作不可撤销。')) return
  busy.value = true
  try {
    await api.clearInbox()
    await loadMails(1)
    toast.success('收件箱已清空')
  } catch (e) {
    toast.error(e.message || '清空失败')
  } finally { busy.value = false }
}

async function clearSent() {
  if (!confirm('确认清空当前邮箱发件箱？此操作不可撤销。')) return
  busy.value = true
  try {
    await api.clearSentItems()
    toast.success('发件箱已清空')
  } catch (e) {
    toast.error(e.message || '清空失败')
  } finally { busy.value = false }
}

async function deleteAddress() {
  if (!confirm(`确认删除 ${settings.value.address} 及其所有数据？此操作不可撤销。`)) return
  busy.value = true
  try {
    await api.deleteAddress()
    logout()
    toast.success('邮箱地址已删除')
  } catch (e) {
    toast.error(e.message || '删除失败')
  } finally { busy.value = false }
}

function doLogout() {
  logout()
  toast.info('已退出当前邮箱')
}
</script>

<template>
  <div class="account panel">
    <div class="card">
      <h2 class="view-title">邮箱设置</h2>
      <p class="hint">当前邮箱：<code class="mono">{{ settings.address }}</code></p>

      <div class="actions-grid">
        <button class="btn btn--primary" @click="showCredential = true">
          <Icon name="key" :size="16" /> 查看地址凭证
        </button>
        <button v-if="openSettings.enableAddressPassword" class="btn btn--ghost" @click="showPassword = true">
          <Icon name="settings" :size="16" /> 修改地址密码
        </button>
        <button v-if="openSettings.enableUserDeleteEmail" class="btn btn--ghost" :disabled="busy" @click="clearInbox">
          <Icon name="inbox" :size="16" /> 清空收件箱
        </button>
        <button v-if="openSettings.enableUserDeleteEmail" class="btn btn--ghost" :disabled="busy" @click="clearSent">
          <Icon name="send" :size="16" /> 清空发件箱
        </button>
        <button class="btn btn--ghost" @click="doLogout">
          <Icon name="logout" :size="16" /> 退出邮箱
        </button>
        <button v-if="openSettings.enableUserDeleteEmail" class="btn btn--danger" :disabled="busy" @click="deleteAddress">
          <Icon name="trash" :size="16" /> 删除邮箱
        </button>
      </div>
    </div>

    <div v-if="openSettings.smtpImapProxyConfig" class="card">
      <h3 class="card-title">SMTP / IMAP 代理</h3>
      <div class="proxy-grid">
        <div>
          <div class="dim">SMTP</div>
          <code class="mono">{{ openSettings.smtpImapProxyConfig.smtp?.host || '-' }}:{{ openSettings.smtpImapProxyConfig.smtp?.port || '-' }}</code>
        </div>
        <div>
          <div class="dim">IMAP</div>
          <code class="mono">{{ openSettings.smtpImapProxyConfig.imap?.host || '-' }}:{{ openSettings.smtpImapProxyConfig.imap?.port || '-' }}</code>
        </div>
      </div>
    </div>

    <Modal v-model:show="showCredential" title="地址凭证" size="md">
      <div class="credential-view">
        <div class="credential-view__warning">
          <Icon name="alert" :size="16" />
          <span>凭证等同于邮箱登录态，请只保存到可信位置。切勿分享或提交到代码仓库。</span>
        </div>
        <div class="credential-view__label">JWT 令牌</div>
        <div class="credential-view__value-wrap">
          <code class="credential-view__value mono">{{ store.jwt }}</code>
          <button class="credential-view__copy" title="复制凭证" @click="copyCredential">
            <Icon name="copy" :size="15" />
          </button>
        </div>
        <div class="credential-view__meta">
          <Icon name="clock" :size="13" />
          <span v-if="store.jwt">令牌字符数：{{ store.jwt.length }}</span>
          <span v-else>未获取到凭证</span>
        </div>
      </div>
      <template #footer>
        <button class="btn btn--ghost" @click="showCredential = false">关闭</button>
        <button class="btn btn--primary" @click="copyCredential">复制凭证</button>
      </template>
    </Modal>

    <Modal v-model:show="showPassword" title="修改地址密码" size="sm">
      <div class="form-grid">
        <div class="form-row">
          <label>新密码</label>
          <input v-model="newPassword" class="field" type="password" />
        </div>
        <div class="form-row">
          <label>确认新密码</label>
          <input v-model="confirmPassword" class="field" type="password" @keydown.enter="changePassword" />
        </div>
      </div>
      <template #footer>
        <button class="btn btn--ghost" @click="showPassword = false">取消</button>
        <button class="btn btn--primary" :disabled="busy" @click="changePassword">保存</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped src="./admin/admin-shared.css"></style>
<style scoped>
.account { padding: var(--sp-5); max-width: 920px; height: 100%; overflow-y: auto; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--sp-5); }
.view-title { margin: 0 0 var(--sp-2); font-size: 18px; }
.card-title { margin: 0 0 var(--sp-3); font-size: 16px; }
.actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--sp-3); margin-top: var(--sp-4); }
.btn--danger { background: var(--danger); color: white; }
.btn--danger:hover:not(:disabled) { filter: brightness(.95); }
.proxy-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--sp-4); }

/* 凭证展示 */
.credential-view { display: flex; flex-direction: column; gap: var(--sp-3); }
.credential-view__warning {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border: 1px solid var(--danger);
  border-radius: var(--radius);
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 13px;
  line-height: 1.5;
}
.credential-view__warning :first-child { flex-shrink: 0; margin-top: 1px; }
.credential-view__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.credential-view__value-wrap {
  display: flex;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface-2);
}
.credential-view__value {
  flex: 1;
  min-width: 0;
  padding: var(--sp-3);
  font-size: 13px;
  word-break: break-all;
  overflow-wrap: anywhere;
  line-height: 1.55;
  max-height: 140px;
  overflow-y: auto;
}
.credential-view__copy {
  display: grid;
  place-items: center;
  width: 42px;
  flex-shrink: 0;
  border: none;
  border-left: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--dur), color var(--dur);
}
.credential-view__copy:hover { background: var(--surface-hover); color: var(--accent); }
.credential-view__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-faint);
  font-size: 12px;
}
</style>
