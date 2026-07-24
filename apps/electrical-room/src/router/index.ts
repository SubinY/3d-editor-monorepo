import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/Home.vue') },
    {
      path: '/edit/:kind(scene|container)/:id',
      name: 'editor',
      component: () => import('@/views/EditorView.vue')
    },
    { path: '/preview/:id?', name: 'preview', component: () => import('@/views/Preview.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
