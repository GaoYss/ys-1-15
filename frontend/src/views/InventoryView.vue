<template>
  <section>
    <PageHeader eyebrow="Inventory" title="原料库存预警">
      <button class="primary-btn" @click="submitIngredient">保存原料</button>
    </PageHeader>

    <section class="form-panel">
      <div class="form-grid">
        <label>
          原料名称
          <input v-model="form.name" placeholder="如：椰果" />
        </label>
        <label>
          分类
          <input v-model="form.category" placeholder="茶叶 / 小料 / 乳制品" />
        </label>
        <label>
          单位
          <input v-model="form.unit" placeholder="kg / L / 瓶" />
        </label>
        <label>
          当前库存
          <input v-model.number="form.stock" type="number" min="0" />
        </label>
        <label>
          预警线
          <input v-model.number="form.warningThreshold" type="number" min="0" />
        </label>
        <label>
          默认供应商
          <select v-model.number="form.supplierId">
            <option :value="null">未指定</option>
            <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
              {{ supplier.name }}
            </option>
          </select>
        </label>
      </div>
    </section>

    <div class="toolbar">
      <input v-model="keyword" placeholder="搜索原料" @input="loadInventory" />
      <label class="checkbox-line">
        <input v-model="onlyWarning" type="checkbox" @change="loadInventory" />
        只看预警
      </label>
    </div>

    <section class="batch-panel" v-if="selectedIds.length > 0">
      <div class="batch-header">
        <h3>批量调整预警线</h3>
        <span class="selected-count">已选择 {{ selectedIds.length }} 项</span>
      </div>
      <div class="batch-body">
        <div class="adjust-mode">
          <label class="radio-line">
            <input v-model="adjustMode" type="radio" value="set" />
            设为
          </label>
          <label class="radio-line">
            <input v-model="adjustMode" type="radio" value="add" />
            增加
          </label>
          <label class="radio-line">
            <input v-model="adjustMode" type="radio" value="subtract" />
            减少
          </label>
          <label class="radio-line">
            <input v-model="adjustMode" type="radio" value="multiply" />
            乘以
          </label>
        </div>
        <div class="adjust-input">
          <input
            v-model.number="adjustValue"
            type="number"
            :min="adjustMode === 'multiply' ? 0 : 0"
            :step="adjustMode === 'multiply' ? 0.1 : 1"
            placeholder="请输入数值"
          />
          <span v-if="adjustMode === 'multiply'" class="unit-suffix">倍</span>
          <span v-else class="unit-suffix">{{ commonUnit }}</span>
        </div>
        <div class="preview-info" v-if="adjustValue !== null && !isNaN(adjustValue)">
          <div class="preview-stats">
            <div class="stat-item">
              <span class="stat-label">调整后预计：</span>
            </div>
            <div class="stat-item success">
              <span class="stat-label">升级(解除预警)</span>
              <strong class="stat-value">{{ previewResult.upgraded }}</strong>
              <span class="stat-unit">项</span>
            </div>
            <div class="stat-item danger">
              <span class="stat-label">降级(进入预警)</span>
              <strong class="stat-value">{{ previewResult.downgraded }}</strong>
              <span class="stat-unit">项</span>
            </div>
            <div class="stat-item neutral">
              <span class="stat-label">无变化</span>
              <strong class="stat-value">{{ previewResult.unchanged }}</strong>
              <span class="stat-unit">项</span>
            </div>
          </div>
          <div v-if="previewResult.hasNegative" class="error-text">
            ⚠️ 调整后部分原料预警线将为负数，请调整数值
          </div>
        </div>
        <div class="batch-actions">
          <button class="secondary-btn" @click="clearSelection">取消选择</button>
          <button
            class="primary-btn"
            :disabled="!canSubmit"
            @click="submitBatchAdjust"
          >
            应用调整
          </button>
        </div>
      </div>
    </section>

    <DataTable
      :columns="columns"
      :rows="inventory"
      selectable
      v-model:selectedIds="selectedIds"
      @selectionChange="onSelectionChange"
    >
      <template #stock="{ row }">{{ row.stock }} {{ row.unit }}</template>
      <template #warningThreshold="{ row }">{{ row.warningThreshold }} {{ row.unit }}</template>
      <template #warning="{ row }">
        <StatusBadge
          :label="row.warning ? '库存预警' : '正常'"
          :variant="row.warning ? 'danger' : 'success'"
        />
      </template>
    </DataTable>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { inventoryApi } from '../api/inventory'
import DataTable from '../components/DataTable.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { eventBus, EVENTS } from '../utils/eventBus'

const inventory = ref([])
const suppliers = ref([])
const keyword = ref('')
const onlyWarning = ref(false)
const selectedIds = ref([])
const adjustMode = ref('set')
const adjustValue = ref(null)

const form = reactive({
  name: '',
  category: '',
  unit: '',
  stock: 0,
  warningThreshold: 0,
  supplierId: null
})

const columns = [
  { key: 'name', label: '原料' },
  { key: 'category', label: '分类' },
  { key: 'stock', label: '库存' },
  { key: 'warningThreshold', label: '预警线' },
  { key: 'supplierName', label: '供应商' },
  { key: 'warning', label: '状态' }
]

const commonUnit = computed(() => {
  const selected = inventory.value.filter((item) => selectedIds.value.includes(item.id))
  if (selected.length === 0) return ''
  const firstUnit = selected[0].unit
  const allSame = selected.every((item) => item.unit === firstUnit)
  return allSame ? firstUnit : ''
})

const selectedItems = computed(() =>
  inventory.value.filter((item) => selectedIds.value.includes(item.id))
)

