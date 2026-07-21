import { createRouter, createWebHistory } from 'vue-router'
import FactoryEditor from '../views/factory/FactoryEditor.vue'
import Editor from '../views/Editor.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/factory'
    },
    {
      path: '/factory',
      name: 'factory',
      component: FactoryEditor
    },
    {
      path: '/editor',
      name: 'editor',
      component: Editor
    }
  ]
})

export default router

