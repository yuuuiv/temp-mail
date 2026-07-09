import { computed, ref } from 'vue'
import { api, store } from '@/lib/api'
import { sha256Hex } from '@/lib/utils'

const settings = ref({
  fetched: false,
  available: false,
  enabled_smtp: false,
  enabled_github: false,
  enabled_google: false,
  enabled_ms: false,
  enabled_web3: false,
  cf_turnstile_site_key: '',
})
const jwt = ref(store.authModuleJwt)
const user = ref(store.authModuleUser || null)
const loading = ref(false)

const enabled = computed(() => api.auth.enabled)
const isLoggedIn = computed(() => !!jwt.value)

function persistSession(nextJwt, nextUser) {
  store.authModuleJwt = nextJwt || ''
  store.authModuleUser = nextUser || null
  jwt.value = store.authModuleJwt
  user.value = store.authModuleUser
}

async function loadSettings(force = false) {
  if (!api.auth.enabled) {
    settings.value = { ...settings.value, fetched: true, available: false }
    return settings.value
  }
  if (settings.value.fetched && !force) return settings.value
  loading.value = true
  try {
    const res = await api.auth.settings()
    settings.value = {
      enabled_smtp: false,
      enabled_github: false,
      enabled_google: false,
      enabled_ms: false,
      enabled_web3: false,
      cf_turnstile_site_key: '',
      ...res,
      fetched: true,
      available: true,
    }
  } catch (e) {
    settings.value = {
      ...settings.value,
      fetched: true,
      available: false,
      error: e.message || '统一账户服务不可用',
    }
  } finally {
    loading.value = false
  }
  return settings.value
}

async function loadUser() {
  if (!store.authModuleJwt) return null
  const res = await api.auth.info(store.authModuleJwt)
  persistSession(store.authModuleJwt, res)
  return res
}

async function exchangeAuthCode(code) {
  if (!code) throw new Error('缺少 Auth code')
  const tokenRes = await api.auth.token(code)
  const nextJwt = tokenRes.jwt || ''
  if (!nextJwt) throw new Error('统一账户服务未返回 JWT')
  const info = await api.auth.info(nextJwt)
  persistSession(nextJwt, info)
  return info
}

async function completeProviderLogin({ loginType, code, web3Account, redirectUrl }) {
  const oauthRes = await api.auth.oauth({
    loginType,
    code,
    web3Account,
    redirectUrl,
  })
  if (!oauthRes?.code) throw new Error('统一账户服务未返回登录 code')
  return exchangeAuthCode(oauthRes.code)
}

async function handleCallback(loginType, searchParams = new URLSearchParams(location.search)) {
  const code = searchParams.get('code') || ''
  const web3Account = searchParams.get('web3_account') || ''
  if (!loginType) throw new Error('缺少登录类型')
  if (!code && !web3Account) throw new Error('缺少第三方登录回调参数')
  return completeProviderLogin({
    loginType,
    code,
    web3Account,
    redirectUrl: api.auth.callbackUrl(loginType),
  })
}

async function startOAuth(loginType) {
  const redirectUrl = api.auth.callbackUrl(loginType)
  const loginUrl = await api.auth.loginUrl({ loginType, redirectUrl })
  if (!loginUrl || typeof loginUrl !== 'string') throw new Error('统一账户服务未返回登录 URL')
  sessionStorage.setItem('tm-auth-module-login-type', loginType)
  location.href = loginUrl
}

async function emailLogin({ email, password }) {
  const res = await api.auth.emailLogin({
    email,
    password: await sha256Hex(password),
  })
  if (!res?.code) throw new Error('统一账户服务未返回邮箱登录 code')
  return completeProviderLogin({
    loginType: 'email',
    code: res.code,
    redirectUrl: api.auth.callbackUrl('email'),
  })
}

async function sendEmailCode({ email, cf_token }) {
  return api.auth.emailVerifyCode({ email, cf_token })
}

async function emailRegister({ email, password, code }) {
  return api.auth.emailRegister({
    email,
    password: await sha256Hex(password),
    code,
  })
}

async function web3Login() {
  if (!window.ethereum) throw new Error('未检测到 MetaMask')
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
  if (!accounts?.length) throw new Error('未获取到钱包账户')
  return completeProviderLogin({
    loginType: 'web3',
    web3Account: accounts[0],
    redirectUrl: api.auth.callbackUrl('web3'),
  })
}

function logout() {
  persistSession('', null)
}

export function useAuthModule() {
  return {
    enabled,
    settings,
    jwt,
    user,
    loading,
    isLoggedIn,
    loadSettings,
    loadUser,
    exchangeAuthCode,
    completeProviderLogin,
    handleCallback,
    startOAuth,
    emailLogin,
    sendEmailCode,
    emailRegister,
    web3Login,
    logout,
  }
}