const previewResult = computed(() => {
  const items = selectedItems.value
  const val = adjustValue.value

  if (val === null || isNaN(val) || items.length === 0) {
    return { upgraded: 0, downgraded: 0, unchanged: 0, hasNegative: false }
  }

  let upgraded = 0
  let downgraded = 0
  let unchanged = 0
  let hasNegative = false

  for (const item of items) {
    let newThreshold
    switch (adjustMode.value) {
      case 'set':
        newThreshold = val
        break
      case 'add':
        newThreshold = item.warningThreshold + val
        break
      case 'subtract':
        newThreshold = item.warningThreshold - val
        break
      case 'multiply':
        newThreshold = item.warningThreshold * val
        break
      default:
        newThreshold = item.warningThreshold
    }

    newThreshold = Math.round(newThreshold * 100) / 100

    if (newThreshold < 0) {
      hasNegative = true
    }

    const wasWarning = item.stock <= item.warningThreshold
    const willWarning = item.stock <= newThreshold

    if (wasWarning && !willWarning) {
      upgraded++
    } else if (!wasWarning && willWarning) {
      downgraded++
    } else {
      unchanged++
    }
  }

  return { upgraded, downgraded, unchanged, hasNegative }
})

const canSubmit = computed(() => {
  return (
    selectedIds.value.length > 0 &&
    adjustValue.value !== null &&
    !isNaN(adjustValue.value) &&
    adjustValue.value >= 0 &&
    !previewResult.value.hasNegative
  )
})

async function loadInventory() {
  const res = await inventoryApi.list({
    keyword: keyword.value || undefined,
    warning: onlyWarning.value ? 'true' : undefined
  })
  inventory.value = res.data
}

async function loadOptions() {
  const res = await inventoryApi.options()
  suppliers.value = res.data.suppliers
}

async function submitIngredient() {
  if (form.warningThreshold < 0) {
    alert('预警线不能为负数')
    return
  }
  if (form.stock < 0) {
    alert('库存不能为负数')
    return
  }
  await inventoryApi.create({ ...form })
  Object.assign(form, {
    name: '',
    category: '',
    unit: '',
    stock: 0,
    warningThreshold: 0,
    supplierId: null
  })
  await loadInventory()
  eventBus.emit(EVENTS.INVENTORY_UPDATED)
}

function onSelectionChange(ids) {
  selectedIds.value = ids
}

function clearSelection() {
  selectedIds.value = []
  adjustValue.value = null
}

async function submitBatchAdjust() {
  if (!canSubmit.value) return

  const val = adjustValue.value
  const items = selectedItems.value

  const updatePromises = items.map((item) => {
    let newThreshold
    switch (adjustMode.value) {
      case 'set':
        newThreshold = val
        break
      case 'add':
        newThreshold = item.warningThreshold + val
        break
      case 'subtract':
        newThreshold = item.warningThreshold - val
        break
      case 'multiply':
        newThreshold = item.warningThreshold * val
        break
      default:
        newThreshold = item.warningThreshold
    }
    newThreshold = Math.round(newThreshold * 100) / 100

    if (newThreshold < 0) {
      throw new Error(`${item.name} 预警线不能为负数`)
    }

    return inventoryApi.update(item.id, { warningThreshold: newThreshold })
  })

  try {
    await Promise.all(updatePromises)
    alert(
      `调整成功！\n升级(解除预警)：${previewResult.value.upgraded} 项\n降级(进入预警)：${previewResult.value.downgraded} 项\n无变化：${previewResult.value.unchanged} 项`
    )
    clearSelection()
    await loadInventory()
    eventBus.emit(EVENTS.INVENTORY_UPDATED)
  } catch (err) {
    const message = err?.response?.data?.error || err.message || '调整失败'
    alert(message)
  }
}

watch(
  () => [adjustMode.value, adjustValue.value],
  () => {
    if (adjustValue.value !== null && isNaN(adjustValue.value)) {
      adjustValue.value = null
    }
  }
)

onMounted(async () => {
  await Promise.all([loadInventory(), loadOptions()])
})
</script>

<style scoped>
.batch-panel {
  border: 1px solid #dde5dc;
  border-radius: 8px;
  background: #fff;
  padding: 18px;
  margin-bottom: 18px;
}

.batch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.batch-header h3 {
  margin: 0;
  font-size: 16px;
  color: #223029;
}

.selected-count {
  color: #6b786f;
  font-size: 13px;
}

.batch-body {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  gap: 14px;
  align-items: start;
}

.adjust-mode {
  display: flex;
  gap: 10px;
  align-items: center;
}

.radio-line {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #526057;
  font-size: 14px;
  white-space: nowrap;
  cursor: pointer;
}

.radio-line input {
  width: auto;
  min-height: auto;
  cursor: pointer;
}

.adjust-input {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 180px;
}

.adjust-input input {
  flex: 1;
}

.unit-suffix {
  color: #6b786f;
  font-size: 14px;
  white-space: nowrap;
}

.preview-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-stats {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-label {
  color: #6b786f;
  font-size: 13px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
}

.stat-unit {
  color: #6b786f;
  font-size: 12px;
}

.stat-item.success .stat-value {
  color: #17713d;
}

.stat-item.danger .stat-value {
  color: #a72f25;
}

.stat-item.neutral .stat-value {
  color: #4f5a61;
}

.batch-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

@media (max-width: 900px) {
  .batch-body {
    grid-template-columns: 1fr;
  }

  .adjust-mode {
    flex-wrap: wrap;
  }

  .batch-actions {
    justify-content: stretch;
  }

  .batch-actions button {
    flex: 1;
  }
}
</style>
