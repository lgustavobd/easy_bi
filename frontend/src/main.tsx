import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ConfirmProvider } from './components/ConfirmDialog';
import './styles/globals.css';
import './styles/dataset-ui-overrides.css';
import './styles/dashboard-ui-overrides.css';
import './styles/template-metrics-overrides.css';

const queryClient = new QueryClient();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <BrowserRouter><App /></BrowserRouter>
      </ConfirmProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
