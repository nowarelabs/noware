import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIScrollArea extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: block;
          width: 100%;
        }
        
        nofo-scroll-area {
          display: block;
          width: 100%;
          overflow: hidden;
        }
        
        nofo-scroll-area-viewport {
          width: 100%;
          height: 100%;
        }
        
        nofo-scroll-area-scrollbar {
          display: flex;
          touch-action: none;
          user-select: none;
        }
        
        nofo-scroll-area-thumb {
          flex: 1;
          background-color: var(--nofo-ui-border);
          border-radius: var(--nofo-ui-radius);
          transition: background-color 0.2s ease;
        }
        
        nofo-scroll-area-thumb:hover {
          background-color: var(--nofo-ui-foreground-tertiary);
        }
      </style>
      <nofo-scroll-area>
        <slot></slot>
      </nofo-scroll-area>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

customElements.define("nofo-ui-scroll-area", NofoUIScrollArea);
