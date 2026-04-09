import { NofoElement } from "../../index.js";

class NofoAspectRatio extends NofoElement {
  static props = {
    ratio: "16/9",
  };

  parseRatio(ratioString) {
    if (!ratioString) return { width: 16, height: 9 };

    const parts = ratioString.split("/");
    if (parts.length !== 2) return { width: 16, height: 9 };

    const width = parseFloat(parts[0]);
    const height = parseFloat(parts[1]);

    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      return { width: 16, height: 9 };
    }

    return { width, height };
  }

  template() {
    const { width, height } = this.parseRatio(this.state.ratio);
    const paddingBottom = (height / width) * 100;

    return `
      <div class="aspect-ratio-container" style="padding-bottom: ${paddingBottom}%">
        <div class="aspect-ratio-content">
          <slot></slot>
        </div>
      </div>
    `;
  }

  styles() {
    return `
      .aspect-ratio-container {
        position: relative;
        width: 100%;
      }
      
      .aspect-ratio-content {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
    `;
  }
}

customElements.define("nofo-aspect-ratio", NofoAspectRatio);
export { NofoAspectRatio };
