<template>
  <div class="md-content" v-if="!structured" v-html="legacyHtml" />
  <div class="md-content structured-answer" v-else>
    <p class="sa-summary"><RichTextSpan :rich="structured.summary" /></p>

    <div v-for="(s, i) in structured.sections || []" :key="i" class="sa-section">
      <h4 v-if="s.heading" class="sa-heading">{{ s.heading }}</h4>
      <p v-if="s.content" class="sa-content"><RichTextSpan :rich="s.content" /></p>
      <ol v-if="s.bullets" class="sa-bullets">
        <li v-for="(b, j) in s.bullets" :key="j">
          <strong v-if="b.term" class="sa-term">{{ b.term }}</strong>
          <template v-if="b.term"> — </template>
          <RichTextSpan :rich="b.explanation" />
        </li>
      </ol>
    </div>

    <p v-if="structured.note" class="sa-note"><RichTextSpan :rich="structured.note" /></p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderMd } from '../utils/markdown'
import { parseStructuredAnswer } from '../utils/answerFormat'
import type { StructuredAnswer } from '../types/answer'
import RichTextSpan from './RichTextSpan.vue'

const props = defineProps<{ answer: string }>()

const structured = computed<StructuredAnswer | null>(() =>
  parseStructuredAnswer(props.answer)
)

const legacyHtml = computed(() =>
  structured.value ? '' : renderMd(props.answer)
)
</script>
