import { ref, computed } from 'vue'
import { api, store } from '@/lib/api'

// 是否处于 admin 控制台视图
const adminMode = ref(false)
// admin 是否已认证（有 adminAuth 或校验通过）
const adminAuthed = ref(!!store.adminAuth)

function setAdminPassword(pwd) {
  store.adminAuth = pwd
  adminAuthed.value = !!pwd
}

function logoutAdmin() {
  store.adminAuth = ''
  adminAuthed.value = false
  adminMode.value = false
}

export function useAdmin() {
  return {
    adminMode,
    adminAuthed: computed(() => adminAuthed.value),
    enterAdmin: () => (adminMode.value = true),
    exitAdmin: () => (adminMode.value = false),
    setAdminPassword,
    logoutAdmin,
    api: api.admin,
  }
}
