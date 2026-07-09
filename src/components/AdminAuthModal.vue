<script setup>
import { ref } from 'vue'
import { api } from '@/lib/api'
import { sha256Hex } from '@/lib/utils'
import { useMailbox } from '@/composables/useMailbox'
import { useAdmin } from '@/composables/useAdmin'
import { useToast } from '@/composables/useToast'
import Modal from './Modal.vue'
import Icon from './Icon.vue'
import Turnstile from './Turnstile.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
})
const emit = defineEmits(['update:show', 'authed'])

const { openSettings } = useMailbox()
const { setAdminPassword, enterAdmin } = useAdmin()
const toast = useToast()

const password = ref('')
const cfToken = ref('')
const busy = ref(false)
const turnstileRef = ref(null)

async function submit() {
  if (!password.value) {
    toast.warning('请输入管理员密码')
    return
  }
  busy.value = true
  try {
    await api.adminLogin({
      password: await sha256Hex(password.value),
      cf_token: cfToken.value,
    })
    // 校验通过：明文作为 x-admin-auth
    setAdminPassword(password.value)
    toast.success('管理员已登录')
    emit('authed')
    enterAdmin()
    emit('update:show', false)
    password.value = ''
  } catch (e) {
    toast.error(e.message || '密码错误')
    turnstileRef.value?.reset?.()
    cfToken.value = ''
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Modal
    :show="show"
    title="管理员登录"
    size="sm"
    @update:show="emit('update:show', $event)"
  >
    <div class="admin-auth">
      <div class="admin-auth__icon">
        <Icon name="settings" :size="26" />
      </div>
      <p class="admin-auth__hint">请输入管理员密码进入控制台。</p>
      <form @submit.prevent="submit">
        <input
          v-model="password"
          class="field"
          type="password"
          placeholder="管理员密码"
          autocomplete="current-password"
        />
        <Turnstile
          ref="turnstileRef"
          :site-key="openSettings.cfTurnstileSiteKey"
          @update:token="cfToken = $event"
        />
        <button class="btn btn--primary btn--block" :disabled="busy" type="submit">
          {{ busy ? '登录中…' : '进入控制台' }}
        </button>
      </form>
    </div>
  </Modal>
</template>

<style scoped>
.admin-auth { text-align: center; }
.admin-auth__icon {
  width: 56px;
  height: 56px;
  margin: 0 auto var(--sp-3);
  display: grid;
  place-items: center;
  border-radius: var(--radius-lg);
  background: var(--accent-soft);
  color: var(--accent);
}
.admin-auth__hint {
  color: var(--text-muted);
  font-size: 14px;
  margin: 0 0 var(--sp-4);
}
form { display: flex; flex-direction: column; gap: var(--sp-3); }
.field {
  width: 100%;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--text);
  font-size: 15px;
}
.field:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid transparent;
  border-radius: var(--radius);
  font-weight: 600;
  font-family: var(--font-display);
}
.btn--block { width: 100%; }
.btn--primary { background: var(--accent); color: var(--accent-contrast); }
.btn--primary:hover:not(:disabled) { background: var(--accent-strong); }
.btn--primary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
