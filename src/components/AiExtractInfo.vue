<script setup>
import { computed } from 'vue'
import { copyText } from '@/lib/utils'
import { useToast } from '@/composables/useToast'
import Icon from './Icon.vue'

const toast = useToast()

const props = defineProps({
  metadata: { type: String, default: null },
  compact: { type: Boolean, default: false },
})

const ai = computed(() => {
  if (!props.metadata) return null
  try {
    const d = JSON.parse(props.metadata)
    return d.ai_extract || null
  } catch { return null }
})

const typeLabel = computed(() => {
  const map = {
    auth_code: '验证码',
    auth_link: '认证链接',
    service_link: '服务链接',
    subscription_link: '订阅链接',
    other_link: '其他链接',
  }
  return map[ai.value?.type] || ''
})
const isLink = computed(() => ai.value && ai.value.type !== 'auth_code')
const display = computed(() => {
  if (!ai.value) return ''
  if (ai.value.type === 'auth_code') return ai.value.result
  return ai.value.result_text || ai.value.result
})
const iconName = computed(() => (ai.value?.type === 'auth_code' ? 'check' : 'mail'))

async function doCopy() {
  if (!ai.value) return
  const ok = await copyText(ai.value.result)
  toast[ok ? 'success' : 'error'](ok ? '已复制' : '复制失败')
}
function openLink() {
  if (isLink.value && ai.value.result) window.open(ai.value.result, '_blank')
}
</script>

<template>
  <div v-if="ai && ai.result" class="ai-box" :class="{ 'ai-box--compact': compact }">
    <Icon :name="iconName" :size="16" class="ai-box__icon" />
    <span class="ai-box__label">{{ typeLabel }}</span>
    <code
      v-if="ai.type === 'auth_code'"
      class="ai-box__code mono"
      @click="doCopy"
      :title="`点击复制 ${ai.result}`"
    >{{ ai.result }}</code>
    <a
      v-else-if="isLink"
      class="ai-box__link mono"
      :href="ai.result"
      target="_blank"
    >{{ display }}</a>
    <span v-else class="ai-box__text">{{ display }}</span>
    <button class="ai-box__btn" @click="doCopy" title="复制">
      <Icon name="copy" :size="14" />
    </button>
    <button v-if="isLink" class="ai-box__btn" @click="openLink" title="打开">
      <Icon name="mail" :size="14" />
    </button>
  </div>
</template>

<style scoped>
.ai-box {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  background: color-mix(in srgb, var(--success) 8%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--success) 24%, var(--border));
  border-radius: var(--radius);
  margin-bottom: var(--sp-3);
  font-size: 14px;
}
.ai-box--compact { padding: 6px var(--sp-3); font-size: 12.5px; }
.ai-box__icon { color: var(--success); flex-shrink: 0; }
.ai-box__label {
  color: var(--success);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}
.ai-box__code {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text);
  cursor: pointer;
  transition: color var(--dur);
}
.ai-box__code:hover { color: var(--accent-strong); }
.ai-box__link {
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ai-box__text { color: var(--text-2); }
.ai-box__btn {
  display: grid;
  place-items: center;
  width: 28px; height: 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-muted);
  flex-shrink: 0;
  margin-left: auto;
}
.ai-box__btn:hover { background: var(--surface-hover); color: var(--text); }

@media (max-width: 600px) {
  .ai-box__label { display: none; }
}
</style>
