<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { copyText } from '@/lib/utils'
import { useAuthModule } from '@/composables/useAuthModule'
import { useToast } from '@/composables/useToast'
import Icon from './Icon.vue'
import Turnstile from './Turnstile.vue'

const emit = defineEmits(['close'])

const {
  enabled,
  settings,
  jwt,
  user,
  loading,
  isLoggedIn,
  loadSettings,
  loadUser,
  startOAuth,
  emailLogin,
  sendEmailCode,
  emailRegister,
  web3Login,
  logout,
} = useAuthModule()
const toast = useToast()

const tab = ref('login')
const email = ref('')
const password = ref('')
const verifyCode = ref('')
const cfToken = ref('')
const busy = ref(false)
const codeTimeout = ref(0)
const hasEthereum = computed(() => typeof window !== 'undefined' && !!window.ethereum)
const siteKey = computed(() => settings.value.cf_turnstile_site_key || '')
const canCompleteLogin = computed(() => api.auth.hasAppSecret)
const providers = computed(() => [
  settings.value.enabled_github && { type: 'github', label: 'GitHub 登录' },
  settings.value.enabled_google && { type: 'google', label: 'Google 登录' },
  settings.value.enabled_ms && { type: 'ms', label: 'Microsoft 登录' },
].filter(Boolean))

onMounted(async () => {
  await loadSettings()
  if (jwt.value && !user.value) {
    try { await loadUser() } catch { logout() }
  }
})

function startCountdown(seconds) {
  codeTimeout.value = Number(seconds) || 120
  const timer = setInterval(() => {
    codeTimeout.value -= 1
    if (codeTimeout.value <= 0) {
      codeTimeout.value = 0
      clearInterval(timer)
    }
  }, 1000)
}

async function doOAuth(type) {
  if (!canCompleteLogin.value) {
    toast.warning('请先配置 VITE_AUTH_APP_SECRET')
    return
  }
  busy.value = true
  try {
    await startOAuth(type)
  } catch (e) {
    toast.error(e.message || '第三方登录初始化失败')
    busy.value = false
  }
}

async function doWeb3() {
  if (!canCompleteLogin.value) {
    toast.warning('请先配置 VITE_AUTH_APP_SECRET')
    return
  }
  busy.value = true
  try {
    await web3Login()
    toast.success('Web3 登录成功')
    emit('close')
  } catch (e) {
    toast.error(e.message || 'Web3 登录失败')
  } finally {
    busy.value = false
  }
}

async function doEmailLogin() {
  if (!email.value || !password.value) {
    toast.warning('请填写邮箱和密码')
    return
  }
  if (!canCompleteLogin.value) {
    toast.warning('请先配置 VITE_AUTH_APP_SECRET')
    return
  }
  busy.value = true
  try {
    await emailLogin({ email: email.value.trim(), password: password.value })
    toast.success('登录成功')
    emit('close')
  } catch (e) {
    toast.error(e.message || '登录失败')
  } finally {
    busy.value = false
  }
}

async function sendCode() {
  if (!email.value) {
    toast.warning('请填写邮箱')
    return
  }
  if (siteKey.value && !cfToken.value) {
    toast.warning('请先完成人机验证')
    return
  }
  busy.value = true
  try {
    const res = await sendEmailCode({ email: email.value.trim(), cf_token: cfToken.value })
    startCountdown(res?.timeout || 120)
    toast.success('验证码已发送，请查收')
  } catch (e) {
    toast.error(e.message || '发送验证码失败')
  } finally {
    busy.value = false
  }
}

async function doEmailRegister() {
  if (!email.value || !password.value || !verifyCode.value) {
    toast.warning('请填写邮箱、密码和验证码')
    return
  }
  busy.value = true
  try {
    await emailRegister({
      email: email.value.trim(),
      password: password.value,
      code: verifyCode.value.trim(),
    })
    toast.success('注册成功，请登录')
    tab.value = 'login'
    verifyCode.value = ''
  } catch (e) {
    toast.error(e.message || '注册失败')
  } finally {
    busy.value = false
  }
}

