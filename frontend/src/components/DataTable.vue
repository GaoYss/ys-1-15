<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th v-if="selectable" class="col-check">
            <input
              type="checkbox"
              :checked="isAllSelected"
              :indeterminate="isIndeterminate"
              @change="toggleSelectAll"
            />
          </th>
          <th v-for="column in columns" :key="column.key">{{ column.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!rows.length">
          <td :colspan="columns.length + (selectable ? 1 : 0)" class="empty-cell">暂无数据</td>
        </tr>
        <tr v-for="row in rows" :key="row.id">
          <td v-if="selectable" class="col-check">
            <input
              type="checkbox"
              :checked="selectedIds.includes(row.id)"
              @change="toggleSelect(row)"
            />
          </td>
          <td v-for="column in columns" :key="column.key">
            <slot :name="column.key" :row="row">
              {{ row[column.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  selectable: { type: Boolean, default: false },
  selectedIds: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:selectedIds', 'selectionChange'])

const isAllSelected = computed(() => {
  if (!props.rows.length) return false
  return props.rows.every((row) => props.selectedIds.includes(row.id))
})

const isIndeterminate = computed(() => {
  if (!props.rows.length) return false
  const selectedCount = props.rows.filter((row) => props.selectedIds.includes(row.id)).length
  return selectedCount > 0 && selectedCount < props.rows.length
})

function toggleSelectAll(e) {
  const checked = e.target.checked
  const newIds = checked ? props.rows.map((row) => row.id) : []
  emit('update:selectedIds', newIds)
  emit('selectionChange', newIds)
}

function toggleSelect(row) {
  let newIds
  if (props.selectedIds.includes(row.id)) {
    newIds = props.selectedIds.filter((id) => id !== row.id)
  } else {
    newIds = [...props.selectedIds, row.id]
  }
  emit('update:selectedIds', newIds)
  emit('selectionChange', newIds)
}
</script>

<style scoped>
.col-check {
  width: 48px;
  text-align: center;
}

.col-check input {
  width: auto;
  min-height: auto;
  cursor: pointer;
}
</style>
