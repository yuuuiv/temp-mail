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
      sortOrder: 'asc',
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
    <Modal v-model:show="showCred" title="地址凭证" size="md">
      <div class="credential-view">
        <div class="credential-view__warning">
          <Icon name="alert" :size="16" />
          <span>该 JWT 可用于登录此邮箱，请妥善保管。切勿分享或提交到代码仓库。</span>
        </div>
        <div class="credential-view__label">JWT 令牌</div>
        <div class="credential-view__value-wrap">
          <code class="credential-view__value mono">{{ credText }}</code>
          <button class="credential-view__copy" title="复制凭证" @click="copyCred">
            <Icon name="copy" :size="15" />
          </button>
        </div>
        <div class="credential-view__meta">
          <Icon name="clock" :size="13" />
          <span v-if="credText">令牌字符数：{{ credText.length }}</span>
          <span v-else>未获取到凭证</span>
        </div>
      </div>
      <template #footer>
        <button class="btn btn--ghost" @click="showCred = false">关闭</button>
        <button class="btn btn--primary" @click="copyCred">复制凭证</button>
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
<style scoped>
.credential-view { display: flex; flex-direction: column; gap: var(--sp-3); }
.credential-view__warning {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border: 1px solid var(--danger);
  border-radius: var(--radius);
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 13px;
  line-height: 1.5;
}
.credential-view__warning :first-child { flex-shrink: 0; margin-top: 1px; }
.credential-view__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.credential-view__value-wrap {
  display: flex;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface-2);
}
.credential-view__value {
  flex: 1;
  min-width: 0;
  padding: var(--sp-3);
  font-size: 13px;
  word-break: break-all;
  overflow-wrap: anywhere;
  line-height: 1.55;
  max-height: 140px;
  overflow-y: auto;
}
.credential-view__copy {
  display: grid;
  place-items: center;
  width: 42px;
  flex-shrink: 0;
  border: none;
  border-left: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--dur), color var(--dur);
}
.credential-view__copy:hover { background: var(--surface-hover); color: var(--accent); }
.credential-view__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-faint);
  font-size: 12px;
}
</style>
