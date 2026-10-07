import { Navigate, type RouteObject } from 'react-router';
import ContactView from './views/ContactView';
import AboutView from './views/AboutView';

/**
 * The application's routes.
 */
export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/contact" replace /> },
  { path: '/contact', element: <ContactView /> },
  { path: '/about', element: <AboutView /> },
];
