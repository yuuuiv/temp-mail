<script setup>
import { ref } from 'vue'
import { api, store } from '@/lib/api'
import { sha256Hex } from '@/lib/utils'
import { useMailbox } from '@/composables/useMailbox'
import { useToast } from '@/composables/useToast'
import Modal from './Modal.vue'
import Icon from './Icon.vue'
import Turnstile from './Turnstile.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
})
const emit = defineEmits(['update:show', 'unlocked'])

const { openSettings } = useMailbox()
const toast = useToast()

const password = ref('')
const cfToken = ref('')
const busy = ref(false)
const turnstileRef = ref(null)

async function submit() {
  if (!password.value) {
    toast.warning('请输入访问密码')
    return
  }
  busy.value = true
  try {
    await api.siteLogin({
      password: await sha256Hex(password.value),
      cf_token: cfToken.value,
    })
    // 校验通过：把明文密码存为 x-custom-auth
    store.auth = password.value
    toast.success('已解锁站点')
    emit('unlocked')
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
    title="私人站点 · 访问验证"
    size="sm"
    @update:show="emit('update:show', $event)"
  >
    <div class="site-auth">
      <div class="site-auth__icon">
        <Icon name="key" :size="26" />
      </div>
      <p class="site-auth__hint">此站点已启用访问密码，请输入以继续。</p>
      <form @submit.prevent="submit">
        <input
          v-model="password"
          class="field"
          type="password"
          placeholder="访问密码"
          autocomplete="current-password"
        />
        <Turnstile
          ref="turnstileRef"
          :site-key="openSettings.cfTurnstileSiteKey"
          @update:token="cfToken = $event"
        />
        <button class="btn btn--primary btn--block" :disabled="busy" type="submit">
          {{ busy ? '验证中…' : '解锁站点' }}
        </button>
      </form>
    </div>
  </Modal>
</template>

<style scoped>
.site-auth { text-align: center; }
.site-auth__icon {
  width: 56px;
  height: 56px;
  margin: 0 auto var(--sp-3);
  display: grid;
  place-items: center;
  border-radius: var(--radius-lg);
  background: var(--accent-soft);
  color: var(--accent);
}
.site-auth__hint {
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
