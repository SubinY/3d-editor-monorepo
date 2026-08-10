import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/manage/rooms' },
    {
      path: '/manage',
      component: () => import('@/views/manage/ManageLayout.vue'),
      children: [
        { path: '', redirect: '/manage/rooms' },
        {
          path: 'rooms',
          name: 'manage-rooms',
          component: () => import('@/views/manage/RoomsManage.vue')
        },
        {
          path: 'cabinets',
          name: 'manage-cabinets',
          component: () => import('@/views/manage/CabinetsManage.vue')
        },
        {
          path: 'model-lab',
          name: 'manage-model-lab',
          component: () => import('@/views/manage/ModelLab.vue')
        }
      ]
    },
    {
      path: '/home',
      name: 'dashboard-home',
      component: () => import('@/views/DashboardHome.vue')
    },
    {
      path: '/edit/:kind(scene|container)/:id',
      name: 'editor',
      component: () => import('@/views/EditorView.vue')
    },
    {
      path: '/preview/:id?',
      name: 'preview',
      component: () => import('@/views/Preview.vue')
    },
    {
      path: '/ux-demo',
      name: 'ux-demo',
      component: () => import('@/views/UxDemoView.vue')
    },
    { path: '/:pathMatch(.*)*', redirect: '/manage/rooms' }
  ]
})
