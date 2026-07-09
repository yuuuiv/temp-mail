<script setup>
import { onMounted, ref, computed } from 'vue'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import Icon from '../Icon.vue'

const toast = useToast()
const data = ref({})
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    data.value = await api.admin.statistics()
  } catch (e) {
    toast.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const cards = computed(() => {
  const d = data.value || {}
  return [
    { label: '邮箱地址总数', value: d.addressCount, icon: 'mail' },
    { label: '用户总数', value: d.userCount, icon: 'settings' },
    { label: '收件总数', value: d.mailCount, icon: 'inbox' },
    { label: '发件总数', value: d.sendCount, icon: 'send' },
    { label: '7 天活跃地址', value: d.activeAddressCount7days ?? d.activeUserCount7days, icon: 'clock' },
    { label: '30 天活跃地址', value: d.activeAddressCount30days ?? d.activeUserCount30days, icon: 'clock' },
  ].filter((c) => c.value !== undefined && c.value !== null)
})

onMounted(load)
</script>

<template>
  <div class="panel">
    <div class="panel__toolbar">
      <h3 style="margin:0;font-size:17px">数据统计</h3>
      <button class="btn btn--ghost icon-only" :class="{ 'is-spin': loading }" @click="load">
        <Icon name="refresh" :size="16" />
      </button>
    </div>

    <div class="stat-grid">
      <div v-for="c in cards" :key="c.label" class="stat">
        <div class="stat__icon"><Icon :name="c.icon" :size="20" /></div>
        <div class="stat__body">
          <div class="stat__value mono">{{ (c.value ?? 0).toLocaleString() }}</div>
          <div class="stat__label">{{ c.label }}</div>
        </div>
      </div>
      <p v-if="!cards.length && !loading" class="dim">暂无统计数据</p>
    </div>
  </div>
</template>

<style scoped src="./admin-shared.css"></style>
<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--sp-4);
}
.stat {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--sp-5);
}
.stat__icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: var(--accent-soft);
  color: var(--accent);
}
.stat__value { font-size: 26px; font-weight: 700; line-height: 1.1; }
.stat__label { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
</style>
