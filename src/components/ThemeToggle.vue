<script setup>
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import Icon from './Icon.vue'

const { mode, cycle } = useTheme()

const meta = computed(() => {
  switch (mode.value) {
    case 'light':
      return { icon: 'sun', label: '浅色' }
    case 'dark':
      return { icon: 'moon', label: '深色' }
    default:
      return { icon: 'auto', label: '跟随系统' }
  }
})
</script>

<template>
  <button
    class="theme-toggle"
    :title="`主题：${meta.label}（点击切换）`"
    :aria-label="`当前主题 ${meta.label}，点击切换`"
    @click="cycle"
  >
    <Transition name="swap" mode="out-in">
      <Icon :key="meta.icon" :name="meta.icon" :size="18" />
    </Transition>
    <span class="theme-toggle__label">{{ meta.label }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background var(--dur), color var(--dur), border-color var(--dur);
}
.theme-toggle:hover {
  background: var(--surface-hover);
  color: var(--text);
  border-color: var(--border-strong);
}
.swap-enter-active,
.swap-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.swap-enter-from { opacity: 0; transform: rotate(-30deg) scale(0.7); }
.swap-leave-to { opacity: 0; transform: rotate(30deg) scale(0.7); }

@media (max-width: 900px) {
  .theme-toggle__label { display: none; }
  .theme-toggle { padding: var(--sp-2); }
}
</style>
