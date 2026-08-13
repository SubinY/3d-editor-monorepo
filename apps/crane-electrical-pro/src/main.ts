import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'
import 'virtual:uno.css'
import './styles/theme.css'
import App from './App.vue'
import { router } from './router'
import { createEditor } from '@mh/3d-editor'

document.documentElement.classList.add('dark')

console.info('[crane-electrical-pro] createEditor ready', typeof createEditor)

createApp(App).use(createPinia()).use(router).use(naive).mount('#app')
