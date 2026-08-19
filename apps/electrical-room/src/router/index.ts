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
          path: 'sources',
          name: 'manage-sources',
          component: () => import('@/views/manage/SourcesManage.vue')
        }
      ]
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
      path: '/published/:sceneId/:version',
      name: 'published',
      component: () => import('@/views/PublishedView.vue')
    },
    { path: '/:pathMatch(.*)*', redirect: '/manage/rooms' }
  ]
})
