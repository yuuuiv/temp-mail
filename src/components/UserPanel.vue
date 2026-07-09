<script setup>
import Modal from './Modal.vue'
import AuthModuleLogin from './AuthModuleLogin.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
})
const emit = defineEmits(['update:show'])
</script>

<template>
  <Modal :show="props.show" title="用户账户" size="sm" @update:show="emit('update:show', $event)">
    <div class="user-panel">
      <AuthModuleLogin @close="emit('update:show', false)" />
    </div>
  </Modal>
</template>

<style scoped>
.user-panel {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
</style>
