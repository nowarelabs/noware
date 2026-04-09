import { NofoElement } from "../../index.js";

class NofoRating extends NofoElement {
  static props = {
    value: { type: Number, default: 0 },
    defaultValue: { type: Number, default: 0 },
    max: { type: Number, default: 5 },
    size: { type: String, default: "2" },
    color: { type: String, default: "accent" },
    disabled: { type: Boolean, default: false },
    readOnly: { type: Boolean, default: false },
  };

  constructor() {
    super();
    this._value = 0;
  }

  onMount() {
    this.sync();
    this.setupEventListeners();
  }

  sync() {
    const size = this.props.size || "2";
    const color = this.props.color || "accent";
    const disabled = this.props.disabled;
    const readOnly = this.props.readOnly;

    this.dataset.size = size;
    this.dataset.color = color;
    if (disabled) {
      this.dataset.disabled = "";
    } else {
      this.removeAttribute("data-disabled");
    }
    if (readOnly) {
      this.dataset.readonly = "";
    } else {
      this.removeAttribute("data-readonly");
    }

    if (this.props.defaultValue) {
      this._value = this.props.defaultValue;
    }
    if (this.props.value !== undefined) {
      this._value = this.props.value;
    }
  }

  setupEventListeners() {
    const stars = this.shadowRoot.querySelectorAll(".star");
    stars.forEach((star, index) => {
      star.addEventListener("click", () => {
        if (this.props.disabled || this.props.readOnly) {
          return;
        }

        this._value = index + 1;
        this.props.value = this._value;

        const event = new CustomEvent("value-change", {
          detail: { value: this._value },
          bubbles: true,
          composed: true,
        });
        this.dispatchEvent(event);

        this.updateStars();
      });

      star.addEventListener("mouseenter", () => {
        if (this.props.disabled || this.props.readOnly) {
          return;
        }
        this.updateStars(index + 1, true);
      });
    });

    const container = this.shadowRoot.querySelector(".rating-container");
    if (container) {
      container.addEventListener("mouseleave", () => {
        if (this.props.disabled || this.props.readOnly) {
          return;
        }
        this.updateStars();
      });
    }
  }

  updateStars(hoverValue = null, isHovering = false) {
    const stars = this.shadowRoot.querySelectorAll(".star");
    const value = hoverValue !== null ? hoverValue : this._value;

    stars.forEach((star, index) => {
      const starValue = index + 1;
      star.classList.remove("active", "half");

      if (starValue <= value) {
        star.classList.add("active");
      }
    });
  }

  template() {
    const max = this.props.max || 5;
    const size = this.props.size || "2";
    const color = this.props.color || "accent";
    const disabled = this.props.disabled;
    const readOnly = this.props.readOnly;

    const sizes = {
      1: "1rem",
      2: "1.5rem",
      3: "2rem",
    };
    const starSize = sizes[size] || sizes["2"];

    const styles = {
      display: "inline-flex",
      gap: "0.25rem",
      cursor: disabled || readOnly ? "default" : "pointer",
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    const starsHtml = Array.from({ length: max }, (_, i) => {
      const starValue = i + 1;
      const isActive = starValue <= this._value;
      return `<span class="star ${isActive ? "active" : ""}" data-value="${starValue}" style="width: ${starSize}; height: ${starSize};">
        <nofo-icon name="star"></nofo-icon>
      </span>`;
    }).join("");

    return `
      <style>
        :host {
          ${styleString}
          box-sizing: border-box;
        }
        .rating-container {
          display: inline-flex;
          gap: 0.25rem;
        }
        .star {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--gray-6);
          transition: color 0.2s;
          flex-shrink: 0;
        }
        .star.active {
          color: var(--${color}-9);
        }
        .star:hover:not(.active) {
          color: var(--${color}-7);
        }
      </style>
      <div class="rating-container">
        ${starsHtml}
      </div>
    `;
  }

  styles() {
    return ``;
  }
}

customElements.define("nofo-rating", NofoRating);
export { NofoRating };
