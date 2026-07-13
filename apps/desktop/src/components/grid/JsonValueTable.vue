<script setup lang="ts">
defineOptions({ name: "JsonValueTable" });

defineProps<{ value: unknown }>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
</script>

<template>
  <table v-if="isRecord(value)" class="json-value-table">
    <tbody>
      <tr v-for="(item, key) in value" :key="key">
        <th>{{ key }}</th>
        <td><JsonValueTable :value="item" /></td>
      </tr>
    </tbody>
  </table>
  <table v-else-if="Array.isArray(value)" class="json-value-table">
    <tbody>
      <tr v-for="(item, index) in value" :key="index">
        <th>{{ index }}</th>
        <td><JsonValueTable :value="item" /></td>
      </tr>
    </tbody>
  </table>
  <span v-else class="break-words">{{ value === null ? "null" : String(value) }}</span>
</template>

<style scoped>
.json-value-table { width: 100%; border-collapse: collapse; font-family: var(--dbx-editor-font-family); font-size: 0.75rem; }
.json-value-table th, .json-value-table td { border: 1px solid var(--border); padding: 0.35rem 0.5rem; text-align: left; vertical-align: top; }
.json-value-table th { width: 32%; color: var(--muted-foreground); font-weight: 500; overflow-wrap: anywhere; }
</style>
