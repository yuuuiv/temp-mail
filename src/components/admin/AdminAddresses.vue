<script setup>
import { onMounted, ref } from 'vue'
import { api, store } from '@/lib/api'
import { sha256Hex, timeAgo, copyText } from '@/lib/utils'
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

const showCred = ref(false)
const credText = ref('')
const showReset = ref(false)
const resetId = ref(0)
const resetPwd = ref('')

async function load() {
  loading.value = true
  try {
    const res = await api.admin.listAddresses({
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

function search() {
  page.value = 1
  load()
}

async function del(id) {
  if (!confirm('确认删除该邮箱地址及其所有数据？')) return
  try {
    await api.admin.deleteAddress(id)
    toast.success('已删除')
    load()
  } catch (e) {
    toast.error(e.message || '删除失败')
  }
}

async function clearInbox(id) {
  if (!confirm('确认清空该地址收件箱？')) return
  try {
    await api.admin.clearInbox(id)
    toast.success('已清空收件箱')
    load()
  } catch (e) {
    toast.error(e.message || '操作失败')
  }
}

async function clearSentItems(id) {
  if (!confirm('确认清空该地址发件箱？')) return
  try {
    await api.admin.clearSentItems(id)
    toast.success('已清空发件箱')
    load()
  } catch (e) {
    toast.error(e.message || '操作失败')
  }
}

async function showCredential(id) {
  try {
    const res = await api.admin.showCredential(id)
    credText.value = res.jwt || JSON.stringify(res)
    showCred.value = true
  } catch (e) {
    toast.error(e.message || '获取失败')
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
    await api.admin.resetPassword(resetId.value, await sha256Hex(resetPwd.value))
    toast.success('密码已重置')
    showReset.value = false
  } catch (e) {
    toast.error(e.message || '重置失败')
  }
}

async function copyCred() {
  const ok = await copyText(credText.value)
  toast[ok ? 'success' : 'error'](ok ? '已复制' : '复制失败')
}

const totalPages = () => Math.max(1, Math.ceil(count.value / pageSize))

onMounted(load)
</script>

<template>
  <div class="panel">
    <div class="panel__toolbar">
      <div class="search">
        <Icon name="search" :size="16" />
        <input
          v-model="query"
          class="search__input"
          placeholder="按地址搜索…"
          @keydown.enter="search"
        />
      </div>
      <button class="btn btn--ghost" @click="search">搜索</button>
      <button class="btn btn--ghost icon-only" :class="{ 'is-spin': loading }" @click="load">
        <Icon name="refresh" :size="16" />
      </button>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>地址</th>
            <th class="num">收件</th>
            <th class="num">发件</th>
            <th>创建</th>
            <th class="actions-col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td class="mono dim">{{ r.id }}</td>
            <td class="mono">{{ r.name }}</td>
            <td class="num">{{ r.mail_count }}</td>
            <td class="num">{{ r.send_count }}</td>
            <td class="dim">{{ timeAgo(r.created_at) }}</td>
            <td class="actions">
              <button class="tbtn" title="查看凭证" @click="showCredential(r.id)">
                <Icon name="key" :size="15" />
              </button>
              <button class="tbtn" title="重置密码" @click="openReset(r.id)">
                <Icon name="settings" :size="15" />
              </button>
              <button class="tbtn" title="清空收件箱" @click="clearInbox(r.id)">
                <Icon name="inbox" :size="15" />
              </button>
              <button class="tbtn" title="清空发件箱" @click="clearSentItems(r.id)">
                <Icon name="send" :size="15" />
              </button>
              <button class="tbtn tbtn--danger" title="删除" @click="del(r.id)">
                <Icon name="trash" :size="15" />
              </button>
            </td>
          </tr>
          <tr v-if="!rows.length && !loading">
            <td colspan="6" class="empty-cell">暂无数据</td>
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

    <!-- 凭证弹窗 -->
    <Modal v-model:show="showCred" title="地址凭证 (JWT)" size="md">
      <p class="dim" style="margin-top:0">该 JWT 可用于登录此邮箱，请妥善保管。</p>
      <textarea class="field mono" rows="4" readonly :value="credText" />
      <template #footer>
        <button class="btn btn--ghost" @click="showCred = false">关闭</button>
        <button class="btn btn--primary" @click="copyCred">复制</button>
      </template>
    </Modal>

    <!-- 重置密码 -->
    <Modal v-model:show="showReset" title="重置地址密码" size="sm">
      <input v-model="resetPwd" class="field" type="password" placeholder="新密码" />
      <template #footer>
        <button class="btn btn--ghost" @click="showReset = false">取消</button>
        <button class="btn btn--primary" @click="doReset">确定</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped src="./admin-shared.css"></style>
