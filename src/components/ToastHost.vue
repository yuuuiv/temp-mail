<script setup>
import { useToast } from '@/composables/useToast'
import Icon from './Icon.vue'

const { toasts, dismiss } = useToast()

const iconFor = {
  success: 'check',
  error: 'alert',
  warning: 'alert',
  info: 'inbox',
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-host" role="region" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast"
          :class="`toast--${t.type}`"
          @click="dismiss(t.id)"
        >
          <Icon :name="iconFor[t.type] || 'inbox'" :size="18" class="toast__icon" />
          <span class="toast__msg">{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  z-index: var(--z-toast);
  bottom: calc(env(safe-area-inset-bottom, 0px) + var(--sp-5));
  right: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  max-width: min(92vw, 380px);
}
@media (max-width: 640px) {
  .toast-host {
    right: var(--sp-3);
    left: var(--sp-3);
    bottom: calc(env(safe-area-inset-bottom, 0px) + var(--sp-4));
    max-width: none;
  }
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  box-shadow: var(--shadow-lg);
  cursor: pointer;
  font-size: 14px;
}
.toast__icon { flex-shrink: 0; }
.toast--success { border-left-color: var(--success); color: var(--success); }
.toast--success .toast__msg { color: var(--text); }
.toast--error { border-left-color: var(--danger); }
.toast--error .toast__icon { color: var(--danger); }
.toast--warning { border-left-color: var(--warning); }
.toast--warning .toast__icon { color: var(--warning); }

.toast-enter-active,
.toast-leave-active {
  transition: all var(--dur) var(--ease);
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(20px) scale(0.96);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.96);
}
</style>
