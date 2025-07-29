const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/IndexPage.vue') },
      { path: 'plan', component: () => import('src/pages/PlanPage.vue') },
      { path: 'settings', component: () => import('pages/SettingsPage.vue') },
      { path: 'log', component: () => import('src/pages/LogPage.vue') },
      { path: 'test', component: () => import('pages/TestPage.vue') }
    ],
  },

  // Catch-all route (404)
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
