import { NofoElement } from "../../index.js";

class NofoLoadingOverlay extends NofoElement {
  static props = {
    loading: { type: Boolean, default: false },
  };

  onMount() {
    this.updateDataAttributes();
  }

  onUpdate() {
    this.updateDataAttributes();
  }

  updateDataAttributes() {
    this.setAttribute("data-loading", this.props.loading ? "true" : "false");
  }

  template() {
    const isLoading = this.props.loading;
    return `
      <div class="content">
        <slot></slot>
      </div>
      <div class="overlay" style="display: ${isLoading ? "flex" : "none"}">
        <nofo-spinner size="3"></nofo-spinner>
      </div>
    `;
  }

  styles() {
    const isLoading = this.props.loading;
    return `
      :host {
        position: relative;
        width: 100%;
        box-sizing: border-box;
      }
      .overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(2px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
      }
      .content {
        opacity: ${isLoading ? "0.5" : "1"};
        transition: opacity 0.2s;
      }
    `;
  }
}

customElements.define("nofo-loading-overlay", NofoLoadingOverlay);
export { NofoLoadingOverlay };
