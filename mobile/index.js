import DOMException from 'node-domexception';

if (typeof global.DOMException === 'undefined') {
  global.DOMException = DOMException;
  if (typeof globalThis !== 'undefined') {
    globalThis.DOMException = DOMException;
  }
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
