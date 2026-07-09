<script setup>
import { ref } from 'vue'
import { api } from '@/lib/api'
import { useMailbox } from '@/composables/useMailbox'
import { useToast } from '@/composables/useToast'
import Modal from './Modal.vue'
import Icon from './Icon.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
})
const emit = defineEmits(['update:show'])

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
    emit('update:show', false)
    form.value.subject = ''
    form.value.content = ''
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
</script>

<template>
  <Modal
    :show="show"
    title="撰写邮件"
    size="lg"
    @update:show="emit('update:show', $event)"
  >
    <form class="send-form" @submit.prevent="submit">
      <div v-if="!settings.send_balance || settings.send_balance <= 0" class="notice">
        当前地址暂无可发送额度。
        <button type="button" class="link-btn" :disabled="busy" @click="requestAccess">申请发信权限</button>
      </div>
      <div class="grid">
        <label class="lbl">发件昵称</label>
        <input v-model="form.from_name" class="field" placeholder="可选" />

        <label class="lbl">收件人</label>
        <input
          v-model="form.to_mail"
          class="field mono"
          type="email"
          placeholder="someone@example.com"
          required
        />

        <label class="lbl">收件昵称</label>
        <input v-model="form.to_name" class="field" placeholder="可选" />

        <label class="lbl">主题</label>
        <input v-model="form.subject" class="field" placeholder="邮件主题" />
      </div>

      <div class="content-head">
        <span class="lbl">正文</span>
        <label class="switch">
          <input v-model="form.is_html" type="checkbox" />
          <span>HTML 格式</span>
        </label>
      </div>
      <textarea
        v-model="form.content"
        class="field textarea"
        :class="{ mono: form.is_html }"
        rows="8"
        placeholder="在此输入邮件正文…"
      />
      <p class="balance mono">
        可发送额度：{{ settings.send_balance ?? 0 }}
      </p>
    </form>

    <template #footer>
      <button class="btn btn--ghost" @click="emit('update:show', false)">取消</button>
      <button class="btn btn--primary" :disabled="busy" @click="submit">
        <Icon v-if="!busy" name="send" :size="16" />
        {{ busy ? '发送中…' : '发送' }}
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.send-form { display: flex; flex-direction: column; gap: var(--sp-4); }
.grid {
  display: grid;
  grid-template-columns: 90px 1fr;
  align-items: center;
  gap: var(--sp-3) var(--sp-4);
}
.lbl { font-size: 13px; color: var(--text-muted); font-weight: 500; }
.field {
  width: 100%;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--text);
  font-size: 14px;
}
.field:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.textarea { resize: vertical; line-height: 1.6; }
.content-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
  cursor: pointer;
}
.balance { font-size: 12px; color: var(--text-faint); margin: 0; }
.notice {
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--warning, #c98a2e);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--warning, #c98a2e) 10%, var(--surface));
  color: var(--text-2);
  font-size: 13px;
}
.link-btn {
  margin-left: var(--sp-2);
  border: none;
  background: transparent;
  color: var(--accent);
  font-weight: 700;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid transparent;
  border-radius: var(--radius);
  font-weight: 600;
  font-size: 14px;
}
.btn--primary { background: var(--accent); color: var(--accent-contrast); }
.btn--primary:hover:not(:disabled) { background: var(--accent-strong); }
.btn--primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn--ghost {
  background: var(--surface-2);
  color: var(--text-2);
  border-color: var(--border);
}
.btn--ghost:hover { background: var(--surface-hover); }

@media (max-width: 640px) {
  .grid { grid-template-columns: 1fr; gap: var(--sp-1) 0; }
  .grid .lbl { margin-top: var(--sp-2); }
}
</style>