async function refreshUser() {
  busy.value = true
  try {
    await loadUser()
    toast.success('用户资料已刷新')
  } catch (e) {
    toast.error(e.message || '刷新失败')
  } finally {
    busy.value = false
  }
}

async function copyJwt() {
  const ok = await copyText(jwt.value)
  toast[ok ? 'success' : 'error'](ok ? 'JWT 已复制' : '复制失败')
}

function doLogout() {
  logout()
  toast.info('用户已退出')
}
</script>

<template>
  <div class="auth-panel">
    <div v-if="!enabled" class="notice">
      未配置统一账户服务。请在前端环境变量中设置 VITE_AUTH_API_BASE。
    </div>

    <div v-else-if="loading && !settings.fetched" class="notice">
      正在连接统一账户服务…
    </div>

    <div v-else-if="!settings.available" class="notice danger">
      统一账户服务不可用：{{ settings.error || '无法获取 /api/settings' }}
    </div>

    <template v-else>
      <div v-if="!canCompleteLogin" class="notice">
        当前仅完成了账户服务 API 地址配置；还需要 VITE_AUTH_APP_SECRET 才能在前端用 code 换取 JWT。
      </div>

      <template v-if="isLoggedIn">
        <div class="user-card">
          <div class="avatar">
            {{ (user?.user_email || user?.user_name || 'U').slice(0, 2).toUpperCase() }}
          </div>
          <div class="user-card__main">
            <div class="user-card__label">当前用户</div>
            <div class="mono user-card__email">{{ user?.user_email || user?.user_name || '已登录' }}</div>
            <div class="user-card__meta">
              {{ user?.login_type || '账户' }}
              <span v-if="user?.expire_at"> · 过期 {{ new Date(user.expire_at * 1000).toLocaleString('zh-CN') }}</span>
            </div>
          </div>
        </div>

        <div class="panel-actions">
          <button class="btn btn--ghost" :disabled="busy" @click="refreshUser">刷新资料</button>
          <button class="btn btn--ghost" :disabled="busy" @click="copyJwt">复制 JWT</button>
          <button class="btn btn--ghost danger" :disabled="busy" @click="doLogout">退出登录</button>
        </div>
      </template>

      <template v-else>
        <div class="tabs">
          <button class="tabs__btn" :class="{ 'is-active': tab === 'login' }" @click="tab = 'login'">
            <Icon name="key" :size="14" /> 登录
          </button>
          <button
            v-if="settings.enabled_smtp"
            class="tabs__btn"
            :class="{ 'is-active': tab === 'register' }"
            @click="tab = 'register'"
          >
            <Icon name="plus" :size="14" /> 注册
          </button>
        </div>

        <div v-if="providers.length || settings.enabled_web3" class="oauth-list">
          <button
            v-for="provider in providers"
            :key="provider.type"
            class="btn btn--ghost btn--block"
            :disabled="busy || !canCompleteLogin"
            type="button"
            @click="doOAuth(provider.type)"
          >
            <Icon name="key" :size="16" />
            {{ provider.label }}
          </button>
          <button
            v-if="settings.enabled_web3"
            class="btn btn--ghost btn--block"
            :disabled="busy || !canCompleteLogin || !hasEthereum"
            type="button"
            @click="doWeb3"
          >
            <Icon name="key" :size="16" />
            {{ hasEthereum ? 'MetaMask 登录' : 'MetaMask 未安装' }}
          </button>
        </div>

        <div v-if="providers.length && settings.enabled_smtp" class="divider">
          <span>或使用邮箱</span>
        </div>

        <form
          v-if="settings.enabled_smtp"
          class="form"
          @submit.prevent="tab === 'login' ? doEmailLogin() : doEmailRegister()"
        >
          <input v-model="email" class="field mono" type="email" placeholder="用户邮箱" autocomplete="email" />
          <input
            v-model="password"
            class="field"
            type="password"
            placeholder="密码"
            :autocomplete="tab === 'login' ? 'current-password' : 'new-password'"
          />
          <template v-if="tab === 'register'">
            <Turnstile :site-key="siteKey" @update:token="cfToken = $event" />
            <div class="code-row">
              <input v-model="verifyCode" class="field mono" type="text" placeholder="验证码" />
              <button type="button" class="btn btn--ghost" :disabled="busy || codeTimeout > 0" @click="sendCode">
                {{ codeTimeout > 0 ? `${codeTimeout}s` : '发送验证码' }}
              </button>
            </div>
          </template>

          <button class="btn btn--primary btn--block" :disabled="busy || !canCompleteLogin" type="submit">
            {{ busy ? '处理中…' : (tab === 'login' ? '邮箱登录' : '注册') }}
          </button>
        </form>

        <p v-else class="empty">
          统一账户服务未启用邮箱密码登录，请使用上方第三方登录。
        </p>
      </template>
    </template>
  </div>
