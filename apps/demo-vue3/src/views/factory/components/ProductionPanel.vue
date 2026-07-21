<template>
  <div class="panel-content">
    <div class="stat-boxes">
      <div class="stat-box">
        <div class="stat-value">110</div>
        <div class="stat-label">
          <Icon icon="mdi:chevron-double-right" class="label-icon" />
          加工总数
          <Icon icon="mdi:chevron-double-left" class="label-icon" />
        </div>
      </div>
      <div class="stat-box">
        <div class="stat-value secondary">23</div>
        <div class="stat-label">
          <Icon icon="mdi:chevron-double-right" class="label-icon" />
          当日加工数
          <Icon icon="mdi:chevron-double-left" class="label-icon" />
        </div>
      </div>
    </div>

    <div class="chart-container">
      <div ref="chartRef" class="main-chart"></div>
      <div class="chart-overlay">
        <div class="beat-item">
          <span class="beat-dot"></span>
          当前节拍 <span class="beat-value highlight">31</span> <span class="unit">件/h</span>
        </div>
        <div class="beat-item">
          <span class="beat-dot"></span>
          平均节拍 <span class="beat-value">23</span> <span class="unit">件/h</span>
        </div>
      </div>
    </div>
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
    series: [
      {
        type: 'pie',
        radius: ['65%', '85%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: { disabled: true },
        data: [
          { 
            value: 31, 
            itemStyle: { 
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#4da3ff' },
                { offset: 1, color: '#1a56b3' }
              ]),
              borderRadius: 10
            } 
          },
          { value: 10, itemStyle: { color: 'rgba(77, 163, 255, 0.1)' } }
        ]
      },
      {
        type: 'gauge',
        center: ['50%', '50%'],
        radius: '55%',
        startAngle: 90,
        endAngle: -270,
        pointer: { show: false },
        axisLine: {
          lineStyle: {
            width: 2,
            color: [[1, 'rgba(77, 163, 255, 0.3)']]
          }
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: { show: false }
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

.stat-boxes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.stat-box {
  background: rgba(77, 163, 255, 0.05);
  border: 1px solid rgba(77, 163, 255, 0.15);
  padding: 10px;
  text-align: center;
  border-radius: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #ffcc00;
  margin-bottom: 4px;
}

.stat-value.secondary {
  color: #4da3ff;
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.label-icon {
  font-size: 10px;
  opacity: 0.5;
}

.chart-container {
  position: relative;
  flex: 1;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.main-chart {
  width: 100%;
  height: 100%;
}

.chart-overlay {
  position: absolute;
  right: 10%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.beat-item {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  gap: 8px;
}

.beat-dot {
  width: 6px;
  height: 6px;
  background: #4da3ff;
  border-radius: 50%;
  box-shadow: 0 0 8px #4da3ff;
}

.beat-value {
  font-size: 18px;
  font-weight: bold;
  color: #fff;
  margin-left: 4px;
}

.beat-value.highlight {
  color: #4da3ff;
}

.unit {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
}
</style>
