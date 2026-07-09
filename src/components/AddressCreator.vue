<script setup>
import { ref, computed, watch } from 'vue'
import { api, store } from '@/lib/api'
import { sha256Hex } from '@/lib/utils'
import { useMailbox } from '@/composables/useMailbox'
import { useToast } from '@/composables/useToast'
import Icon from './Icon.vue'
import Turnstile from './Turnstile.vue'

const { openSettings, loadSettings, loadMails } = useMailbox()
const toast = useToast()
const emit = defineEmits(['user'])

const tab = ref('create') // create | password | credential
const name = ref('')
const domain = ref(openSettings.value.domainOptions?.[0]?.value || '')
const cfToken = ref('')
const enableRandomSubdomain = ref(false)
const busy = ref(false)
const turnstileRef = ref(null)

// 登录
const loginEmail = ref('')
const loginPassword = ref('')
const credential = ref('')

const domains = computed(() => openSettings.value.domainOptions || [])
const siteKey = computed(() => openSettings.value.cfTurnstileSiteKey || '')
const needToken = computed(() => !!siteKey.value)
const enablePassword = computed(() => openSettings.value.enableAddressPassword)
const canCreate = computed(() =>
  (openSettings.value.enableUserCreateEmail ?? true) &&
  !(openSettings.value.disableAnonymousUserCreateEmail && !store.authModuleJwt)
)
const disableCustomName = computed(() => !!openSettings.value.disableCustomAddressName)
const randomSubdomainAvailable = computed(() =>
  !!domain.value && (openSettings.value.randomSubdomainDomains || []).includes(domain.value)
)
const prefix = computed(() => openSettings.value.prefix || '')

if (!domain.value && domains.value.length) domain.value = domains.value[0].value
watch(domains, (list) => {
  if (!domain.value && list.length) domain.value = list[0].value
}, { immediate: true })
watch(canCreate, (v) => {
  if (!v && tab.value === 'create') tab.value = enablePassword.value ? 'password' : 'credential'
}, { immediate: true })
watch(randomSubdomainAvailable, (v) => {
  if (!v) enableRandomSubdomain.value = false
})

async function afterAuth() {
  await loadSettings()
  await loadMails(1)
}

async function createAddress() {
  if (!canCreate.value) {
    toast.warning('当前站点未开放新建地址，请使用已有凭证登录')
    return
  }
  if (needToken.value && !cfToken.value) {
    toast.warning('请先完成人机验证')
    return
  }
  busy.value = true
  try {
    const res = await api.newAddress({
      name: disableCustomName.value ? '' : name.value.trim(),
      domain: domain.value,
      cf_token: cfToken.value,
      enableRandomSubdomain: enableRandomSubdomain.value,
    })
    store.jwt = res.jwt
    toast.success(res.password ? `邮箱已创建，初始密码：${res.password}` : '邮箱地址已创建')
    await afterAuth()
  } catch (e) {
    toast.error(e.message || '创建失败')
    turnstileRef.value?.reset?.()
    cfToken.value = ''
  } finally {
    busy.value = false
  }
}

async function login() {
  if (!loginEmail.value || !loginPassword.value) {
    toast.warning('请输入邮箱与密码')
    return
  }
  if (needToken.value && !cfToken.value) {
    toast.warning('请先完成人机验证')
    return
  }
  busy.value = true
  try {
    const res = await api.addressLogin({
      email: loginEmail.value.trim(),
      password: await sha256Hex(loginPassword.value),
      cf_token: cfToken.value,
    })
    store.jwt = res.jwt
    toast.success('登录成功')
    await afterAuth()
  } catch (e) {
    toast.error(e.message || '登录失败')
    turnstileRef.value?.reset?.()
    cfToken.value = ''
  } finally {
    busy.value = false
  }
}

async function credentialLogin() {
  if (!credential.value.trim()) {
    toast.warning('请输入地址凭证 JWT')
    return
  }
  if (needToken.value && !cfToken.value) {
    toast.warning('请先完成人机验证')
    return
  }
  busy.value = true
  try {
    await api.credentialLogin({
      credential: credential.value.trim(),
      cf_token: cfToken.value,
    })
    store.jwt = credential.value.trim()
    toast.success('凭证登录成功')
    await afterAuth()
  } catch (e) {
    toast.error(e.message || '凭证无效')
    turnstileRef.value?.reset?.()
    cfToken.value = ''
  } finally {
    busy.value = false
  }
}