</template>

<style scoped>
.auth-panel { display:flex; flex-direction:column; gap:var(--sp-4); }
.tabs { display:flex; gap:var(--sp-2); justify-content:center; }
.tabs__btn {
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:var(--sp-2) var(--sp-4);
  border:1px solid var(--border);
  border-radius:var(--radius-pill);
  background:var(--surface-2);
  color:var(--text-muted);
  font-size:13px;
  font-weight:500;
}
.tabs__btn.is-active { background:var(--accent); border-color:var(--accent); color:var(--accent-contrast); }
.oauth-list,
.form { display:flex; flex-direction:column; gap:var(--sp-3); }
.field {
  width:100%;
  padding:var(--sp-3);
  border:1px solid var(--border-strong);
  border-radius:var(--radius);
  background:var(--surface-2);
  color:var(--text);
  font-size:14px;
}
.field:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
.btn {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  padding:var(--sp-3) var(--sp-4);
  border:1px solid transparent;
  border-radius:var(--radius);
  font-weight:600;
  font-family:var(--font-display);
  font-size:14px;
}
.btn--block { width:100%; }
.btn--primary { background:var(--accent); color:var(--accent-contrast); }
.btn--primary:hover:not(:disabled) { background:var(--accent-strong); }
.btn:disabled { opacity:.6; cursor:not-allowed; }
.btn--ghost { background:var(--surface-2); color:var(--text-2); border-color:var(--border); }
.btn--ghost:hover:not(:disabled) { background:var(--surface-hover); }
.btn--ghost.danger:hover:not(:disabled) { color:var(--danger); border-color:var(--danger); background:var(--danger-soft); }
.notice {
  padding:var(--sp-4);
  border:1px solid var(--border);
  border-radius:var(--radius);
  color:var(--text-muted);
  background:var(--surface-2);
  line-height:1.55;
}
.notice.danger { color:var(--danger); border-color:var(--danger); background:var(--danger-soft); }
.divider {
  display:flex;
  align-items:center;
  gap:var(--sp-3);
  color:var(--text-faint);
  font-size:12px;
}
.divider::before,
.divider::after {
  content:'';
  height:1px;
  flex:1;
  background:var(--border);
}
.code-row { display:grid; grid-template-columns:1fr auto; gap:var(--sp-2); }
.user-card {
  display:flex;
  align-items:center;
  gap:var(--sp-3);
  padding:var(--sp-4);
  border:1px solid var(--border);
  border-radius:var(--radius);
  background:var(--surface-2);
}
.avatar {
  display:grid;
  place-items:center;
  width:42px;
  height:42px;
  flex-shrink:0;
  border-radius:var(--radius-pill);
  background:var(--accent);
  color:var(--accent-contrast);
  font-family:var(--font-display);
  font-weight:700;
}
.user-card__main { min-width:0; }
.user-card__label { font-size:12px; color:var(--text-faint); margin-bottom:4px; }
.user-card__email { font-size:14px; word-break:break-all; }
.user-card__meta { margin-top:4px; color:var(--text-faint); font-size:12px; }
.panel-actions { display:flex; gap:var(--sp-2); flex-wrap:wrap; }
.empty { margin:0; color:var(--text-faint); text-align:center; }
</style>
