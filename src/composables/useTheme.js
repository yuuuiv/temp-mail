import { ref, watch } from 'vue'

// 主题: 'light' | 'dark' | 'auto'
const THEMES = ['light', 'dark', 'auto']
const stored = localStorage.getItem('tm-theme')
const mode = ref(THEMES.includes(stored) ? stored : 'auto')

const mql = window.matchMedia('(prefers-color-scheme: dark)')

function resolved() {
  if (mode.value === 'auto') return mql.matches ? 'dark' : 'light'
  return mode.value
}

function apply() {
  document.documentElement.dataset.theme = resolved()
}

mql.addEventListener('change', () => {
  if (mode.value === 'auto') apply()
})

watch(mode, (v) => {
  localStorage.setItem('tm-theme', v)
  apply()
}, { immediate: true })

export function useTheme() {
  const cycle = () => {
    const i = THEMES.indexOf(mode.value)
    mode.value = THEMES[(i + 1) % THEMES.length]
  }
  const setMode = (m) => {
    if (THEMES.includes(m)) mode.value = m
  }
  return { mode, resolved, cycle, setMode, THEMES }
}
