// Registers open shadow web component for the demo
class OpenShadowCard extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; }
        .inner { padding: 12px; background: #ecfdf5; border-radius: 8px; border: 1px solid #6ee7b7; }
      </style>
      <div class="inner" id="shadow-inner">Open shadow content</div>
    `;
  }
}
customElements.define('open-shadow-card', OpenShadowCard);
