import { NofoElement } from "../../index.js";

class NofoProgress extends NofoElement {
  static props = {
    value: null,
    max: 100,
    size: "2",
    variant: "solid",
    color: "accent",
    "high-contrast": false,
    duration: "0s",
  };

  onMount() {
    this.sync()
      .attr("size")
      .toDataAttr("size")
      .attr("variant")
      .toDataAttr("variant")
      .attr("color")
      .toDataAttr("color")
      .attr("high-contrast")
      .toDataAttr("high-contrast");
  }

  template() {
    const { value, max, duration } = this.state;
    const isIndeterminate = value === null;
    const percentage = isIndeterminate ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

    return `
      <div class="progress-track">
        <div class="progress-indicator" style="width: ${isIndeterminate ? "30%" : percentage + "%"}; transition: width ${duration} ease;"></div>
      </div>
      <slot></slot>
    `;
  }

  styles() {
    return `
      :host {
        display: block;
        box-sizing: border-box;
        width: 100%;
      }

      .progress-track {
        width: 100%;
        background-color: var(--gray-6);
        border-radius: 9999px;
        overflow: hidden;
        position: relative;
      }

      /* Sizes */
      :host([data-size="1"]) .progress-track { height: 0.25rem; }
      :host([data-size="2"]) .progress-track { height: 0.5rem; }
      :host([data-size="3"]) .progress-track { height: 0.75rem; }

      .progress-indicator {
        height: 100%;
        background-color: var(--accent-9);
        border-radius: 9999px;
      }

      :host([value="null"]) .progress-indicator {
        animation: progress-indeterminate 1.5s ease-in-out infinite;
      }

      @keyframes progress-indeterminate {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(400%); }
      }
    `;
  }
}

class NofoProgressIndicator extends NofoElement {
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `:host { display: contents; }`;
  }
}

customElements.define("nofo-progress", NofoProgress);
customElements.define("nofo-progress-indicator", NofoProgressIndicator);

export { NofoProgress, NofoProgressIndicator };
