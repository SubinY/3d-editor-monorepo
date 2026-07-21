import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { bootstrapSeedResources } from './services/seed-resource-service'

async function startApp() {
  try {
    await bootstrapSeedResources()
  } catch (error) {
    console.warn('初始化种子资源失败，已跳过自动导入。', error)
  }

  const app = createApp(App)
  app.use(router)
  app.mount('#app')
}

void startApp()
