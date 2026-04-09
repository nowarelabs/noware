import { NofoElement } from "../../index.js";

class NofoSlider extends NofoElement {
  static props = {
    value: [50],
    defaultValue: [50],
    min: 0,
    max: 100,
    step: 1,
    minStepsBetweenThumbs: 0,
    size: "2",
    variant: "solid",
    color: "accent",
    "high-contrast": false,
    disabled: false,
    orientation: "horizontal",
    inverted: false,
  };

  onMount() {
    this.sync()
      .attr("size")
      .toDataAttr("size")
      .attr("variant")
      .toDataAttr("variant")
      .attr("color")
      .toDataAttr("color")
      .attr("disabled")
      .toDataAttr("disabled")
      .attr("high-contrast")
      .toDataAttr("high-contrast");

    this._isDragging = false;
    this._activeThumb = null;

    this.effect(["value"], () => {
      this.updateUI();
    });

    this.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this._onMouseMove = this.handleMouseMove.bind(this);
    this._onMouseUp = this.handleMouseUp.bind(this);
    document.addEventListener("mousemove", this._onMouseMove);
    document.addEventListener("mouseup", this._onMouseUp);
  }

  onUnmount() {
    document.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("mouseup", this._onMouseUp);
  }

  handleMouseDown(e) {
    if (this.state.disabled) return;

    const thumb = e.target.closest(".slider-thumb");
    if (thumb) {
      this._isDragging = true;
      this._activeThumb = parseInt(thumb.dataset.index);
      e.preventDefault();
      return;
    }

    const track = this.shadowRoot.querySelector(".slider-track");
    if (e.target.closest(".slider-track")) {
      this.updateValueFromCoords(e.clientX, e.clientY);
      this._isDragging = true;
    }
  }

  handleMouseMove(e) {
    if (!this._isDragging) return;
    this.updateValueFromCoords(e.clientX, e.clientY);
  }

  handleMouseUp() {
    this._isDragging = false;
    this._activeThumb = null;
  }

  updateValueFromCoords(clientX, clientY) {
    const track = this.shadowRoot.querySelector(".slider-track");
    const rect = track.getBoundingClientRect();
    const { min, max, step, orientation, inverted } = this.state;

    let percentage;
    if (orientation === "vertical") {
      percentage = (clientY - rect.top) / rect.height;
      if (!inverted) percentage = 1 - percentage;
    } else {
      percentage = (clientX - rect.left) / rect.width;
      if (inverted) percentage = 1 - percentage;
    }

    percentage = Math.max(0, Math.min(1, percentage));
    let newValue = min + (max - min) * percentage;
    newValue = Math.round(newValue / step) * step;
    newValue = Math.max(min, Math.min(max, newValue));

    const currentValues = [...this.state.value];

    if (this._activeThumb === null) {
      let closestIdx = 0;
      let minDiff = Math.abs(currentValues[0] - newValue);
      currentValues.forEach((v, i) => {
        const diff = Math.abs(v - newValue);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      });
      this._activeThumb = closestIdx;
    }

    if (currentValues[this._activeThumb] !== newValue) {
      currentValues[this._activeThumb] = newValue;
      currentValues.sort((a, b) => a - b);
      this._activeThumb = currentValues.indexOf(newValue);

      this.state.value = currentValues;
      this.dispatchEvent(
        new CustomEvent("value-change", {
          detail: { value: currentValues },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  updateUI() {
    const { min, max, value, orientation, inverted } = this.state;
    const range = this.shadowRoot.querySelector(".slider-range");
    const thumbs = this.shadowRoot.querySelectorAll(".slider-thumb");

    if (value.length === 1) {
      const percent = ((value[0] - min) / (max - min)) * 100;
      if (orientation === "vertical") {
        range.style.bottom = "0";
        range.style.height = `${percent}%`;
        range.style.left = "0";
        range.style.right = "0";
        thumbs[0].style.bottom = `${percent}%`;
        thumbs[0].style.left = "50%";
      } else {
        range.style.left = "0";
        range.style.width = `${percent}%`;
        range.style.top = "0";
        range.style.bottom = "0";
        thumbs[0].style.left = `${percent}%`;
        thumbs[0].style.top = "50%";
      }
    } else {
      const minVal = Math.min(...value);
      const maxVal = Math.max(...value);
      const startPercent = ((minVal - min) / (max - min)) * 100;
      const endPercent = ((maxVal - min) / (max - min)) * 100;

      if (orientation === "vertical") {
        range.style.bottom = `${startPercent}%`;
        range.style.height = `${endPercent - startPercent}%`;
        value.forEach((v, i) => {
          const p = ((v - min) / (max - min)) * 100;
          thumbs[i].style.bottom = `${p}%`;
          thumbs[i].style.left = "50%";
        });
      } else {
        range.style.left = `${startPercent}%`;
        range.style.width = `${endPercent - startPercent}%`;
        value.forEach((v, i) => {
          const p = ((v - min) / (max - min)) * 100;
          thumbs[i].style.left = `${p}%`;
          thumbs[i].style.top = "50%";
        });
      }
    }
  }

  template() {
    const { value } = this.state;
    return `
      <div class="slider-track">
        <div class="slider-range"></div>
        ${value.map((_, i) => `<div class="slider-thumb" data-index="${i}"></div>`).join("")}
      </div>
      <slot></slot>
    `;
  }

  styles() {
    const { size, color, orientation } = this.state;
    const isVertical = orientation === "vertical";

    const sizeMap = {
      1: { track: "0.375rem", thumb: "0.875rem" },
      2: { track: "0.5rem", thumb: "1rem" },
      3: { track: "0.625rem", thumb: "1.25rem" },
    };
    const s = sizeMap[size] || sizeMap["2"];

    return `
      :host {
        display: inline-block;
        box-sizing: border-box;
        ${isVertical ? "height: 100%; width: " + s.track : "width: 100%; height: " + s.track};
        position: relative;
        touch-action: none;
      }

      .slider-track {
        position: relative;
        width: 100%;
        height: 100%;
        background-color: var(--gray-6);
        border-radius: 9999px;
        cursor: pointer;
      }

      .slider-range {
        position: absolute;
        background-color: var(--${color}-9);
        border-radius: 9999px;
        pointer-events: none;
      }

      .slider-thumb {
        position: absolute;
        width: ${s.thumb};
        height: ${s.thumb};
        background-color: white;
        border: 2px solid var(--${color}-9);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        cursor: grab;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        z-index: 2;
      }

      .slider-thumb:active { cursor: grabbing; }

      :host([data-disabled]) { opacity: 0.5; pointer-events: none; }
      :host([data-disabled]) .slider-thumb { cursor: not-allowed; }

      ::slotted(*) { display: none; }
    `;
  }
}

class NofoSliderTrack extends NofoElement {
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoSliderRange extends NofoElement {
  template() {
    return ``;
  }
  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoSliderThumb extends NofoElement {
  template() {
    return ``;
  }
  styles() {
    return `:host { display: contents; }`;
  }
}

customElements.define("nofo-slider", NofoSlider);
customElements.define("nofo-slider-track", NofoSliderTrack);
customElements.define("nofo-slider-range", NofoSliderRange);
customElements.define("nofo-slider-thumb", NofoSliderThumb);

export { NofoSlider, NofoSliderTrack, NofoSliderRange, NofoSliderThumb };
