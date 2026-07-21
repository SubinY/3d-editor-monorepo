import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/asset-library'
    },
    {
      path: '/asset-library',
      name: 'asset-library',
      component: () => import('../views/asset-library/AssetLibrary.vue')
    },
    {
      path: '/asset-editor',
      name: 'asset-editor',
      component: () => import('../views/asset-editor/AssetEditor.vue')
    },
    {
      path: '/scene-editor',
      name: 'scene-editor',
      component: () => import('../views/scene-editor/SceneEditor.vue')
    },
    {
      path: '/scene-viewer',
      name: 'scene-viewer',
      component: () => import('../views/scene-viewer/SceneViewer.vue')
    },
    {
      path: '/asset-viewer',
      name: 'asset-viewer',
      component: () => import('../views/asset-viewer/AssetViewer.vue')
    }
  ]
})

export default router
