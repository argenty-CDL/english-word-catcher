import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from './App';
// `?inline` returns the compiled Tailwind CSS as a string so we can inject it
// INTO the shadow root. Document-level styles never reach a shadow tree, which
// is exactly why the host page's CSS and ours stay isolated from each other.
import styles from './index.css?inline';

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;600;700&display=swap';

// Web fonts must be registered at the document level — a <canvas> renders text
// with document-registered fonts, not fonts declared inside a shadow root.
function ensureFontsLoaded() {
  if (document.querySelector('link[data-word-catcher-fonts]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  link.setAttribute('data-word-catcher-fonts', '');
  document.head.appendChild(link);
}

class WordCatcherElement extends HTMLElement {
  private root?: Root;

  connectedCallback() {
    ensureFontsLoaded();

    const shadow = this.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    shadow.appendChild(styleEl);

    const mount = document.createElement('div');
    mount.style.height = '100%';
    shadow.appendChild(mount);

    this.root = createRoot(mount);
    this.root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = undefined;
  }
}

if (!customElements.get('word-catcher')) {
  customElements.define('word-catcher', WordCatcherElement);
}
