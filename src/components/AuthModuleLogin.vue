<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { useAuthModule } from '@/composables/useAuthModule'
import { useToast } from '@/composables/useToast'
import AuthProviderLogo from './AuthProviderLogo.vue'
import Icon from './Icon.vue'
import Turnstile from './Turnstile.vue'

const emit = defineEmits(['close', 'mailboxes'])

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
const siteKey = computed(() => settings.value.cf_turnstile_site_key || '')
const canCompleteLogin = computed(() => api.auth.hasAppSecret)
const providers = computed(() => [
  settings.value.enabled_github && { type: 'github', label: 'GitHub 登录' },
  settings.value.enabled_google && { type: 'google', label: 'Google 登录' },
  settings.value.enabled_ms && { type: 'ms', label: 'Microsoft 登录', icon: 'key' },
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
    emit('mailboxes')
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

function doLogout() {
  logout()
  toast.info('用户已退出')
}
</script>

<template>
  <div class="auth-widget">
    <!-- 未配置 -->
    <div v-if="!enabled" class="notice">
      未配置统一账户服务。请在前端环境变量中设置 VITE_AUTH_API_BASE。
    </div>

    <!-- 连接中 -->
    <div v-else-if="loading && !settings.fetched" class="notice">
      <span class="spinner" /> 正在连接统一账户服务…
    </div>

    <!-- 不可用 -->
    <div v-else-if="!settings.available" class="notice danger">
      统一账户服务不可用：{{ settings.error || '无法获取 /api/settings' }}
    </div>

    <template v-else>
      <!-- 缺少 App Secret 提示 -->
      <div v-if="!canCompleteLogin" class="notice">
        当前仅完成了账户服务 API 地址配置；还需要 VITE_AUTH_APP_SECRET 才能在前端用 code 换取 JWT。
      </div>

      <!-- ========== 已登录 ========== -->
      <template v-if="isLoggedIn">
        <div class="profile-card">
          <div class="profile-card__avatar">
            <span class="profile-card__initials">{{ (user?.user_email || user?.user_name || 'U').slice(0, 2).toUpperCase() }}</span>
          </div>
          <div class="profile-card__info">
            <div class="profile-card__label">当前用户</div>
            <div class="profile-card__email mono">{{ user?.user_email || user?.user_name || '已登录' }}</div>
            <div class="profile-card__meta">
              {{ user?.login_type || '账户' }}
              <span v-if="user?.expire_at"> · {{ new Date(user.expire_at * 1000).toLocaleString('zh-CN') }}</span>
            </div>
          </div>
        </div>

        <div class="profile-actions">
          <button class="btn btn--ghost" :disabled="busy" @click="refreshUser">
            <Icon name="refresh" :size="15" /> 刷新
          </button>
          <button class="btn btn--primary" :disabled="busy" @click="emit('mailboxes')">
            <Icon name="mail" :size="15" /> 邮箱一览
          </button>
          <button class="btn btn--ghost btn--danger" :disabled="busy" @click="doLogout">
            <Icon name="logout" :size="15" /> 退出
          </button>
        </div>
      </template>

      <!-- ========== 未登录 ========== -->
      <template v-else>
        <div class="auth-header">
          <div class="auth-header__icon"><Icon name="key" :size="22" /></div>
          <div class="auth-header__title">用户登录</div>
          <div class="auth-header__sub">使用统一账户服务管理您的临时邮箱</div>
        </div>

        <!-- 第三方登录 -->
        <div v-if="providers.length" class="social-section">
          <div class="social-btns">
            <button
              v-for="provider in providers"
              :key="provider.type"
              class="social-btn"
              :disabled="busy || !canCompleteLogin"
              type="button"
              @click="doOAuth(provider.type)"
            >
              <span class="social-btn__icon" :class="{ 'social-btn__icon--brand': provider.type === 'github' || provider.type === 'google' }">
                <AuthProviderLogo
                  v-if="provider.type === 'github' || provider.type === 'google'"
                  :name="provider.type"
                />
                <Icon v-else :name="provider.icon || 'key'" :size="18" />
              </span>
              <span class="social-btn__label">{{ provider.label }}</span>
            </button>
          </div>
        </div>

        <!-- 分隔线 -->
        <div v-if="providers.length && settings.enabled_smtp" class="divider">
          <span>或使用邮箱</span>
        </div>

        <!-- 选项卡 -->
        <div v-if="settings.enabled_smtp" class="segmented-control">
          <button class="segmented-control__item" :class="{ 'is-active': tab === 'login' }" @click="tab = 'login'">
            登录
          </button>
          <button
            v-if="settings.enabled_smtp"
            class="segmented-control__item"
            :class="{ 'is-active': tab === 'register' }"
            @click="tab = 'register'"
          >
            注册
          </button>
        </div>

        <!-- 邮箱表单 -->
        <form
          v-if="settings.enabled_smtp"
          class="auth-form"
          @submit.prevent="tab === 'login' ? doEmailLogin() : doEmailRegister()"
        >
          <div class="field-group">
            <Icon class="field-group__icon" name="mail" :size="16" />
            <input v-model="email" class="field-group__input mono" type="email" placeholder="用户邮箱" autocomplete="email" />
          </div>
          <div class="field-group">
            <Icon class="field-group__icon" name="key" :size="16" />
            <input
              v-model="password"
              class="field-group__input"
              type="password"
              placeholder="密码"
              :autocomplete="tab === 'login' ? 'current-password' : 'new-password'"
            />
          </div>

          <template v-if="tab === 'register'">
            <Turnstile :site-key="siteKey" @update:token="cfToken = $event" />
            <div class="code-row">
              <div class="field-group field-group--flex">
                <Icon class="field-group__icon" name="key" :size="16" />
                <input v-model="verifyCode" class="field-group__input mono" type="text" placeholder="验证码" />
              </div>
              <button type="button" class="btn btn--ghost btn--sm" :disabled="busy || codeTimeout > 0" @click="sendCode">
                {{ codeTimeout > 0 ? `${codeTimeout}s` : '发送验证码' }}
              </button>
            </div>
          </template>

          <button class="btn btn--primary btn--block" :disabled="busy || !canCompleteLogin" type="submit">
            <span v-if="busy" class="btn-spinner" />
            {{ busy ? '处理中…' : (tab === 'login' ? '登录' : '创建账户') }}
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
/* ==============================
   Auth Widget — 精致重新设计
   ============================== */

.auth-widget {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

/* --- 提示条 --- */
.notice {
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-muted);
  background: var(--surface-2);
  font-size: 13px;
  line-height: 1.55;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.notice.danger { color: var(--danger); border-color: var(--danger); background: var(--danger-soft); }

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

/* --- 头部 --- */
.auth-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) 0;
}
.auth-header__icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: linear-gradient(145deg, var(--accent), var(--accent-strong));
  color: var(--accent-contrast);
  box-shadow: 0 8px 20px color-mix(in srgb, var(--accent) 25%, transparent);
}
.auth-header__title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 20px;
  color: var(--text);
}
.auth-header__sub {
  font-size: 13px;
  color: var(--text-faint);
}

