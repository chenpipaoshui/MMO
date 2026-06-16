<script setup lang="ts">
import { ref, watch } from 'vue'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  initialColor: string
}>()

const emit = defineEmits<{
  confirm: [color: string]
}>()

const draftColor = ref('#3b82f6')
const hexInput = ref('')

watch(
  () => [open.value, props.initialColor] as const,
  ([isOpen, color]) => {
    if (!isOpen) return
    draftColor.value = color
    hexInput.value = color
  },
)

function syncFromPicker(event: Event) {
  const value = (event.target as HTMLInputElement).value
  draftColor.value = value
  hexInput.value = value
}

function syncFromHex() {
  const raw = hexInput.value.trim()
  const normalized = raw.startsWith('#') ? raw : `#${raw}`
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    draftColor.value = normalized
    hexInput.value = normalized
  }
}

function confirm() {
  emit('confirm', draftColor.value)
  open.value = false
}

function cancel() {
  open.value = false
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      @click.self="cancel"
    >
      <div class="w-full max-w-xs rounded-xl bg-white p-5 shadow-xl" @click.stop>
        <h3 class="text-sm font-semibold text-slate-800">自定义颜色</h3>
        <p class="mt-1 text-xs text-slate-500">选择颜色后点击确认，将加入线段颜色选择区</p>

        <div class="mt-4 flex items-center gap-3">
          <input
            type="color"
            class="h-12 w-12 cursor-pointer rounded-lg border border-slate-200 bg-transparent p-0.5"
            :value="draftColor"
            @input="syncFromPicker"
          />
          <div class="flex-1">
            <label class="mb-1 block text-xs text-slate-500">十六进制</label>
            <input
              v-model="hexInput"
              type="text"
              maxlength="7"
              placeholder="#3b82f6"
              class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              @change="syncFromHex"
              @keyup.enter="confirm"
            />
          </div>
        </div>

        <div
          class="mt-4 flex h-10 items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-600"
          :style="{ backgroundColor: draftColor, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }"
        >
          预览
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            @click="cancel"
          >
            取消
          </button>
          <button
            type="button"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            @click="confirm"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
