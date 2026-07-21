<template>
  <div class="panel-content">
    <div class="usage-stats">
      <div class="usage-item">
        <div class="usage-header">月耗电</div>
        <div class="usage-body">
          <span class="value">153</span>
          <span class="unit">kWh</span>
          <Icon icon="mdi:lightning-bolt" class="usage-icon power" />
        </div>
      </div>
      <div class="usage-item">
        <div class="usage-header">月耗水</div>
        <div class="usage-body">
          <span class="value">67</span>
          <span class="unit">t</span>
          <Icon icon="mdi:water-percent" class="usage-icon water" />
        </div>
      </div>
    </div>

    <div ref="chartRef" class="usage-chart"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as echarts from 'echarts'
import { Icon } from '@iconify/vue'

const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

onMounted(() => {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  
  const option = {
    backgroundColor: 'transparent',
    grid: { left: '10%', right: '5%', top: '10%', bottom: '15%' },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['1', '2', '3', '4', '5', '6'],
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10 }
    },
    series: [
      {
        name: '耗电',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: [40, 60, 45, 80, 55, 70],
        itemStyle: { color: '#ffcc00' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255, 204, 0, 0.2)' },
            { offset: 1, color: 'transparent' }
          ])
        }
      },
      {
        name: '耗水',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: [20, 35, 25, 45, 30, 40],
        itemStyle: { color: '#4da3ff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(77, 163, 255, 0.2)' },
            { offset: 1, color: 'transparent' }
          ])
        }
      }
    ]
  }
  
  chart.setOption(option)
})

onBeforeUnmount(() => {
  chart?.dispose()
})
</script>

<style scoped>
.panel-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
  height: 100%;
}

.usage-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.usage-item {
  position: relative;
  background: rgba(255, 255, 255, 0.03);
  padding: 12px;
  border-radius: 4px;
}

.usage-header {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8px;
}

.usage-body {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.value {
  font-size: 22px;
  font-weight: bold;
  color: #fff;
}

.unit {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
}

.usage-icon {
  position: absolute;
  right: 10px;
  bottom: 10px;
  font-size: 20px;
  opacity: 0.6;
}

.usage-icon.power { color: #ffcc00; }
.usage-icon.water { color: #4da3ff; }

.usage-chart {
  flex: 1;
  min-height: 120px;
}
</style>
