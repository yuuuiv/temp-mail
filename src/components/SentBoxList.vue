<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import { useMailbox } from '@/composables/useMailbox'
import { useToast } from '@/composables/useToast'
import Icon from './Icon.vue'
import Modal from './Modal.vue'

const toast = useToast()
const { openSettings } = useMailbox()

const rows = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const showDetail = ref(false)
const detail = ref(null)

function normalize(row) {
  let raw = row.raw
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { raw = {} }
  }
  return {
    ...row,
    raw,
    to_mail: row.to_mail || raw?.to_mail || raw?.toMail || '',
    to_name: row.to_name || raw?.to_name || raw?.toName || '',
    from_name: row.from_name || raw?.from_name || raw?.fromName || '',
    subject: row.subject || raw?.subject || '',
    content: row.content || raw?.content || '',
    is_html: row.is_html ?? raw?.is_html ?? false,
  }
}

async function load() {
  loading.value = true
  try {
    const res = await api.listSendbox(pageSize, (page.value - 1) * pageSize)
    rows.value = (res.results || []).map(normalize)
    count.value = res.count || 0
  } catch (e) {
    toast.error(e.message || '加载发件箱失败')
  } finally {
    loading.value = false
  }
}

async function del(row) {
  if (!confirm(`确认删除发件记录 #${row.id}？`)) return
  try {
    await api.deleteSendboxMail(row.id)
    toast.success('已删除')
    await load()
  } catch (e) {
    toast.error(e.message || '删除失败')
  }
}

function open(row) {
  detail.value = row
  showDetail.value = true
}

const totalPages = computed(() => Math.max(1, Math.ceil(count.value / pageSize)))
onMounted(load)
</script>

<template>
  <div class="sent panel">
    <div class="panel__toolbar">
      <h2 class="view-title">发件箱</h2>
      <button class="btn btn--ghost icon-only" :class="{ 'is-spin': loading }" @click="load">
        <Icon name="refresh" :size="16" />
      </button>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>收件人</th>
            <th>主题</th>
            <th>时间</th>
            <th class="actions-col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td class="mono dim">{{ r.id }}</td>
            <td class="mono">{{ r.to_name ? `${r.to_name} <${r.to_mail}>` : r.to_mail }}</td>
            <td>{{ r.subject || '(无主题)' }}</td>
            <td class="dim">{{ timeAgo(r.created_at) }}</td>
            <td class="actions">
              <button class="tbtn" title="查看" @click="open(r)">
                <Icon name="mail" :size="15" />
              </button>
              <button v-if="openSettings.enableUserDeleteEmail" class="tbtn tbtn--danger" title="删除" @click="del(r)">
                <Icon name="trash" :size="15" />
              </button>
            </td>
          </tr>
          <tr v-if="!rows.length && !loading">
            <td colspan="5" class="empty-cell">暂无发件记录</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <button class="tbtn" :disabled="page <= 1" @click="page--, load()">
        <Icon name="chevronL" :size="16" />
      </button>
      <span class="mono">{{ page }} / {{ totalPages }}（共 {{ count }}）</span>
      <button class="tbtn" :disabled="page >= totalPages" @click="page++, load()">
        <Icon name="chevronR" :size="16" />
      </button>
    </div>

    <Modal v-model:show="showDetail" title="发件详情" size="lg">
      <div v-if="detail" class="mail-detail">
        <div><span class="dim">收件人：</span><code class="mono">{{ detail.to_mail }}</code></div>
        <div><span class="dim">主题：</span>{{ detail.subject || '(无主题)' }}</div>
        <pre v-if="!detail.is_html" class="content mono">{{ detail.content }}</pre>
        <iframe v-else class="html-frame" sandbox="allow-popups allow-popups-to-escape-sandbox" :srcdoc="detail.content" />
      </div>
      <template #footer>
        <button class="btn btn--primary" @click="showDetail = false">关闭</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped src="./admin/admin-shared.css"></style>
<style scoped>
.sent { padding: var(--sp-5); max-width: none; height: 100%; overflow-y: auto; }
.view-title { margin: 0; font-size: 18px; }
.mail-detail { display: flex; flex-direction: column; gap: var(--sp-3); }
.content { white-space: pre-wrap; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-2); padding: var(--sp-4); max-height: 420px; overflow: auto; }
.html-frame { width: 100%; height: 420px; border: 1px solid var(--border); border-radius: var(--radius); background: white; }
</style>
