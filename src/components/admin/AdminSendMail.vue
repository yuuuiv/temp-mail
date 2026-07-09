<script setup>
import { ref } from 'vue'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import Icon from '../Icon.vue'

const toast = useToast()
const busy = ref(false)
const form = ref({
  from_mail: '',
  from_name: '',
  to_name: '',
  to_mail: '',
  subject: '',
  content: '',
  is_html: false,
})

async function submit() {
  if (!form.value.from_mail || !form.value.to_mail || !form.value.subject || !form.value.content) {
    toast.warning('请填写发件地址、收件人、主题和正文')
    return
  }
  busy.value = true
  try {
    await api.admin.sendMail(form.value)
    toast.success('邮件已发送')
    form.value.to_mail = ''
    form.value.subject = ''
    form.value.content = ''
  } catch (e) {
    toast.error(e.message || '发送失败')
  } finally { busy.value = false }
}
</script>

<template>
  <div class="panel">
    <div class="card">
      <div class="card__head">
        <h3 class="card__title">管理员发信</h3>
        <button class="btn btn--primary" :disabled="busy" @click="submit">
          <Icon name="send" :size="16" /> {{ busy ? '发送中…' : '发送' }}
        </button>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label>发件地址</label>
          <input v-model="form.from_mail" class="field mono" placeholder="sender@example.com" />
        </div>
        <div class="form-row">
          <label>发件昵称</label>
          <input v-model="form.from_name" class="field" />
        </div>
        <div class="form-row">
          <label>收件人</label>
          <input v-model="form.to_mail" class="field mono" placeholder="to@example.com" />
        </div>
        <div class="form-row">
          <label>收件昵称</label>
          <input v-model="form.to_name" class="field" />
        </div>
        <div class="form-row">
          <label>主题</label>
          <input v-model="form.subject" class="field" />
        </div>
        <label class="switch-row">
          <span class="switch-row__label">HTML 格式</span>
          <input v-model="form.is_html" type="checkbox" />
        </label>
        <div class="form-row">
          <label>正文</label>
          <textarea v-model="form.content" class="field" rows="10" :class="{ mono: form.is_html }" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./admin-shared.css"></style>
<style scoped>
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--sp-5); max-width: 860px; }
.card__head { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4); }
.card__title { margin: 0; font-size: 17px; }
</style>
