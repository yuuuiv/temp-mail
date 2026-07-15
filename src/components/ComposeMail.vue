<script setup>
import { ref, computed } from 'vue'
import { api } from '@/lib/api'
import { useMailbox } from '@/composables/useMailbox'
import { useToast } from '@/composables/useToast'
import Icon from './Icon.vue'

const emit = defineEmits(['back', 'sent'])

const { settings } = useMailbox()
const toast = useToast()

const form = ref({
  from_name: '',
  to_name: '',
  to_mail: '',
  subject: '',
  content: '',
  is_html: false,
})
const busy = ref(false)

async function submit() {
  if (!form.value.to_mail.trim()) {
    toast.warning('请填写收件人地址')
    return
  }
  if (!form.value.subject.trim()) {
    toast.warning('请填写邮件主题')
    return
  }
  if (!form.value.content.trim()) {
    toast.warning('请填写邮件正文')
    return
  }
  busy.value = true
  try {
    await api.sendMail({ ...form.value })
    toast.success('邮件已发送')
    emit('sent')
  } catch (e) {
    toast.error(e.message || '发送失败')
  } finally {
    busy.value = false
  }
}

async function requestAccess() {
  busy.value = true
  try {
    await api.requestSendMailAccess()
    toast.success('已提交发信权限申请')
  } catch (e) {
    toast.error(e.message || '申请失败')
  } finally {
    busy.value = false
  }
}

const toggleHtml = () => {
  form.value.is_html = !form.value.is_html
}
</script>

<template>
  <div class="compose">
    <!-- 顶栏 -->
    <header class="compose__bar">
      <button class="icon-btn compose__back" aria-label="返回" @click="emit('back')">
        <Icon name="back" :size="22" />
      </button>
      <h2 class="compose__title">撰写邮件</h2>
      <button
        class="btn btn--primary send-btn"
        :disabled="busy"
        @click="submit"
      >
        <Icon name="send" :size="16" />
        <span>{{ busy ? '发送中…' : '发送' }}</span>
      </button>
    </header>

    <!-- 额度提示 -->
    <div v-if="!settings.send_balance || settings.send_balance <= 0" class="compose__notice">
      <span>当前地址暂无可发送额度。</span>
      <button type="button" class="link-btn" :disabled="busy" @click="requestAccess">申请发信权限</button>
    </div>

    <!-- 表单 -->
    <div class="compose__body">
      <div class="compose__field">
        <label class="compose__label">发件昵称</label>
        <input v-model="form.from_name" class="compose__input" placeholder="可选" />
      </div>

      <div class="compose__field">
        <label class="compose__label">收件人 <span class="required">*</span></label>
        <input
          v-model="form.to_mail"
          class="compose__input mono"
          type="email"
          placeholder="someone@example.com"
        />
      </div>

      <div class="compose__field">
        <label class="compose__label">收件昵称</label>
        <input v-model="form.to_name" class="compose__input" placeholder="可选" />
      </div>

      <div class="compose__field">
        <label class="compose__label">主题 <span class="required">*</span></label>
        <input v-model="form.subject" class="compose__input" placeholder="邮件主题" />
      </div>

      <div class="compose__field compose__field--grow">
        <div class="compose__label-row">
          <label class="compose__label">正文 <span class="required">*</span></label>
          <label class="compose__html-toggle" :class="{ active: form.is_html }">
            <input v-model="form.is_html" type="checkbox" />
            <Icon name="code" :size="15" />
            <span>HTML</span>
          </label>
        </div>
        <textarea
          v-model="form.content"
          class="compose__input compose__textarea"
          :class="{ mono: form.is_html }"
          placeholder="在此输入邮件正文…"
        />
      </div>
    </div>

    <!-- 底部：发送额度 -->
    <div class="compose__footer">
      <span class="compose__balance mono">
        可发送额度：{{ settings.send_balance ?? 0 }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.compose {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.compose__bar {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3);
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
  flex-shrink: 0;
}
.compose__back {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
}
.compose__back:hover { background: var(--surface-hover); }
.compose__title {
  flex: 1;
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.send-btn {
  white-space: nowrap;
}

.compose__notice {
  margin: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--warning, #c98a2e);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--warning, #c98a2e) 10%, var(--surface));
  color: var(--text-2);
  font-size: 13px;
  flex-shrink: 0;
}
.link-btn {
  margin-left: var(--sp-2);
  border: none;
  background: transparent;
  color: var(--accent);
  font-weight: 700;
  font-size: 13px;
}

.compose__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.compose__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.compose__field--grow {
  flex: 1;
  min-height: 0;
}
.compose__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
}
.required { color: var(--danger, #e44); }
.compose__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.compose__html-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-faint);
  cursor: pointer;
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: color var(--dur), border-color var(--dur);
}
.compose__html-toggle:hover {
  color: var(--text);
  border-color: var(--text-muted);
}
.compose__html-toggle.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-soft);
}
.compose__html-toggle input { display: none; }
.compose__input {
  width: 100%;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--text);
  font-size: 14px;
  transition: border-color var(--dur), box-shadow var(--dur);
}
.compose__input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.compose__textarea {
  resize: none;
  flex: 1;
  min-height: 200px;
  line-height: 1.7;
  font-size: 14px;
}
.compose__textarea.mono {
  font-family: var(--font-mono);
  font-size: 13px;
}

.compose__footer {
  flex-shrink: 0;
  padding: var(--sp-3) var(--sp-4);
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
}
.compose__balance {
  font-size: 12px;
  color: var(--text-faint);
}

/* 桌面端增加内边距 */
@media (min-width: 901px) {
  .compose__bar {
    padding: var(--sp-3) var(--sp-5);
  }
  .compose__body {
    padding: var(--sp-5);
    max-width: 780px;
  }
  .compose__notice {
    margin: var(--sp-4) var(--sp-5) 0;
    max-width: 780px;
  }
  .compose__footer {
    padding: var(--sp-3) var(--sp-5);
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid transparent;
  border-radius: var(--radius);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}
.btn--primary { background: var(--accent); color: var(--accent-contrast); }
.btn--primary:hover:not(:disabled) { background: var(--accent-strong); }
.btn--primary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
