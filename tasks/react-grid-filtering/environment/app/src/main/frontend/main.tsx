import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import CustomerListView from './CustomerListView';
import './styles.css';

const router = createBrowserRouter([{ path: '/', element: <CustomerListView /> }]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
