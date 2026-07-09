<script setup>
import { ref } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: '输入后回车添加' },
})
const emit = defineEmits(['update:modelValue'])

const draft = ref('')

function add() {
  const v = draft.value.trim()
  if (!v) return
  if (!props.modelValue.includes(v)) {
    emit('update:modelValue', [...props.modelValue, v])
  }
  draft.value = ''
}
function remove(i) {
  const next = props.modelValue.slice()
  next.splice(i, 1)
  emit('update:modelValue', next)
}
function onBackspace() {
  if (!draft.value && props.modelValue.length) {
    remove(props.modelValue.length - 1)
  }
}
</script>

<template>
  <div class="tag-input">
    <span v-for="(tag, i) in modelValue" :key="tag + i" class="tag mono">
      {{ tag }}
      <button class="tag__x" type="button" @click="remove(i)">
        <Icon name="close" :size="12" />
      </button>
    </span>
    <input
      v-model="draft"
      class="tag-input__field"
      :placeholder="placeholder"
      @keydown.enter.prevent="add"
      @keydown.delete="onBackspace"
      @blur="add"
    />
  </div>
</template>

<style scoped>
.tag-input {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--surface-2);
  min-height: 44px;
}
.tag-input:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 6px 3px 10px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  border-radius: var(--radius-pill);
  font-size: 12.5px;
}
.tag__x {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  opacity: 0.7;
}
.tag__x:hover { opacity: 1; background: rgba(0, 0, 0, 0.1); }
.tag-input__field {
  flex: 1;
  min-width: 120px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  outline: none;
}
</style>