/* --- 第三方登录按钮组 --- */
.social-section {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.social-btns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--sp-2);
}
.social-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
  transition: background var(--dur), border-color var(--dur), box-shadow var(--dur);
  cursor: pointer;
}
.social-btn:hover:not(:disabled) {
  background: var(--surface-hover);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}
.social-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.social-btn__icon {
  display: grid;
  place-items: center;
  color: var(--accent);
}
.social-btn__icon--brand {
  width: 30px;
  height: 30px;
  margin-block: -6px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 9px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}
.social-btn__label { white-space: nowrap; }

/* --- 分隔线 --- */
.divider {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  color: var(--text-faint);
  font-size: 12px;
}
.divider::before,
.divider::after {
  content: '';
  height: 1px;
  flex: 1;
  background: var(--border);
}

/* --- 分段控制器 --- */
.segmented-control {
  display: flex;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 3px;
  gap: 3px;
}
.segmented-control__item {
  flex: 1;
  padding: var(--sp-2) var(--sp-3);
  border: none;
  border-radius: calc(var(--radius) - 3px);
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--dur), color var(--dur);
}
.segmented-control__item.is-active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}

/* --- 表单 --- */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.field-group {
  position: relative;
  display: flex;
  align-items: center;
}
.field-group__icon {
  position: absolute;
  left: var(--sp-3);
  color: var(--text-faint);
  pointer-events: none;
}
.field-group__input {
  width: 100%;
  padding: var(--sp-3) var(--sp-3) var(--sp-3) calc(var(--sp-3) + 24px);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  outline: none;
  transition: border-color var(--dur), box-shadow var(--dur);
}
.field-group__input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.field-group__input::placeholder { color: var(--text-faint); }

.field-group--flex { flex: 1; min-width: 0; }

.code-row {
  display: flex;
  gap: var(--sp-2);
  align-items: flex-start;
}

/* --- 按钮 --- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid transparent;
  border-radius: var(--radius);
  font-weight: 600;
  font-family: var(--font-display);
  font-size: 14px;
  cursor: pointer;
  transition: background var(--dur), border-color var(--dur), opacity var(--dur);
}
.btn--block { width: 100%; }
.btn--primary {
  background: linear-gradient(145deg, var(--accent), var(--accent-strong));
  color: var(--accent-contrast);
}
.btn--primary:hover:not(:disabled) { filter: brightness(1.08); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn--ghost {
  background: var(--surface-2);
  color: var(--text-2);
  border-color: var(--border);
}
.btn--ghost:hover:not(:disabled) { background: var(--surface-hover); }
.btn--sm {
  padding: var(--sp-2) var(--sp-3);
  font-size: 13px;
  flex-shrink: 0;
}
.btn--danger:hover:not(:disabled) { color: var(--danger); border-color: var(--danger); background: var(--danger-soft); }

.btn-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--accent-contrast);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  opacity: 0.7;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* --- 已登录 —— 资料卡 --- */
.profile-card {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-5);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: linear-gradient(145deg, var(--surface), var(--surface-2));
}
.profile-card__avatar {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: linear-gradient(145deg, var(--accent), var(--accent-strong));
  color: var(--accent-contrast);
  box-shadow: 0 6px 14px color-mix(in srgb, var(--accent) 22%, transparent);
}
.profile-card__initials {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 700;
}
.profile-card__info { min-width: 0; }
.profile-card__label { font-size: 11px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
.profile-card__email { font-size: 14px; font-weight: 600; word-break: break-all; }
.profile-card__meta { margin-top: 4px; color: var(--text-faint); font-size: 12px; }

.profile-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-2);
}
.profile-actions .btn:last-child { grid-column: 1 / -1; }

.empty {
  margin: 0;
  color: var(--text-faint);
  text-align: center;
  font-size: 13px;
}
</style>