function generateName() {
  const words = ['quiet', 'swift', 'silver', 'green', 'nova', 'pixel', 'river', 'cloud']
  const animals = ['otter', 'fox', 'lynx', 'panda', 'raven', 'koala', 'mink', 'heron']
  const max = openSettings.value.maxAddressLen || 30
  name.value = `${words[Math.floor(Math.random() * words.length)]}-${animals[Math.floor(Math.random() * animals.length)]}-${Math.floor(1000 + Math.random() * 9000)}`.slice(0, max)
}
</script>

<template>
  <div class="creator">
    <div class="creator__panel">
      <div class="brandmark">
        <span class="brandmark__dot" />
        <span class="brandmark__dot" />
        <span class="brandmark__dot" />
      </div>
      <h1 class="creator__title">
        Temp Mail
      </h1>
      <p class="creator__lead">
        方便、快捷地生成并管理复数个临时邮箱
      </p>

      <div class="tabs" role="tablist">
        <button
          v-if="canCreate"
          class="tabs__btn"
          :class="{ 'is-active': tab === 'create' }"
          role="tab"
          @click="tab = 'create'"
        >
          <Icon name="plus" :size="16" /> 新建地址
        </button>
        <button
          v-if="enablePassword"
          class="tabs__btn"
          :class="{ 'is-active': tab === 'password' }"
          role="tab"
          @click="tab = 'password'"
        >
          <Icon name="key" :size="16" /> 密码登录
        </button>
        <button
          class="tabs__btn"
          :class="{ 'is-active': tab === 'credential' }"
          role="tab"
          @click="tab = 'credential'"
        >
          <Icon name="key" :size="16" /> 凭证登录
        </button>
        <button
          class="tabs__btn tabs__btn--user"
          role="tab"
          @click="emit('user')"
        >
          <Icon name="settings" :size="16" /> 用户登录
        </button>
      </div>

      <!-- 新建 -->
      <form v-if="tab === 'create' && canCreate" class="form" @submit.prevent="createAddress">
        <div class="addr-input">
          <span v-if="prefix" class="prefix mono">{{ prefix }}</span>
          <input
            v-if="!disableCustomName"
            v-model="name"
            class="field field--flex mono"
            type="text"
            :placeholder="`留空则随机`"
            autocomplete="off"
            spellcheck="false"
            :minlength="openSettings.minAddressLen"
            :maxlength="openSettings.maxAddressLen"
          />
          <input
            v-else
            class="field field--flex mono"
            type="text"
            value="自动生成"
            disabled
          />
          <span class="addr-break" aria-hidden="true" />
          <span class="at">@</span>
          <select v-model="domain" class="field field--domain mono">
            <option v-for="d in domains" :key="d.value" :value="d.value">
              {{ d.label }}
            </option>
          </select>
        </div>
        <div class="row-actions">
          <button v-if="!disableCustomName" type="button" class="btn btn--ghost" @click="generateName">
            随机名称
          </button>
          <label v-if="randomSubdomainAvailable" class="switch">
            <input v-model="enableRandomSubdomain" type="checkbox" />
            <span>随机子域名</span>
          </label>
        </div>

        <Turnstile
          ref="turnstileRef"
          :site-key="siteKey"
          @update:token="cfToken = $event"
        />

        <button class="btn btn--primary btn--block" :disabled="busy" type="submit">
          <Icon v-if="!busy" name="mail" :size="18" />
          {{ busy ? '创建中…' : '获取临时邮箱' }}
        </button>
      </form>

      <!-- 密码登录 -->
      <form v-else-if="tab === 'password'" class="form" @submit.prevent="login">
        <input
          v-model="loginEmail"
          class="field mono"
          type="email"
          placeholder="完整邮箱地址"
          autocomplete="username"
        />
        <input
          v-model="loginPassword"
          class="field mono"
          type="password"
          placeholder="地址密码"
          autocomplete="current-password"
        />
        <Turnstile
          ref="turnstileRef"
          :site-key="siteKey"
          @update:token="cfToken = $event"
        />
        <button class="btn btn--primary btn--block" :disabled="busy" type="submit">
          <Icon v-if="!busy" name="key" :size="18" />
          {{ busy ? '登录中…' : '登录到已有邮箱' }}
        </button>
      </form>

      <!-- 凭证登录 -->
      <form v-else class="form" @submit.prevent="credentialLogin">
        <textarea
          v-model="credential"
          class="field mono textarea"
          rows="4"
          placeholder="粘贴地址 JWT 凭证"
          autocomplete="off"
          spellcheck="false"
        />
        <Turnstile
          ref="turnstileRef"
          :site-key="siteKey"
          @update:token="cfToken = $event"
        />
        <button class="btn btn--primary btn--block" :disabled="busy" type="submit">
          <Icon v-if="!busy" name="key" :size="18" />
          {{ busy ? '登录中…' : '使用凭证登录' }}
        </button>
      </form>

      <p v-if="!canCreate" class="creator__notice">
        此站点关闭了匿名新建地址；请先用地址凭证/密码登录，或使用用户账户后再创建。
      </p>

      <p v-if="openSettings.copyright" class="creator__copy">
        {{ openSettings.copyright }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.creator {
  height: 100%;
  display: grid;
  place-items: center;
  padding: var(--sp-5);
  overflow-y: auto;
  background:
    radial-gradient(120% 80% at 100% 0%, var(--accent-soft), transparent 60%),
    var(--bg);
}
.creator__panel {
  width: 100%;
  max-width: min(720px, 100%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  padding: clamp(var(--sp-4), 4vw, var(--sp-6));
}
.brandmark {
  display: flex;
  gap: 6px;
  margin-bottom: var(--sp-5);
}
.brandmark__dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: var(--accent);
}
.brandmark__dot:nth-child(2) { background: var(--raw-steel); opacity: 0.7; }
.brandmark__dot:nth-child(3) { background: var(--raw-mist); opacity: 0.6; }

.creator__title {
  font-size: clamp(26px, 6vw, 34px);
  line-height: 1.12;
  letter-spacing: -0.02em;
  margin-bottom: var(--sp-3);
}
.creator__lead {
  color: var(--text-muted);
  margin: 0 0 var(--sp-5);
  font-size: 15px;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin-bottom: var(--sp-4);
}
.tabs__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-muted);
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--dur) var(--ease);
}
.tabs__btn.is-active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.addr-input {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--surface-2);
  overflow: hidden;
  min-width: 0;
}
.addr-input:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.at {
  display: grid;
  place-items: center;
  flex: 0 0 38px;
  min-height: 48px;
  padding: 0 var(--sp-1);
  color: var(--text-faint);
  font-family: var(--font-mono);
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
}
.prefix {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  min-height: 48px;
  padding: 0 var(--sp-3);
  border-right: 1px solid var(--border);
  color: var(--text-muted);
  background: var(--surface);
}
.addr-break { display: none; }
.field {
  width: 100%;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--text);
  font-size: 15px;
  transition: border-color var(--dur), box-shadow var(--dur);
  min-width: 0;
}
.field:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.addr-input .field {
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.field--flex {
  flex: 999 1 180px;
  min-width: 150px;
}
.field--domain {
  flex: 1 1 240px;
  min-width: min(100%, 220px);
  max-width: none;
  cursor: pointer;
  text-overflow: ellipsis;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: var(--sp-3) var(--sp-5);
  border: 1px solid transparent;
  border-radius: var(--radius);
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-display);
  transition: transform var(--dur) var(--ease), background var(--dur), opacity var(--dur);
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn:not(:disabled):active { transform: scale(0.98); }
.btn--block { width: 100%; margin-top: var(--sp-1); }
.btn--primary {
  background: var(--accent);
  color: var(--accent-contrast);
}
.btn--primary:not(:disabled):hover { background: var(--accent-strong); }
.btn--ghost {
  background: var(--surface-2);
  color: var(--text-2);
  border-color: var(--border);
}
.btn--ghost:hover { background: var(--surface-hover); }
.row-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}
.textarea { resize: vertical; line-height: 1.5; }

.creator__copy {
  text-align: center;
  color: var(--text-faint);
  font-size: 12px;
  margin: var(--sp-5) 0 0;
}
.creator__notice {
  margin: var(--sp-4) 0 0;
  color: var(--text-muted);
  font-size: 12.5px;
  line-height: 1.5;
}

@media (max-width: 720px) {
  .creator {
    align-items: start;
    padding: var(--sp-4);
  }
  .creator__panel {
    max-width: 100%;
  }
}

@media (max-width: 520px) {
  .tabs__btn {
    flex: 1 1 calc(50% - var(--sp-2));
  }
  .prefix {
    order: 1;
  }
  .field--flex {
    order: 2;
  }
  .addr-break {
    display: block;
    order: 3;
    flex: 0 0 100%;
    height: 0;
  }
  .prefix,
  .at {
    min-height: 44px;
  }
  .at {
    order: 4;
    flex-basis: 44px;
    border-left: none;
  }
  .field--domain {
    order: 5;
    flex-basis: calc(100% - 44px);
  }
  .row-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .row-actions .btn {
    width: 100%;
  }
}
</style>
