import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIResizable extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: flex;
          width: 100%;
          height: 100%;
          position: relative;
        }
        
        .resizable-container {
          display: flex;
          width: 100%;
          height: 100%;
        }
      </style>
      <div class="resizable-container">
        <slot></slot>
      </div>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

class NofoUIResizablePanel extends NofoElement {
  static props() {
    return {
      defaultSize: { type: Number, attribute: "defaultSize" },
      minSize: { type: Number, attribute: "minSize" },
      maxSize: { type: Number, attribute: "maxSize" },
    };
  }

  static template() {
    const minSize = this.minSize || 10;
    const maxSize = this.maxSize || 90;

    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: block;
          overflow: auto;
          min-width: ${minSize}%;
          max-width: ${maxSize}%;
        }
        
        .panel {
          width: 100%;
          height: 100%;
          padding: var(--nofo-ui-spacing-lg);
        }
      </style>
      <div class="panel">
        <slot></slot>
      </div>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {
    this._panel = this.shadowRoot.querySelector(".panel");
    this.sync();
  }

  sync() {
    if (this._panel) {
      const defaultSize = this.defaultSize || 50;
      this._panel.style.flex = `0 0 ${defaultSize}%`;
    }
  }
}

class NofoUIResizableHandle extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: block;
          width: 0.5rem;
          background-color: var(--nofo-ui-border);
          cursor: col-resize;
          transition: background-color 0.2s ease;
          flex-shrink: 0;
        }
        
        :host(:hover) {
          background-color: var(--nofo-ui-accent-primary);
        }
        
        .handle {
          width: 100%;
          height: 100%;
        }
      </style>
      <div class="handle"></div>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {
    this._isDragging = false;

    this.handleDrag = (e) => {
      if (!this._isDragging) return;

      const resizable = this.closest("nofo-ui-resizable");
      if (!resizable) return;

      const panels = resizable.querySelectorAll("nofo-ui-resizable-panel");
    };

    this.handleDragEnd = () => {
      this._isDragging = false;
      document.removeEventListener("mousemove", this.handleDrag);
      document.removeEventListener("mouseup", this.handleDragEnd);
    };

    this.addEventListener("mousedown", (e) => {
      this._isDragging = true;
      document.addEventListener("mousemove", this.handleDrag);
      document.addEventListener("mouseup", this.handleDragEnd);
    });
  }
}

customElements.define("nofo-ui-resizable", NofoUIResizable);
customElements.define("nofo-ui-resizable-panel", NofoUIResizablePanel);
customElements.define("nofo-ui-resizable-handle", NofoUIResizableHandle);
