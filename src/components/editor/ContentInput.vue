<script setup lang="ts">
import { computed } from 'vue'
import type { CardData, CardType } from '@/types/card'
import { CARD_TYPE_LABELS } from '@/types/card'
import TagInput from './TagInput.vue'
import LanguageSelect from '@/components/code/LanguageSelect.vue'
import ThemeSelect from '@/components/code/ThemeSelect.vue'

const props = defineProps<{ card: CardData }>()
const emit = defineEmits<{ 'add-tag': [v: string]; 'remove-tag': [v: string] }>()

const types = Object.keys(CARD_TYPE_LABELS) as CardType[]

const contentLabel = computed(() => {
  switch (props.card.type) {
    case 'code':
      return '代码内容'
    case 'terminal':
      return '终端命令与输出'
    case 'math':
      return 'LaTeX 公式'
    case 'quote':
      return '引用文本'
    default:
      return '正文（支持 Markdown）'
  }
})

const contentPlaceholder = computed(() => {
  switch (props.card.type) {
    case 'code':
      return 'const answer = 42'
    case 'terminal':
      return '$ npm run build\nvite v6.0.5 building for production...\n✓ built in 812ms'
    case 'math':
      return String.raw`E = mc^2`
    case 'quote':
      return '简单是可靠的前提。'
    default:
      return '## 小标题\n\n支持 **加粗**、`行内代码`、列表和引用。'
  }
})

const rows = computed(() => (props.card.type === 'code' || props.card.type === 'terminal' ? 9 : 8))
</script>

<template>
  <div class="content-input">
    <div class="field">
      <label class="field-label">卡片类型</label>
      <div class="type-grid">
        <button
          v-for="t in types"
          :key="t"
          type="button"
          class="type-btn"
          :data-active="card.type === t"
          @click="card.type = t"
        >
          {{ CARD_TYPE_LABELS[t] }}
        </button>
      </div>
    </div>

    <div class="field">
      <label class="field-label" for="cc-title">标题</label>
      <input id="cc-title" v-model="card.title" class="field-input" placeholder="一句话讲清这张卡片" />
    </div>

    <div class="field">
      <label class="field-label" for="cc-subtitle">副标题</label>
      <input id="cc-subtitle" v-model="card.subtitle" class="field-input" placeholder="可选，一行补充说明" />
    </div>

    <div v-if="card.type === 'code'" class="row-2">
      <div class="field">
        <label class="field-label">语言</label>
        <LanguageSelect v-model="card.language" />
      </div>
      <div class="field">
        <label class="field-label">高亮主题</label>
        <ThemeSelect v-model="card.highlightTheme" />
      </div>
    </div>

    <div v-if="card.type === 'code'" class="row-2">
      <div class="field">
        <label class="field-label" for="cc-filename">文件名</label>
        <input id="cc-filename" v-model="card.filename" class="field-input" placeholder="index.ts" />
      </div>
      <label class="switch-field">
        <input v-model="card.showLineNumbers" type="checkbox" class="switch" />
        <span class="field-label">显示行号</span>
      </label>
    </div>

    <div class="field">
      <label class="field-label" for="cc-content">{{ contentLabel }}</label>
      <textarea
        id="cc-content"
        v-model="card.content"
        class="field-input mono"
        :rows="rows"
        :placeholder="contentPlaceholder"
        spellcheck="false"
      />
    </div>

    <div v-if="card.type === 'quote'" class="field">
      <label class="field-label" for="cc-quote-from">出处</label>
      <input id="cc-quote-from" v-model="card.quoteFrom" class="field-input" placeholder="作者 / 书名" />
    </div>

    <div class="field">
      <label class="field-label">标签（最多 5 个）</label>
      <TagInput :tags="card.tags" @add="emit('add-tag', $event)" @remove="emit('remove-tag', $event)" />
    </div>

    <div class="field">
      <label class="field-label">底部信息</label>
      <div class="row-3">
        <input v-model="card.footer!.author" class="field-input" placeholder="作者" />
        <input v-model="card.footer!.source" class="field-input" placeholder="来源链接" />
        <input v-model="card.footer!.date" class="field-input" placeholder="日期" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.content-input {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.row-3 {
  display: grid;
  gap: 8px;
}
.type-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.type-btn {
  padding: 7px 4px;
  border-radius: 8px;
  border: 1px solid var(--ui-border);
  background: var(--ui-bg);
  font-size: 12px;
  color: var(--ui-muted);
  transition: all 0.15s;
  cursor: pointer;
}
.type-btn:hover {
  color: var(--ui-text);
}
.type-btn[data-active='true'] {
  border-color: #6366F1;
  background: rgba(99, 102, 241, 0.1);
  color: #6366F1;
  font-weight: 500;
}
.mono {
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
  line-height: 1.7;
  resize: vertical;
}
.switch-field {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 20px;
  cursor: pointer;
}
.switch {
  width: 16px;
  height: 16px;
  accent-color: #6366F1;
}
</style>
