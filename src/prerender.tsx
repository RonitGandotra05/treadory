// Build-time HTML only. This module is never shipped as a runtime server.
import { renderToString } from 'react-dom/server';
import App from './App';
export function render() { return renderToString(<App />); }
