<script setup>
import { watch } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg
})
const emit = defineEmits(['update:show'])

function close() {
  emit('update:show', false)
}
function onKey(e) {
  if (e.key === 'Escape') close()
}

watch(
  () => props.show,
  (v) => {
    if (v) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="scrim" @click.self="close">
        <div class="modal" :class="`modal--${size}`" role="dialog" aria-modal="true">
          <header class="modal__head">
            <h2 class="modal__title">{{ title }}</h2>
            <button class="icon-btn" aria-label="关闭" @click="close">
              <Icon name="close" :size="20" />
            </button>
          </header>
          <div class="modal__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="modal__foot">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background: var(--scrim);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-4);
}
.modal {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  max-height: min(90vh, 720px);
  overflow: hidden;
}
.modal--sm { max-width: 420px; }
.modal--md { max-width: 560px; }
.modal--lg { max-width: 760px; }

.modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--border);
}
.modal__title {
  font-size: 18px;
}
.modal__body {
  padding: var(--sp-5);
  overflow-y: auto;
}
.modal__foot {
  padding: var(--sp-4) var(--sp-5);
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-3);
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  transition: background var(--dur), color var(--dur);
}
.icon-btn:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--dur) var(--ease);
}
.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform var(--dur) var(--ease), opacity var(--dur) var(--ease);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: translateY(16px) scale(0.98);
  opacity: 0;
}

@media (max-width: 640px) {
  .scrim {
    align-items: flex-end;
    padding: 0;
  }
  .modal {
    max-width: none !important;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    max-height: 92vh;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .modal-enter-from .modal,
  .modal-leave-to .modal {
    transform: translateY(100%);
  }
}
</style>
