import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyStorageGuard } from './utils/storageGuard';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root not found');
const root = ReactDOM.createRoot(rootElement);

applyStorageGuard();

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
