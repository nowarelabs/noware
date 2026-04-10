import DefaultTheme from 'vitepress/theme'
import './custom.css'

export default {
  ...DefaultTheme,
  enhanceApp({ app }: { app: unknown }) {
    console.log(app);
  }
}
