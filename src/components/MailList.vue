<script setup>
import { computed } from 'vue'
import { useMailbox } from '@/composables/useMailbox'
import { timeAgo, initials, hueFrom } from '@/lib/utils'
import Icon from './Icon.vue'

const {
  mails,
  currentMail,
  loadingList,
  loadingMail,
  currentPage,
  totalPages,
  totalCount,
  loadMails,
  openMail,
} = useMailbox()

const emit = defineEmits(['select'])

const isEmpty = computed(() => !loadingList.value && mails.value.length === 0)

function select(m) {
  openMail(m)
  emit('select', m)
}

function prev() {
  if (currentPage.value > 1) loadMails(currentPage.value - 1)
}
function next() {
  if (currentPage.value < totalPages.value) loadMails(currentPage.value + 1)
}
</script>

<template>
  <div class="list">
    <header class="list__head">
      <div class="list__heading">
        <h2>收件箱</h2>
        <span class="count mono">{{ totalCount }}</span>
      </div>
      <button
        class="icon-btn"
        :class="{ 'is-spinning': loadingList }"
        aria-label="刷新"
        @click="loadMails(currentPage)"
      >
        <Icon name="refresh" :size="18" />
      </button>
    </header>

    <div class="list__scroll">
      <!-- 骨架屏 -->
      <template v-if="loadingList && !mails.length">
        <div v-for="i in 6" :key="i" class="row row--skeleton">
          <div class="sk sk--avatar" />
          <div class="sk-lines">
            <div class="sk sk--line" style="width: 60%" />
            <div class="sk sk--line" style="width: 90%" />
          </div>
        </div>
      </template>

      <!-- 空态 -->
      <div v-else-if="isEmpty" class="empty">
        <Icon name="inbox" :size="40" />
        <p class="empty__title">暂无邮件</p>
        <p class="empty__hint">收到的邮件会自动出现在这里</p>
      </div>

      <!-- 列表 -->
      <button
        v-for="m in mails"
        :key="m.id"
        class="row"
        :class="{ 'is-active': currentMail && currentMail.id === m.id }"
        @click="select(m)"
      >
        <span
          class="avatar mono"
          :style="{
            background: `hsl(${hueFrom(m.fromEmail)} 24% 62% / 0.22)`,
            color: `hsl(${hueFrom(m.fromEmail)} 30% 38%)`,
          }"
        >
          {{ initials(m.fromName || m.fromEmail) }}
        </span>
        <span class="row__body">
          <span class="row__top">
            <span class="row__from">{{ m.fromName || m.fromEmail }}</span>
            <span class="row__time mono">{{ timeAgo(m.createdAt) }}</span>
          </span>
          <span class="row__subject">{{ m.subject }}</span>
          <span class="row__preview">{{ m.preview }}</span>
        </span>
      </button>
    </div>

    <footer v-if="totalPages > 1" class="list__pager">
      <button class="icon-btn" :disabled="currentPage <= 1" @click="prev">
        <Icon name="chevronL" :size="18" />
      </button>
      <span class="pager__label mono">{{ currentPage }} / {{ totalPages }}</span>
      <button class="icon-btn" :disabled="currentPage >= totalPages" @click="next">
        <Icon name="chevronR" :size="18" />
      </button>
    </footer>
  </div>
</template>

<style scoped>
.list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-elevated);
  border-right: 1px solid var(--border);
}
.list__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-4) var(--sp-4);
  height: var(--header-h);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.list__heading {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
}
.list__heading h2 { font-size: 17px; }
.count {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--surface-2);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
}
.list__scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--sp-2);
}

.row {
  display: flex;
  gap: var(--sp-3);
  width: 100%;
  text-align: left;
  padding: var(--sp-3);
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: transparent;
  transition: background var(--dur), border-color var(--dur);
}
.row:hover { background: var(--surface-hover); }
.row.is-active {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
}
.avatar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
}
.row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-2);
}
.row__from {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row__time {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-faint);
}
.row__subject {
  font-size: 13.5px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row__preview {
  font-size: 12.5px;
  color: var(--text-faint);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  color: var(--text-faint);
  padding: var(--sp-7) var(--sp-4);
  text-align: center;
}
.empty__title { color: var(--text-muted); font-weight: 600; margin: var(--sp-2) 0 0; }
.empty__hint { font-size: 13px; margin: 0; }

/* 骨架 */
.row--skeleton { pointer-events: none; }
.sk {
  background: linear-gradient(
    90deg,
    var(--surface-2) 25%,
    var(--surface-hover) 50%,
    var(--surface-2) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 6px;
}
.sk--avatar { width: 40px; height: 40px; border-radius: var(--radius); flex-shrink: 0; }
.sk-lines { flex: 1; display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
.sk--line { height: 12px; }
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.list__pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
  padding: var(--sp-2);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
.pager__label { font-size: 13px; color: var(--text-muted); }

.icon-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  transition: background var(--dur), color var(--dur);
}
.icon-btn:hover:not(:disabled) { background: var(--surface-hover); color: var(--text); }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.is-spinning :deep(svg) { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
