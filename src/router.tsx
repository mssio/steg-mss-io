import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { HowItWorks } from '@/pages/HowItWorks'
import { NotFound } from '@/pages/NotFound'
import { Studio } from '@/pages/Studio'

export const router = createBrowserRouter([
  {
    Component: AppShell,
    children: [
      { path: '/', element: <Studio mode="hide" /> },
      { path: '/reveal', element: <Studio mode="reveal" /> },
      { path: '/how-it-works', Component: HowItWorks },
      { path: '*', Component: NotFound },
    ],
  },
])
