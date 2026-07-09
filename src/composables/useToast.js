import { ref } from 'vue'

let seq = 0
const toasts = ref([])

function push(message, type = 'info', timeout = 3200) {
  const id = ++seq
  toasts.value.push({ id, message, type })
  if (timeout) setTimeout(() => dismiss(id), timeout)
  return id
}

function dismiss(id) {
  const i = toasts.value.findIndex((t) => t.id === id)
  if (i !== -1) toasts.value.splice(i, 1)
}

export function useToast() {
  return {
    toasts,
    info: (m, t) => push(m, 'info', t),
    success: (m, t) => push(m, 'success', t),
    error: (m, t) => push(m, 'error', t ?? 4200),
    warning: (m, t) => push(m, 'warning', t),
    dismiss,
  }
}
