import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { router } from './routes';
import './style.css';

const root=document.getElementById('root');
if(!root)throw new Error('Корневой элемент приложения отсутствует.');
createRoot(root).render(<StrictMode><RouterProvider router={router}/></StrictMode>);
