/\*\*

- Nofo UI - README
-
- A beautifully styled component library built on top of Nofo System components.
- Inspired by shadcn/ui, designed for the Nofo universe.
  \*/

# Nofo UI

A production-ready, beautifully styled component library built on top of [Nofo System](./../system/) components. Think of it as **shadcn/ui on top of Radix UI** - a styled layer that provides beautiful defaults while maintaining full customization capabilities.

## Features

- 🎨 **Nofo Universe Theme** - Default "flat math universe" aesthetic with nofo-inspired design
- 🎯 **Built on System Components** - Uses Nofo System components as building blocks
- 🎭 **Fully Themeable** - Customize colors, spacing, typography, and more
- 📦 **Web Components** - Native web components, no framework required
- ♿ **Accessible** - Built-in accessibility from underlying system components
- 🎪 **Extensible** - Easy to customize and extend
- 🚀 **Production Ready** - Battle-tested components ready for production use

## Installation

```html
<!-- Import Nofo UI theme -->
<script type="module" src="/components/library/nofo-ui-theme.js"></script>

<!-- Import individual components -->
<script type="module" src="/components/library/nofo-ui-button.js"></script>
<script type="module" src="/components/library/nofo-ui-card.js"></script>
<script type="module" src="/components/library/nofo-ui-input.js"></script>
<!-- ... more components ... -->

<!-- Or import everything -->
<script type="module" src="/components/library/index.js"></script>
```

## Quick Start

```html
<nofo-ui-theme appearance="nofo" accent-color="green" radius="medium">
  <nofo-ui-button variant="default">Enter Nofo</nofo-ui-button>

  <nofo-ui-card>
    <nofo-ui-card-header>
      <nofo-ui-card-title>Welcome</nofo-ui-card-title>
      <nofo-ui-card-description>To the Nofo</nofo-ui-card-description>
    </nofo-ui-card-header>
    <nofo-ui-card-content>
      <nofo-ui-input placeholder="Enter your name" />
    </nofo-ui-card-content>
  </nofo-ui-card>
</nofo-ui-theme>
```

## Theme System

Nofo UI uses CSS custom properties for theming. The theme provider sets these variables globally:

```javascript
// Theme appearance options
appearance="nofo|dark|light"

// Accent colors
accent-color="green|cyan|blue|purple|red"

// Border radius
radius="none|small|medium|large|full"
```

### CSS Variables

All components use CSS variables prefixed with `--nofo-ui-`:

- `--nofo-ui-background` - Main background color
- `--nofo-ui-background-secondary` - Secondary background
- `--nofo-ui-foreground` - Main text color
- `--nofo-ui-accent-primary` - Primary accent color
- `--nofo-ui-border` - Border color
- `--nofo-ui-radius` - Border radius
- `--nofo-ui-shadow` - Box shadow
- `--nofo-ui-font-family` - Font family

## Components

### Core Components

- `nofo-ui-button` - Button component with multiple variants
- `nofo-ui-card` - Card container with header, content, footer
- `nofo-ui-input` - Text input with validation states
- `nofo-ui-label` - Form label component
- `nofo-ui-dialog` - Modal dialog component

### Form Components

- `nofo-ui-select` - Select dropdown
- `nofo-ui-checkbox` - Checkbox input
- `nofo-ui-radio` - Radio button
- `nofo-ui-switch` - Toggle switch
- `nofo-ui-slider` - Range slider
- `nofo-ui-textarea` - Multi-line text input

### Overlay Components

- `nofo-ui-dropdown-menu` - Dropdown menu
- `nofo-ui-popover` - Popover component
- `nofo-ui-tooltip` - Tooltip component
- `nofo-ui-alert-dialog` - Alert dialog
- `nofo-ui-sheet` - Side sheet/drawer

### Navigation Components

- `nofo-ui-tabs` - Tab navigation
- `nofo-ui-accordion` - Accordion component
- `nofo-ui-breadcrumbs` - Breadcrumb navigation
- `nofo-ui-navigation-menu` - Navigation menu
- `nofo-ui-sidebar` - Sidebar component

### Display Components

- `nofo-ui-badge` - Badge component
- `nofo-ui-avatar` - Avatar component
- `nofo-ui-separator` - Separator line
- `nofo-ui-table` - Data table
- `nofo-ui-progress` - Progress bar
- `nofo-ui-skeleton` - Loading skeleton

### Feedback Components

- `nofo-ui-alert` - Alert component
- `nofo-ui-toast` - Toast notification
- `nofo-ui-banner` - Banner component

## Styling

Nofo UI components are designed to be easily customizable. You can:

1. **Use CSS Variables** - Override theme variables
2. **Extend Components** - Create your own components extending nofo-ui
3. **Slot Customization** - Use slots for custom content
4. **Attribute-based Styling** - Use data attributes for styling hooks

## Examples

### Button Variants

```html
<nofo-ui-button variant="default">Default</nofo-ui-button>
<nofo-ui-button variant="destructive">Destructive</nofo-ui-button>
<nofo-ui-button variant="outline">Outline</nofo-ui-button>
<nofo-ui-button variant="ghost">Ghost</nofo-ui-button>
<nofo-ui-button variant="link">Link</nofo-ui-button>
```

### Card with Form

```html
<nofo-ui-card>
  <nofo-ui-card-header>
    <nofo-ui-card-title>Login</nofo-ui-card-title>
    <nofo-ui-card-description>Enter your credentials</nofo-ui-card-description>
  </nofo-ui-card-header>
  <nofo-ui-card-content>
    <nofo-ui-input label="Email" type="email" placeholder="you@example.com" />
    <nofo-ui-input label="Password" type="password" />
  </nofo-ui-card-content>
  <nofo-ui-card-footer>
    <nofo-ui-button variant="outline">Cancel</nofo-ui-button>
    <nofo-ui-button>Login</nofo-ui-button>
  </nofo-ui-card-footer>
</nofo-ui-card>
```

### Dialog

```html
<nofo-ui-dialog>
  <nofo-ui-dialog-trigger>
    <nofo-ui-button>Open Dialog</nofo-ui-button>
  </nofo-ui-dialog-trigger>
  <nofo-ui-dialog-content>
    <nofo-ui-dialog-header>
      <nofo-ui-dialog-title>Confirm Action</nofo-ui-dialog-title>
      <nofo-ui-dialog-description>Are you sure you want to continue?</nofo-ui-dialog-description>
    </nofo-ui-dialog-header>
    <nofo-ui-dialog-footer>
      <nofo-ui-button variant="outline">Cancel</nofo-ui-button>
      <nofo-ui-button variant="destructive">Confirm</nofo-ui-button>
    </nofo-ui-dialog-footer>
  </nofo-ui-dialog-content>
</nofo-ui-dialog>
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Contributing

When contributing new components:

1. Build on Nofo System components
2. Use Nofo UI theme variables
3. Follow existing component patterns
4. Include examples in documentation
5. Ensure accessibility

## License

[Your License Here]

---

**Built with ❤️ in the Nofo Universe**
