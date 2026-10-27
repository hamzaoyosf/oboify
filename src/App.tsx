import React from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppProviders } from './app/providers/AppProviders'
import { router } from './app/router'

export const App: React.FC = () => {
  return (
    <AppProviders>
      <RouterProvider router={router} />
      <Toaster theme="dark" position="bottom-right" />
    </AppProviders>
  )
}

export default App
