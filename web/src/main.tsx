import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from './api/client'
import { AuthProvider } from './auth/AuthProvider'
import { AccountProvider } from './auth/AccountProvider'
import { App } from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Não insiste em erros da API (4xx): só em falhas de rede/servidor
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      refetchOnWindowFocus: true,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AccountProvider>
            <App />
          </AccountProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
