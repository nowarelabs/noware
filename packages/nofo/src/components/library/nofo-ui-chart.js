import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIChart extends NofoElement {
  static props = {
    type: "line",
    data: "[]",
    options: null,
  };

  onMount() {
    this.sync()
      .attr("type")
      .toDataAttr("type")
      .attr("data")
      .toDataAttr("data")
      .attr("options")
      .toDataAttr("options");
  }

  template() {
    const type = this.state.type || "line";

    return `
      <div class="chart-container">
        <div class="chart-placeholder">
          Chart: ${type} (Integrate with Chart.js/Recharts/D3.js)
        </div>
        <canvas></canvas>
        <slot></slot>
      </div>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      
      .chart-container {
        position: relative;
        width: 100%;
        height: 300px;
        padding: var(--nofo-ui-spacing-lg);
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
      }
      
      canvas {
        width: 100%;
        height: 100%;
      }
      
      .chart-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        color: var(--nofo-ui-foreground-secondary);
        font-size: var(--nofo-ui-font-size-sm);
      }
    `;
  }
}

customElements.define("nofo-ui-chart", NofoUIChart);
export { NofoUIChart };
