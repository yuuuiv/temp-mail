<script setup>
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import { useToast } from '@/composables/useToast'
import Icon from '../Icon.vue'

const toast = useToast()
const rows = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = 20
const address = ref('')
const loading = ref(false)

function normalize(row) {
  let raw = row.raw
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { raw = {} }
  }
  return {
    ...row,
    raw,
    to_mail: row.to_mail || raw?.to_mail || raw?.toMail || '',
    subject: row.subject || raw?.subject || '',
  }
}

async function load() {
  loading.value = true
  try {
    const res = await api.admin.listSendbox({
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
      address: address.value.trim(),
    })
    rows.value = (res.results || []).map(normalize)
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
async function del(row) {
  if (!confirm(`确认删除发件记录 #${row.id}？`)) return
  try {
    await api.admin.deleteSendboxMail(row.id)
    toast.success('已删除')
    await load()
  } catch (e) {
    toast.error(e.message || '删除失败')
  }
}
const totalPages = () => Math.max(1, Math.ceil(count.value / pageSize))
onMounted(load)
</script>

<template>
  <div class="panel">
    <div class="panel__toolbar">
      <div class="search">
        <Icon name="search" :size="16" />
        <input v-model="address" class="search__input" placeholder="按发件地址筛选（留空查全部）" @keydown.enter="search" />
      </div>
      <button class="btn btn--ghost" @click="search">查询</button>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>发件地址</th>
            <th>收件人</th>
            <th>主题</th>
            <th>时间</th>
            <th class="actions-col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td class="mono dim">{{ r.id }}</td>
            <td class="mono">{{ r.address }}</td>
            <td class="mono dim">{{ r.to_mail || r.to || '—' }}</td>
            <td>{{ r.subject || '(无主题)' }}</td>
            <td class="dim">{{ timeAgo(r.created_at) }}</td>
            <td class="actions">
              <button class="tbtn tbtn--danger" title="删除" @click="del(r)">
                <Icon name="trash" :size="15" />
              </button>
            </td>
          </tr>
          <tr v-if="!rows.length && !loading">
            <td colspan="6" class="empty-cell">暂无发件记录</td>
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
  </div>
</template>

<style scoped src="./admin-shared.css"></style>
