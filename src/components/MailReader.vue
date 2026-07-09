<script setup>
import { computed, ref, watch } from 'vue'
import { useMailbox } from '@/composables/useMailbox'
import { useToast } from '@/composables/useToast'
import { useTheme } from '@/composables/useTheme'
import { formatFull, initials, hueFrom, copyText } from '@/lib/utils'
import { api } from '@/lib/api'
import Icon from './Icon.vue'
import AiExtractInfo from './AiExtractInfo.vue'

const { currentMail, loadingMail, removeMail, openSettings } = useMailbox()
const { mode } = useTheme()
const toast = useToast()
const emit = defineEmits(['back'])

const iframeRef = ref(null)

const mail = computed(() => currentMail.value)

// 依赖 mode 使主题切换时重新渲染 iframe 内容
const isDark = computed(() => {
  void mode.value
  return document.documentElement.dataset.theme === 'dark'
})

const srcdoc = computed(() => {
  if (!mail.value) return ''
  const dark = isDark.value
  const html = mail.value.html
  const text = mail.value.text
  const body = html
    ? html
    : `<pre style="white-space:pre-wrap;word-break:break-word;font-family:inherit;margin:0">${escapeHtml(
        text || '(此邮件无正文内容)'
      )}</pre>`
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>
  :root { color-scheme: ${dark ? 'dark' : 'light'}; }
  body {
    margin: 16px;
    font: 15px/1.6 system-ui, -apple-system, "Segoe UI", "Noto Sans SC", sans-serif;
    color: ${dark ? '#eef1ef' : '#1c2321'};
    background: transparent;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  a { color: ${dark ? '#a9c2c9' : '#3a545e'}; }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; }
</style></head><body>${body}</body></html>`
})
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// 自适应 iframe 高度
function resize() {
  const f = iframeRef.value
  if (!f || !f.contentWindow) return
  try {
    const h = f.contentWindow.document.body.scrollHeight
    f.style.height = h + 24 + 'px'
  } catch {
    /* ignore cross-origin */
  }
}
watch(srcdoc, () => {
  requestAnimationFrame(() => setTimeout(resize, 60))
})

async function doCopy(text) {
  const ok = await copyText(text)
  toast[ok ? 'success' : 'error'](ok ? '已复制' : '复制失败')
}

async function doDelete() {
  if (!mail.value) return
  try {
    await removeMail(mail.value.id)
    toast.success('已删除')
    emit('back')
  } catch (e) {
    toast.error(e.message || '删除失败')
  }
}

function attachmentBlob(att) {
  const content = att.content || att.data || att.body
  if (!content) return null
  if (content instanceof Blob) return content
  if (content instanceof ArrayBuffer) return new Blob([content], { type: att.mimeType || att.type || 'application/octet-stream' })
  if (ArrayBuffer.isView(content)) return new Blob([content], { type: att.mimeType || att.type || 'application/octet-stream' })
  if (typeof content === 'string') return new Blob([content], { type: att.mimeType || att.type || 'application/octet-stream' })
  return null
}

async function saveToS3(att) {
  const blob = attachmentBlob(att)
  if (!blob) {
    toast.warning('当前邮件详情未包含附件二进制内容，无法直接保存到 S3')
    return
  }
  const filename = att.filename || att.name || `attachment-${Date.now()}`
  try {
    const { url } = await api.getAttachmentPutUrl(`${mail.value.id}/${filename}`)
    await fetch(url, { method: 'PUT', body: blob })
    toast.success('附件已保存到 S3')
  } catch (e) {
    toast.error(e.message || '保存失败')
  }
}
</script>

<template>
  <div class="reader">
    <!-- 空 -->
    <div v-if="!mail && !loadingMail" class="reader__empty">
      <div class="reader__empty-art">
        <Icon name="mail" :size="46" />
      </div>
      <p class="reader__empty-title">选择一封邮件</p>
      <p class="reader__empty-hint">从左侧列表中挑选一封邮件查看详情</p>
    </div>

    <template v-else>
      <header class="reader__head">
        <button class="icon-btn back-btn" aria-label="返回" @click="emit('back')">
          <Icon name="back" :size="20" />
        </button>
        <div class="reader__actions">
          <button
            class="icon-btn"
            aria-label="复制发件人"
            title="复制发件人"
            @click="doCopy(mail?.fromEmail)"
          >
            <Icon name="copy" :size="18" />
          </button>
          <button class="icon-btn icon-btn--danger" aria-label="删除" title="删除" @click="doDelete">
            <Icon name="trash" :size="18" />
          </button>
        </div>
      </header>

      <div v-if="loadingMail" class="reader__loading">
        <span class="spinner" /> 正在加载邮件…
      </div>

      <div v-else class="reader__scroll">
        <div class="reader__meta">
          <h1 class="reader__subject">{{ mail.subject }}</h1>
          <div class="reader__sender">
            <span
              class="avatar mono"
              :style="{
                background: `hsl(${hueFrom(mail.fromEmail)} 24% 62% / 0.22)`,
                color: `hsl(${hueFrom(mail.fromEmail)} 30% 38%)`,
              }"
            >
              {{ initials(mail.fromName || mail.fromEmail) }}
            </span>
            <div class="reader__sender-info">
              <div class="reader__from-name">{{ mail.fromName || mail.fromEmail }}</div>
              <div class="reader__from-email mono">{{ mail.fromEmail }}</div>
            </div>
            <div class="reader__date mono">
              <Icon name="clock" :size="14" />
              {{ formatFull(mail.createdAt) }}
            </div>
          </div>

          <!-- AI 提取信息 -->
          <AiExtractInfo :metadata="mail.raw?.metadata" />

          <div v-if="mail.attachments && mail.attachments.length" class="attachments">
            <span class="attachments__label">
              <Icon name="paperclip" :size="14" /> 附件 {{ mail.attachments.length }}
            </span>
            <a
              v-for="(a, i) in mail.attachments"
              :key="i"
              class="chip mono att-link"
              :href="a.url || a.download_url || '#'"
              :download="a.filename || a.name"
              :title="`下载 ${a.filename || a.name || '附件'}`"
            >
              <Icon name="paperclip" :size="12" />
              {{ a.filename || a.name || `附件 ${i + 1}` }}
            </a>
            <button
              v-for="(a, i) in openSettings.isS3Enabled ? mail.attachments : []"
              :key="`s3-${i}`"
              class="chip att-btn"
              type="button"
              title="保存到 S3"
              @click="saveToS3(a)"
            >
              保存 {{ a.filename || a.name || `附件 ${i + 1}` }}
            </button>
          </div>
        </div>

        <div class="reader__frame-wrap">
          <iframe
            ref="iframeRef"
            class="reader__frame"
            sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
            :srcdoc="srcdoc"
            title="邮件内容"
            @load="resize"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.reader {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
}
.reader__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-h);
  padding: 0 var(--sp-4);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.reader__actions { display: flex; gap: var(--sp-1); margin-left: auto; }
.back-btn { display: none; }

.reader__scroll {
  flex: 1;
  overflow-y: auto;
}
.reader__meta {
  padding: var(--sp-5) var(--sp-5) var(--sp-4);
  border-bottom: 1px solid var(--border);
}
.reader__subject {
  font-size: clamp(20px, 3vw, 26px);
  line-height: 1.25;
  margin-bottom: var(--sp-4);
}
.reader__sender {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.avatar {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}
.reader__sender-info { min-width: 0; }
.reader__from-name { font-weight: 600; }
.reader__from-email {
  font-size: 12.5px;
  color: var(--text-muted);
  word-break: break-all;
}
.reader__date {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  font-size: 12px;
  color: var(--text-faint);
}

.attachments {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin-top: var(--sp-4);
}
.attachments__label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-muted);
}
.chip {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-2);
}
.att-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  text-decoration: none;
  transition: background var(--dur), color var(--dur);
}
.att-link:hover {
  background: var(--accent-soft);
  color: var(--accent-strong);
  text-decoration: none;
}
.att-btn {
  cursor: pointer;
  font-family: var(--font-display);
}
.att-btn:hover { background: var(--surface-hover); }

.reader__frame-wrap { padding: var(--sp-3) var(--sp-4) var(--sp-6); }
.reader__frame {
  width: 100%;
  min-height: 240px;
  border: none;
  background: transparent;
}

.reader__empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-faint);
  gap: var(--sp-2);
  padding: var(--sp-5);
  text-align: center;
}
.reader__empty-art {
  width: 88px;
  height: 88px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-lg);
  background: var(--surface-2);
  color: var(--text-muted);
  margin-bottom: var(--sp-2);
}
.reader__empty-title { color: var(--text-muted); font-weight: 600; font-size: 16px; }
.reader__empty-hint { font-size: 13px; margin: 0; }

.reader__loading {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-6);
  color: var(--text-muted);
}
.spinner {
  width: 18px; height: 18px;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.icon-btn {
  display: grid;
  place-items: center;
  width: 38px; height: 38px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  transition: background var(--dur), color var(--dur);
}
.icon-btn:hover { background: var(--surface-hover); color: var(--text); }
.icon-btn--danger:hover { background: var(--danger-soft); color: var(--danger); }

@media (max-width: 900px) {
  .back-btn { display: grid; }
}
</style>
