const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/IndexPage.vue') },
      { path: 'info', component: () => import('pages/InfoPage.vue') },
      { path: 'settings', component: () => import('pages/SettingsPage.vue') },
      { path: 'console', component: () => import('pages/ConsolePage.vue') },
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
