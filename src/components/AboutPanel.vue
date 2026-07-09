<script setup>
import { useMailbox } from '@/composables/useMailbox'

const { openSettings } = useMailbox()
</script>

<template>
  <div class="about">
    <div class="card">
      <h2>{{ openSettings.title || 'Temp Email' }}</h2>
      <p v-if="openSettings.announcement" class="html" v-html="openSettings.announcement" />
      <dl>
        <template v-if="openSettings.version">
          <dt>后端版本</dt><dd class="mono">{{ openSettings.version }}</dd>
        </template>
        <template v-if="openSettings.adminContact">
          <dt>管理员联系</dt><dd v-html="openSettings.adminContact" />
        </template>
        <template v-if="openSettings.statusUrl">
          <dt>状态页</dt><dd><a :href="openSettings.statusUrl" target="_blank">{{ openSettings.statusUrl }}</a></dd>
        </template>
      </dl>
      <p v-if="openSettings.copyright" class="copy">{{ openSettings.copyright }}</p>
    </div>
  </div>
</template>

<style scoped>
.about { padding: var(--sp-5); height: 100%; overflow-y: auto; }
.card { max-width: 760px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--sp-5); }
h2 { margin: 0 0 var(--sp-4); }
dl { display: grid; grid-template-columns: 100px 1fr; gap: var(--sp-3); }
dt { color: var(--text-faint); }
dd { margin: 0; min-width: 0; word-break: break-word; }
.html { color: var(--text-2); line-height: 1.7; }
.copy { color: var(--text-faint); margin-top: var(--sp-5); }
</style>
