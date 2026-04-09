import { NofoElement } from "../../index.js";

class NofoAvatar extends NofoElement {
  static props = {
    size: "3",
    variant: "solid",
    color: "accent",
    radius: "full",
    fallback: "",
    src: "",
  };

  onMount() {
    this.updateDataAttributes();
  }

  updateDataAttributes() {
    this.dataset.size = this.size;
    this.dataset.variant = this.variant;
    this.dataset.color = this.color;
  }

  getSizeStyles(size) {
    const sizes = {
      1: "0.75rem",
      2: "1rem",
      3: "1.25rem",
      4: "1.5rem",
      5: "2rem",
      6: "2.5rem",
      7: "3rem",
      8: "4rem",
      9: "5rem",
    };
    return sizes[size] || sizes["3"];
  }

  getRadiusStyles(radius) {
    const radii = {
      none: "0",
      small: "0.125rem",
      medium: "0.25rem",
      large: "0.5rem",
      full: "50%",
    };
    return radii[radius] || radii["full"];
  }

  getColorStyles(color, variant) {
    const colors = {
      accent: "#0066cc",
      gray: "#666666",
      red: "#cc0000",
      green: "#00cc66",
      blue: "#0066cc",
      yellow: "#ffcc00",
      purple: "#6600cc",
      pink: "#cc0066",
      indigo: "#3333cc",
    };

    const baseColor = colors[color] || colors["accent"];

    if (variant === "soft") {
      return {
        backgroundColor: `${baseColor}20`,
        color: baseColor,
      };
    } else {
      return {
        backgroundColor: baseColor,
        color: "#ffffff",
      };
    }
  }

  template() {
    const sizeValue = this.getSizeStyles(this.size);
    const radiusValue = this.getRadiusStyles(this.radius);
    const colorStyles = this.getColorStyles(this.color, this.variant);

    const imageElement = this.querySelector("nofo-avatar-image");
    const fallbackElement = this.querySelector("nofo-avatar-fallback");

    let content = "";
    if (this.src) {
      content = `<img src="${this.src}" alt="${this.fallback}" style="width: 100%; height: 100%; object-fit: cover;" />`;
    } else if (imageElement && imageElement.getAttribute("src")) {
      const imageSrc = imageElement.getAttribute("src");
      const imageAlt = imageElement.getAttribute("alt") || this.fallback;
      content = `<img src="${imageSrc}" alt="${imageAlt}" style="width: 100%; height: 100%; object-fit: cover;" />`;
    } else if (fallbackElement) {
      content = fallbackElement.textContent || this.fallback;
    } else {
      content = this.fallback;
    }

    return `<div>${content}</div>`;
  }

  styles() {
    const sizeValue = this.getSizeStyles(this.size);
    const radiusValue = this.getRadiusStyles(this.radius);
    const colorStyles = this.getColorStyles(this.color, this.variant);

    return `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: ${sizeValue};
        height: ${sizeValue};
        border-radius: ${radiusValue};
        background-color: ${colorStyles.backgroundColor};
        color: ${colorStyles.color};
        font-weight: 500;
        font-size: calc(${sizeValue} * 0.4);
        overflow: hidden;
        position: relative;
        box-sizing: border-box;
      }
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    `;
  }
}

class NofoAvatarImage extends NofoElement {
  template() {
    return ``;
  }

  styles() {
    return ``;
  }
}

class NofoAvatarFallback extends NofoElement {
  static props = {
    delayMs: null,
  };

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return ``;
  }
}

customElements.define("nofo-avatar", NofoAvatar);
customElements.define("nofo-avatar-image", NofoAvatarImage);
customElements.define("nofo-avatar-fallback", NofoAvatarFallback);

export { NofoAvatar, NofoAvatarImage, NofoAvatarFallback };
