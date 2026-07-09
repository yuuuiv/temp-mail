import { ref } from 'vue'
import { authHandlers, store } from '@/lib/api'

// 站点访问密码门控 + admin 登录弹窗状态（全局单例）
const showSiteAuth = ref(false)
const showAdminAuth = ref(false)

// 站点是否已解锁（needAuth=true 时用）
const siteUnlocked = ref(!!store.auth)

// 注册 401 拦截
authHandlers.onNeedSiteAuth = () => {
  showSiteAuth.value = true
}
authHandlers.onNeedAdminAuth = () => {
  showAdminAuth.value = true
}

export function useAuthGate() {
  return {
    showSiteAuth,
    showAdminAuth,
    siteUnlocked,
    openSiteAuth: () => (showSiteAuth.value = true),
    openAdminAuth: () => (showAdminAuth.value = true),
  }
}
