import theme from "vitepress/theme";
import "./custom.css";

export default {
  ...theme,
  enhanceApp({ app }) {
    console.log(app);
  }
};