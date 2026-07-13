<script setup lang="ts">
import { ChevronDown, ChevronRight } from "@lucide/vue";
import { computed, ref } from "vue";

defineOptions({ name: "JsonValueTable" });

const props = defineProps<{ value: unknown }>();
const expanded = ref(true);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const isContainer = computed(() => isRecord(props.value) || Array.isArray(props.value));
const containerLabel = computed(() => (Array.isArray(props.value) ? `Array (${props.value.length})` : `Object (${Object.keys(props.value as Record<string, unknown>).length})`));
</script>

<template>
  <div v-if="isContainer" class="json-value-container">
    <button type="button" class="json-value-toggle" :aria-expanded="expanded" @click="expanded = !expanded">
      <ChevronDown v-if="expanded" class="h-3.5 w-3.5" />
      <ChevronRight v-else class="h-3.5 w-3.5" />
      <span>{{ containerLabel }}</span>
    </button>
    <table v-show="expanded && isRecord(value)" class="json-value-table">
      <thead>
        <tr>
          <th v-for="(_, key) in value as Record<string, unknown>" :key="key">{{ key }}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td v-for="(item, key) in value as Record<string, unknown>" :key="key"><JsonValueTable :value="item" /></td>
        </tr>
      </tbody>
    </table>
    <table v-show="expanded && Array.isArray(value)" class="json-value-table">
      <thead>
        <tr>
          <th v-for="(_, index) in value as unknown[]" :key="index">{{ index }}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td v-for="(item, index) in value as unknown[]" :key="index"><JsonValueTable :value="item" /></td>
        </tr>
      </tbody>
    </table>
  </div>
  <span v-else class="break-words">{{ value === null ? "null" : String(value) }}</span>
</template>

<style scoped>
.json-value-table { width: 100%; border-collapse: collapse; font-family: var(--dbx-editor-font-family); font-size: 0.75rem; }
.json-value-table th, .json-value-table td { border: 1px solid var(--border); padding: 0.35rem 0.5rem; text-align: left; vertical-align: top; }
.json-value-table th { width: 32%; color: var(--muted-foreground); font-weight: 500; overflow-wrap: anywhere; }
.json-value-toggle { display: flex; align-items: center; gap: 0.25rem; width: 100%; padding: 0.25rem 0.4rem; color: var(--muted-foreground); font-size: 0.7rem; text-align: left; }
.json-value-toggle:hover { background: var(--accent); color: var(--foreground); }
</style>
