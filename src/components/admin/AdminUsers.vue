<script setup>
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { sha256Hex, timeAgo } from '@/lib/utils'
import { useToast } from '@/composables/useToast'
import Icon from '../Icon.vue'
import Modal from '../Modal.vue'

const toast = useToast()

const rows = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = 20
const query = ref('')
const loading = ref(false)
const createBusy = ref(false)

const showCreate = ref(false)
const newUser = ref({ email: '', password: '' })
const showReset = ref(false)
const resetId = ref(0)
const resetPwd = ref('')
const roles = ref([])
const showAddresses = ref(false)
const currentUser = ref(null)
const userAddresses = ref([])
const bindAddress = ref('')

async function load() {
  loading.value = true
  try {
    const res = await api.admin.listUsers({
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
      query: query.value.trim(),
    })
    rows.value = res.results || []
    count.value = res.count || 0
  } catch (e) {
    toast.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}
async function loadRoles() {
  try {
    const res = await api.admin.getUserRoles()
    roles.value = Array.isArray(res) ? res : []
  } catch { roles.value = [] }
}
function search() {
  page.value = 1
  load()
}

async function createUser() {
  if (!newUser.value.email || !newUser.value.password) {
    toast.warning('请填写邮箱和密码')
    return
  }
  createBusy.value = true
  try {
    await api.admin.createUser({
      email: newUser.value.email.trim(),
      password: await sha256Hex(newUser.value.password),
    })
    toast.success('用户已创建')
    showCreate.value = false
    newUser.value = { email: '', password: '' }
    query.value = ''
    page.value = 1
    await load()
  } catch (e) {
    toast.error(e.message || '创建失败')
  } finally {
    createBusy.value = false
  }
}

async function del(id) {
  if (!confirm('确认删除该用户及其地址绑定？')) return
  try {
    await api.admin.deleteUser(id)
    toast.success('已删除')
    load()
  } catch (e) {
    toast.error(e.message || '删除失败')
  }
}

function openReset(id) {
  resetId.value = id
  resetPwd.value = ''
  showReset.value = true
}
async function doReset() {
  if (!resetPwd.value) {
    toast.warning('请输入新密码')
    return
  }
  try {
    await api.admin.resetUserPassword(resetId.value, await sha256Hex(resetPwd.value))
    toast.success('密码已重置')
    showReset.value = false
  } catch (e) {
    toast.error(e.message || '重置失败')
  }
}

async function changeRole(row) {
  const roleNames = roles.value.map((r) => r.role).join(', ')
  const role = prompt(`设置用户角色（留空为默认）。可用角色：${roleNames || '由后端配置'}`, row.role_text || '')
  if (role === null) return
  try {
    await api.admin.updateUserRole({ user_id: row.id, role_text: role.trim() })
    toast.success('角色已更新')
    load()
  } catch (e) {
    toast.error(e.message || '更新角色失败')
  }
}

async function openAddresses(row) {
  currentUser.value = row
  bindAddress.value = ''
  showAddresses.value = true
  try {
    const res = await api.admin.listUserAddresses(row.id)
    userAddresses.value = res.results || []
  } catch (e) {
    toast.error(e.message || '加载绑定地址失败')
  }
}

async function bindAddressToUser() {
  if (!currentUser.value || !bindAddress.value.trim()) return
  const value = bindAddress.value.trim()
  const payload = /^\d+$/.test(value)
    ? { user_id: currentUser.value.id, address_id: Number(value) }
    : { user_id: currentUser.value.id, address: value }
  try {
    await api.admin.bindUserAddress(payload)
    toast.success('已绑定地址')
    await openAddresses(currentUser.value)
  } catch (e) {
    toast.error(e.message || '绑定失败')
  }
}

const totalPages = () => Math.max(1, Math.ceil(count.value / pageSize))
onMounted(() => { load(); loadRoles() })
</script>

<template>
  <div class="panel">
    <div class="panel__toolbar">
      <div class="search">
        <Icon name="search" :size="16" />
        <input v-model="query" class="search__input" placeholder="按用户邮箱搜索…" @keydown.enter="search" />
      </div>
      <button class="btn btn--ghost" @click="search">搜索</button>
      <button class="btn btn--primary" @click="showCreate = true">
        <Icon name="plus" :size="16" /> 新建用户
      </button>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户邮箱</th>
            <th class="num">地址数</th>
            <th>角色</th>
            <th>创建</th>
            <th class="actions-col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td class="mono dim">{{ r.id }}</td>
            <td class="mono">{{ r.user_email }}</td>
            <td class="num">{{ r.address_count }}</td>
            <td class="dim">{{ r.role_text || '—' }}</td>
            <td class="dim">{{ timeAgo(r.created_at) }}</td>
            <td class="actions">
              <button class="tbtn" title="绑定地址" @click="openAddresses(r)">
                <Icon name="mail" :size="15" />
              </button>
              <button class="tbtn" title="设置角色" @click="changeRole(r)">
                <Icon name="settings" :size="15" />
              </button>
              <button class="tbtn" title="重置密码" @click="openReset(r.id)">
                <Icon name="key" :size="15" />
              </button>
              <button class="tbtn tbtn--danger" title="删除" @click="del(r.id)">
                <Icon name="trash" :size="15" />
              </button>
            </td>
          </tr>
          <tr v-if="!rows.length && !loading">
            <td colspan="6" class="empty-cell">暂无用户</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <button class="tbtn" :disabled="page <= 1" @click="page--, load()">
        <Icon name="chevronL" :size="16" />
      </button>
      <span class="mono">{{ page }} / {{ totalPages() }}（共 {{ count }}）</span>
      <button class="tbtn" :disabled="page >= totalPages()" @click="page++, load()">
        <Icon name="chevronR" :size="16" />
      </button>
    </div>

    <Modal v-model:show="showCreate" title="新建用户" size="sm">
      <div class="form-grid">
        <div class="form-row">
          <label>用户邮箱</label>
          <input v-model="newUser.email" class="field mono" type="email" placeholder="user@example.com" />
        </div>
        <div class="form-row">
          <label>初始密码</label>
          <input v-model="newUser.password" class="field" type="password" placeholder="密码" />
        </div>
      </div>
      <template #footer>
        <button class="btn btn--ghost" @click="showCreate = false">取消</button>
        <button class="btn btn--primary" :disabled="createBusy" @click="createUser">
          {{ createBusy ? '创建中…' : '创建' }}
        </button>
      </template>
    </Modal>

    <Modal v-model:show="showReset" title="重置用户密码" size="sm">
      <input v-model="resetPwd" class="field" type="password" placeholder="新密码" />
      <template #footer>
        <button class="btn btn--ghost" @click="showReset = false">取消</button>
        <button class="btn btn--primary" @click="doReset">确定</button>
      </template>
    </Modal>

    <Modal v-model:show="showAddresses" title="用户绑定地址" size="lg">
      <div v-if="currentUser" class="form-grid">
        <p class="hint">用户：<code class="mono">{{ currentUser.user_email }}</code></p>
        <div class="row-inline">
          <input v-model="bindAddress" class="field mono" placeholder="地址 ID 或完整邮箱地址" />
          <button class="btn btn--primary" @click="bindAddressToUser">绑定</button>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>ID</th><th>地址</th><th class="num">收件</th><th class="num">发件</th></tr>
            </thead>
            <tbody>
              <tr v-for="a in userAddresses" :key="a.id">
                <td class="mono dim">{{ a.id }}</td>
                <td class="mono">{{ a.name }}</td>
                <td class="num">{{ a.mail_count }}</td>
                <td class="num">{{ a.send_count }}</td>
              </tr>
              <tr v-if="!userAddresses.length"><td colspan="4" class="empty-cell">暂无绑定地址</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <template #footer>
        <button class="btn btn--primary" @click="showAddresses = false">关闭</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped src="./admin-shared.css"></style>
<style scoped>
.row-inline { display:flex; align-items:center; gap:var(--sp-2); }
.row-inline .field { flex:1; }
</style>
