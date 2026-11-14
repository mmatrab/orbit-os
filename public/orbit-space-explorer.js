/*!
 * <orbit-space-explorer> — framework-agnostic embed for the ORBIT OS Space Explorer module.
 *
 * Usage (any host page, any framework):
 *   <script src="https://explorer.example.org/orbit-space-explorer.js" defer></script>
 *   <orbit-space-explorer target="TRAPPIST-1 e" height="900px"></orbit-space-explorer>
 *
 * Attributes: target (archive planet name), height (CSS length, default 900px), src (module URL override)
 * Method:     element.selectTarget('51 Peg b')
 * Events:     'orbit-ready' and 'orbit-target-selected' (event.detail.planetName)
 *
 * The UI runs in an iframe, so the host's CSS, JavaScript framework and the module never interfere.
 */
(() => {
  if (customElements.get('orbit-space-explorer')) return;

  const SOURCE = 'orbit-space-explorer';
  // Module base URL = directory this script was loaded from.
  const scriptUrl = document.currentScript && document.currentScript.src;
  const defaultBase = scriptUrl ? new URL('./', scriptUrl).toString() : null;

  class OrbitSpaceExplorer extends HTMLElement {
    static get observedAttributes() {
      return ['target', 'height'];
    }

    constructor() {
      super();
      this._ready = false;
      this._iframe = null;
      this._moduleOrigin = null;
      this._pendingTarget = null;
      this._onMessage = this._onMessage.bind(this);
    }

    connectedCallback() {
      if (this._iframe) return;
      const base = this.getAttribute('src') || defaultBase;
      if (!base) {
        console.error('[orbit-space-explorer] Cannot determine module URL; set the "src" attribute.');
        return;
      }
      const url = new URL(base, window.location.href);
      if (!url.pathname.endsWith('/')) url.pathname += '/';
      url.searchParams.set('parentOrigin', window.location.origin);
      const target = this.getAttribute('target');
      if (target) url.searchParams.set('target', target);
      this._moduleOrigin = url.origin;

      const root = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = ':host{display:block}iframe{display:block;width:100%;border:0}';
      const iframe = document.createElement('iframe');
      iframe.src = url.toString();
      iframe.title = 'ORBIT OS Space Explorer';
      iframe.allow = 'fullscreen';
      iframe.style.height = this.getAttribute('height') || '900px';
      root.append(style, iframe);
      this._iframe = iframe;
      window.addEventListener('message', this._onMessage);
    }

    disconnectedCallback() {
      window.removeEventListener('message', this._onMessage);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (!this._iframe || oldValue === newValue) return;
      if (name === 'height') this._iframe.style.height = newValue || '900px';
      if (name === 'target' && newValue) this.selectTarget(newValue);
    }

    /** Ask the embedded module to open a planet (archive pl_name, e.g. "TRAPPIST-1 e"). */
    selectTarget(planetName) {
      if (!this._iframe || typeof planetName !== 'string') return;
      if (!this._ready) {
        // Delivered as soon as the module reports it is ready.
        this._pendingTarget = planetName;
        return;
      }
      this._iframe.contentWindow.postMessage(
        { source: SOURCE, type: 'select-target', payload: { planetName } },
        this._moduleOrigin
      );
    }

    _onMessage(event) {
      if (!this._iframe || event.source !== this._iframe.contentWindow) return;
      if (event.origin !== this._moduleOrigin) return;
      const data = event.data;
      if (!data || data.source !== SOURCE) return;
      if (data.type === 'ready') {
        this._ready = true;
        this.dispatchEvent(new CustomEvent('orbit-ready', { detail: data.payload, bubbles: true }));
        if (this._pendingTarget) {
          const pending = this._pendingTarget;
          this._pendingTarget = null;
          this.selectTarget(pending);
        }
      } else if (data.type === 'target-selected') {
        this.dispatchEvent(
          new CustomEvent('orbit-target-selected', { detail: data.payload, bubbles: true })
        );
      }
    }
  }

  customElements.define('orbit-space-explorer', OrbitSpaceExplorer);
})();
