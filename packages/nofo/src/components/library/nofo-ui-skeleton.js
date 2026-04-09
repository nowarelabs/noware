import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUISkeleton extends NofoElement {
  static props = {
    width: "100%",
    height: "1rem",
  };

  template() {
    return `<nofo-skeleton></nofo-skeleton>`;
  }

  styles() {
    return `
      ${nofoUIStyles}
      
      :host {
        display: block;
      }
      
      nofo-skeleton {
        display: block;
        width: var(--skeleton-width, 100%);
        height: var(--skeleton-height, 1rem);
        background-color: var(--nofo-ui-background-secondary);
        border-radius: var(--nofo-ui-radius);
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
      
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }
    `;
  }

  onMount() {
    this.updateSkeletonStyles();
  }

  onUpdate() {
    this.updateSkeletonStyles();
  }

  updateSkeletonStyles() {
    const skeleton = this.shadowRoot.querySelector("nofo-skeleton");
    if (skeleton) {
      skeleton.style.setProperty("--skeleton-width", this.state.width);
      skeleton.style.setProperty("--skeleton-height", this.state.height);
    }
  }
}

customElements.define("nofo-ui-skeleton", NofoUISkeleton);
export { NofoUISkeleton };
