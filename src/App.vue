<script setup lang="ts">
import CanvasBoard from './components/CanvasBoard.vue'
import LineList from './components/LineList.vue'
import ScalePanel from './components/ScalePanel.vue'
import Toolbar from './components/Toolbar.vue'
</script>

<template>
  <div class="flex h-screen flex-col bg-slate-100">
    <Toolbar />
    <div class="flex min-h-0 flex-1">
      <main class="min-w-0 flex-1">
        <CanvasBoard />
      </main>
      <aside class="flex w-80 shrink-0 flex-col gap-4 border-l border-slate-200 bg-slate-50 p-4">
        <ScalePanel />
        <LineList />
      </aside>
    </div>
  </div>
</template>
