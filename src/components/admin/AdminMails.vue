<script setup>
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { parseRawEml, timeAgo } from '@/lib/utils'
import { useToast } from '@/composables/useToast'
import Icon from '../Icon.vue'
import Modal from '../Modal.vue'

const toast = useToast()
const mode = ref('all')
const rows = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = 20
const address = ref('')
const loading = ref(false)
const detail = ref(null)
const showDetail = ref(false)

async function normalize(row) {
  let parsed = {}
  if (row.raw) {
    try { parsed = await parseRawEml(row.raw) } catch { parsed = {} }
  }
  return {
    ...row,
    ...parsed,
    subject: row.subject || parsed.subject || '(无主题)',
    source: row.source || parsed.from || '',
  }
}

async function load() {
  loading.value = true
  try {
    const params = {
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
      address: address.value.trim(),
    }
    const res = mode.value === 'unknown'
      ? await api.admin.listUnknownMails(params)
      : await api.admin.listMails(params)
    rows.value = await Promise.all((res.results || []).map(normalize))
    count.value = res.count || 0
  } catch (e) {
    toast.error(e.message || '加载邮件失败')
  } finally { loading.value = false }
}

function search() {
  page.value = 1
  load()
}

async function del(row) {
  if (!confirm(`确认删除邮件 #${row.id}？`)) return
  try {
    await api.admin.deleteMail(row.id)
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

function totalPages() {
  return Math.max(1, Math.ceil(count.value / pageSize))
}

onMounted(load)
</script>

<template>
  <div class="panel">
    <div class="panel__toolbar">
      <select v-model="mode" class="field mode" @change="search">
        <option value="all">全部邮件</option>
        <option value="unknown">未知地址邮件</option>
      </select>
      <div v-if="mode === 'all'" class="search">
        <Icon name="search" :size="16" />
        <input v-model="address" class="search__input" placeholder="按收件地址筛选" @keydown.enter="search" />
      </div>
      <button class="btn btn--ghost" @click="search">查询</button>
      <button class="btn btn--ghost icon-only" :class="{ 'is-spin': loading }" @click="load">
        <Icon name="refresh" :size="16" />
      </button>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>收件地址</th>
            <th>发件人</th>
            <th>主题</th>
            <th>时间</th>
            <th class="actions-col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td class="mono dim">{{ r.id }}</td>
            <td class="mono">{{ r.address }}</td>
            <td class="mono dim">{{ r.source || r.from || '—' }}</td>
            <td>{{ r.subject }}</td>
            <td class="dim">{{ timeAgo(r.created_at) }}</td>
            <td class="actions">
              <button class="tbtn" title="查看" @click="open(r)"><Icon name="mail" :size="15" /></button>
              <button class="tbtn tbtn--danger" title="删除" @click="del(r)"><Icon name="trash" :size="15" /></button>
            </td>
          </tr>
          <tr v-if="!rows.length && !loading">
            <td colspan="6" class="empty-cell">暂无邮件</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <button class="tbtn" :disabled="page <= 1" @click="page--, load()"><Icon name="chevronL" :size="16" /></button>
      <span class="mono">{{ page }} / {{ totalPages() }}（共 {{ count }}）</span>
      <button class="tbtn" :disabled="page >= totalPages()" @click="page++, load()"><Icon name="chevronR" :size="16" /></button>
    </div>

    <Modal v-model:show="showDetail" title="邮件详情" size="lg">
      <div v-if="detail" class="detail">
        <h3>{{ detail.subject }}</h3>
        <p class="dim mono">From: {{ detail.source || detail.from }}</p>
        <p class="dim mono">To: {{ detail.address }}</p>
        <iframe v-if="detail.html" class="html-frame" sandbox="allow-popups allow-popups-to-escape-sandbox" :srcdoc="detail.html" />
        <pre v-else class="content mono">{{ detail.text || detail.raw }}</pre>
      </div>
      <template #footer><button class="btn btn--primary" @click="showDetail = false">关闭</button></template>
    </Modal>
  </div>
</template>

<style scoped src="./admin-shared.css"></style>
<style scoped>
.mode { width: 140px; }
.detail h3 { margin-top: 0; }
.content { white-space: pre-wrap; border: 1px solid var(--border); border-radius: var(--radius); padding: var(--sp-4); max-height: 420px; overflow: auto; }
.html-frame { width: 100%; height: 420px; border: 1px solid var(--border); border-radius: var(--radius); background: white; }
</style>
