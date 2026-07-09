<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useTheme } from '@/composables/useTheme'

const props = defineProps({
  siteKey: { type: String, default: '' },
})
const emit = defineEmits(['update:token'])

const { resolved } = useTheme()
const el = ref(null)
const widgetId = ref(null)

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve()
    let s = document.querySelector(`script[src="${SCRIPT_SRC}"]`)
    if (s) {
      s.addEventListener('load', () => resolve())
      s.addEventListener('error', reject)
      return
    }
    s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = reject
    document.head.appendChild(s)
  })
}

async function render() {
  if (!props.siteKey || !el.value) return
  await loadScript()
  if (!window.turnstile) return
  reset()
  widgetId.value = window.turnstile.render(el.value, {
    sitekey: props.siteKey,
    theme: resolved(),
    callback: (token) => emit('update:token', token),
    'error-callback': () => emit('update:token', ''),
    'expired-callback': () => emit('update:token', ''),
  })
}

function reset() {
  if (widgetId.value && window.turnstile) {
    try {
      window.turnstile.remove(widgetId.value)
    } catch {
      /* ignore */
    }
    widgetId.value = null
  }
}

defineExpose({ reset, render })

onMounted(render)
onBeforeUnmount(reset)
watch(() => props.siteKey, render)
</script>

<template>
  <div v-if="siteKey" ref="el" class="turnstile" />
</template>

<style scoped>
.turnstile {
  min-height: 65px;
  display: flex;
  justify-content: center;
}
</style>
