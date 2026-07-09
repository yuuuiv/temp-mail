<script setup>
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import Icon from './Icon.vue'

const toast = useToast()
const rows = ref([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await api.listAttachments()
    rows.value = res.results || []
  } catch (e) {
    toast.error(e.message || '加载附件失败')
  } finally { loading.value = false }
}

async function download(row) {
  try {
    const { url } = await api.getAttachmentUrl(row.key)
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (e) {
    toast.error(e.message || '获取下载链接失败')
  }
}

async function del(row) {
  if (!confirm(`确认删除附件 ${row.key}？`)) return
  try {
    await api.deleteAttachment(row.key)
    toast.success('已删除')
    await load()
  } catch (e) {
    toast.error(e.message || '删除失败')
  }
}

onMounted(load)
</script>

<template>
  <div class="attachments-panel panel">
    <div class="panel__toolbar">
      <h2 class="view-title">S3 附件</h2>
      <button class="btn btn--ghost icon-only" :class="{ 'is-spin': loading }" @click="load">
        <Icon name="refresh" :size="16" />
      </button>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Key</th>
            <th class="actions-col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.key">
            <td class="mono">{{ r.key }}</td>
            <td class="actions">
              <button class="tbtn" title="下载" @click="download(r)">
                <Icon name="paperclip" :size="15" />
              </button>
              <button class="tbtn tbtn--danger" title="删除" @click="del(r)">
                <Icon name="trash" :size="15" />
              </button>
            </td>
          </tr>
          <tr v-if="!rows.length && !loading">
            <td colspan="2" class="empty-cell">暂无已保存附件</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped src="./admin/admin-shared.css"></style>
<style scoped>
.attachments-panel { padding: var(--sp-5); max-width: 920px; height: 100%; overflow-y: auto; }
.view-title { margin: 0; font-size: 18px; }
</style>
