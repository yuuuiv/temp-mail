<script setup>
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import { useToast } from '@/composables/useToast'
import Icon from '../Icon.vue'
import Modal from '../Modal.vue'

const toast = useToast()
const rows = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = 20
const address = ref('')
const loading = ref(false)
const editRow = ref(null)
const edit = ref({ address_id: 0, address: '', enabled: true, balance: 0 })
const showEdit = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await api.admin.listSenderAccess({
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
      address: address.value.trim(),
    })
    rows.value = res.results || []
    count.value = res.count || 0
  } catch (e) {
    toast.error(e.message || '加载发信权限失败')
  } finally { loading.value = false }
}

function search() {
  page.value = 1
  load()
}

function openEdit(row) {
  editRow.value = row
  edit.value = {
    address_id: row.id,
    address: row.address,
    enabled: !!row.enabled,
    balance: row.balance ?? 0,
  }
  showEdit.value = true
}

async function save() {
  try {
    await api.admin.updateSenderAccess(edit.value)
    toast.success('已更新')
    showEdit.value = false
    await load()
  } catch (e) {
    toast.error(e.message || '更新失败')
  }
}

async function del(row) {
  if (!confirm(`确认删除 ${row.address} 的发信权限记录？`)) return
  try {
    await api.admin.deleteSenderAccess(row.id)
    toast.success('已删除')
    await load()
  } catch (e) {
    toast.error(e.message || '删除失败')
  }
}

function totalPages() {
  return Math.max(1, Math.ceil(count.value / pageSize))
}

onMounted(load)
</script>

<template>
  <div class="panel">
    <div class="panel__toolbar">
      <div class="search">
        <Icon name="search" :size="16" />
        <input v-model="address" class="search__input" placeholder="按地址筛选" @keydown.enter="search" />
      </div>
      <button class="btn btn--ghost" @click="search">查询</button>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>地址</th>
            <th>启用</th>
            <th class="num">额度</th>
            <th>更新时间</th>
            <th class="actions-col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td class="mono dim">{{ r.id }}</td>
            <td class="mono">{{ r.address }}</td>
            <td>{{ r.enabled ? '是' : '否' }}</td>
            <td class="num">{{ r.balance ?? 0 }}</td>
            <td class="dim">{{ timeAgo(r.updated_at || r.created_at) }}</td>
            <td class="actions">
              <button class="tbtn" title="编辑" @click="openEdit(r)"><Icon name="settings" :size="15" /></button>
              <button class="tbtn tbtn--danger" title="删除" @click="del(r)"><Icon name="trash" :size="15" /></button>
            </td>
          </tr>
          <tr v-if="!rows.length && !loading">
            <td colspan="6" class="empty-cell">暂无发信权限记录</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="pager">
      <button class="tbtn" :disabled="page <= 1" @click="page--, load()"><Icon name="chevronL" :size="16" /></button>
      <span class="mono">{{ page }} / {{ totalPages() }}（共 {{ count }}）</span>
      <button class="tbtn" :disabled="page >= totalPages()" @click="page++, load()"><Icon name="chevronR" :size="16" /></button>
    </div>

    <Modal v-model:show="showEdit" title="编辑发信权限" size="sm">
      <div class="form-grid">
        <div class="form-row">
          <label>地址</label>
          <input v-model="edit.address" class="field mono" disabled />
        </div>
        <label class="switch-row">
          <span class="switch-row__label">启用发信</span>
          <input v-model="edit.enabled" type="checkbox" />
        </label>
        <div class="form-row">
          <label>可发送额度</label>
          <input v-model.number="edit.balance" class="field mono" type="number" min="0" />
        </div>
      </div>
      <template #footer>
        <button class="btn btn--ghost" @click="showEdit = false">取消</button>
        <button class="btn btn--primary" @click="save">保存</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped src="./admin-shared.css"></style>
