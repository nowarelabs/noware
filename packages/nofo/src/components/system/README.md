# Nofo Design System

A comprehensive, production-ready web component system built with modern web standards. Nofo provides 60+ accessible, customizable components following Radix UI design principles, implemented as native Web Components.

## Table of Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
- [Design Principles](#design-principles)
- [Core Concepts](#core-concepts)
- [Components](#components)
  - [Layout](#layout-components)
  - [Typography](#typography-components)
  - [Form Controls](#form-controls)
  - [Overlays](#overlay-components)
  - [Navigation](#navigation-components)
  - [Feedback](#feedback-components)
  - [Display](#display-components)
  - [Interactive](#interactive-components)
- [Theming](#theming)
- [Events](#events)
- [Accessibility](#accessibility)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Installation

```html
<!-- Import individual components -->
<script type="module" src="/components/system/nofo-button.js"></script>
<script type="module" src="/components/system/nofo-card.js"></script>

<!-- Or import all components -->
<script type="module">
  import "/components/system/nofo-button.js";
  import "/components/system/nofo-card.js";
  // ... import other components
</script>
```

## Getting Started

Wrap your application with the theme component to enable design tokens:

```html
<nofo-theme accent-color="blue" gray-color="slate" radius="medium" scaling="100%">
  <nofo-button>Click me</nofo-button>
</nofo-theme>
```

## Design Principles

### 1. Compound Components

Related parts are grouped hierarchically, allowing flexible composition:

```html
<nofo-card>
  <nofo-card-header>
    <nofo-card-title>Title</nofo-card-title>
  </nofo-card-header>
  <nofo-card-content>Content</nofo-card-content>
  <nofo-card-footer>Footer</nofo-card-footer>
</nofo-card>
```

### 2. Data Attributes for Styling

All components expose `data-*` attributes for styling hooks:

```css
/* Style based on component state */
nofo-button[data-disabled] {
  opacity: 0.5;
}

nofo-dialog[data-state="open"] {
  display: block;
}
```

### 3. Controlled & Uncontrolled Patterns

Support both controlled (`value`) and uncontrolled (`defaultValue`) patterns:

```html
<!-- Controlled -->
<nofo-select value="option-1" onValueChange="{handleChange}">
  <!-- Uncontrolled -->
  <nofo-select defaultValue="option-1"></nofo-select
></nofo-select>
```

### 4. Portal Rendering

Overlays render in portals for proper stacking:

```html
<nofo-dialog>
  <nofo-dialog-portal>
    <nofo-dialog-overlay />
    <nofo-dialog-content>...</nofo-dialog-content>
  </nofo-dialog-portal>
</nofo-dialog>
```

### 5. Consistent Size Scales

All components use a 1-9 size scale:

- **Size 1**: Smallest
- **Size 2**: Default
- **Size 3-9**: Progressively larger

### 6. Responsive Props

Use object syntax for responsive values:

```html
<nofo-box p='{ "initial": "2", "sm": "4", "lg": "6" }'></nofo-box>
```

## Core Concepts

### Events

Components dispatch custom events for state changes:

- `value-change` - Form control value changed
- `checked-change` - Checkbox/switch state changed
- `open-change` - Overlay open/close state changed
- `page-change` - Pagination page changed
- `nofo-click` - Button clicked

```javascript
const button = document.querySelector("nofo-button");
button.addEventListener("nofo-click", (e) => {
  console.log("Button clicked!");
});
```

### State Management

Components use `data-state` attributes to expose their current state:

```html
<nofo-dialog data-state="open">
  <nofo-dropdown-menu data-state="closed">
    <nofo-toggle-group-item data-state="on"></nofo-toggle-group-item></nofo-dropdown-menu
></nofo-dialog>
```

### CSS Variables

All components use CSS variables for theming:

```css
/* Spacing */
var(--space-1) through var(--space-9)

/* Colors */
var(--accent-1) through var(--accent-12)
var(--gray-1) through var(--gray-12)

/* Typography */
var(--font-size-1) through var(--font-size-9)
```

## Components

## Layout Components

### Box

The fundamental layout component supporting spacing, sizing, positioning, and grid properties.

```html
<nofo-box p="4" px="6" width="100%" position="relative"> Content </nofo-box>
```

**Props:**

- `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl` - Padding (1-9 or CSS values)
- `m`, `mx`, `my`, `mt`, `mr`, `mb`, `ml` - Margin (1-9 or CSS values)
- `width`, `min-width`, `max-width` - Width
- `height`, `min-height`, `max-height` - Height
- `position` - CSS position
- `display` - Display property
- Grid and flex properties

### Flex

Box with flexbox capabilities.

```html
<nofo-flex
  direction="row|column"
  align="start|center|end|baseline|stretch"
  justify="start|center|end|between"
  wrap="nowrap|wrap|wrap-reverse"
  gap="1|2|3|4|5|6|7|8|9"
>
  <nofo-box>Item 1</nofo-box>
  <nofo-box>Item 2</nofo-box>
</nofo-flex>
```

**Props:**

- `direction` - Flex direction
- `align` - Align items
- `justify` - Justify content
- `wrap` - Flex wrap
- `gap` - Gap between items

### Grid

Box with CSS Grid capabilities.

```html
<nofo-grid columns="3" rows="auto" gap="4" gap-x="4" gap-y="2">
  <nofo-box>Item 1</nofo-box>
  <nofo-box>Item 2</nofo-box>
</nofo-grid>
```

**Props:**

- `columns` - Grid columns
- `rows` - Grid rows
- `gap`, `gap-x`, `gap-y` - Grid gap
- `flow` - Grid auto-flow

### Container

Consistent max-width wrapper.

```html
<nofo-container size="1|2|3|4"> Content </nofo-container>
```

**Props:**

- `size` - Max width (1: 480px, 2: 768px, 3: 1024px, 4: 1280px)

### Section

Consistent vertical spacing for page sections.

```html
<nofo-section size="1|2|3">
  <nofo-container> Content </nofo-container>
</nofo-section>
```

**Props:**

- `size` - Padding size (1: 1rem, 2: 2rem, 3: 3rem)

### Stack

Flexbox layout with consistent gap.

```html
<nofo-stack
  direction="vertical|horizontal"
  gap="sm|md|lg|1|2|3|4|5|6|7|8|9"
  align="start|center|end|stretch"
>
  <nofo-box>Item 1</nofo-box>
  <nofo-box>Item 2</nofo-box>
</nofo-stack>
```

**Props:**

- `direction` - Stack direction
- `gap` - Gap between items
- `align` - Alignment

## Typography Components

### Text

Body copy component with responsive sizing.

```html
<nofo-text
  as="p|span|div|label"
  size="1|2|3|4|5|6|7|8|9"
  weight="light|regular|medium|bold"
  align="left|center|right"
  color="gray|accent-color"
  high-contrast
>
  Body text
</nofo-text>
```

**Props:**

- `as` - Polymorphic element type
- `size` - Font size (1-9)
- `weight` - Font weight
- `align` - Text alignment
- `color` - Text color
- `high-contrast` - High contrast mode

### Heading

Title component with semantic HTML.

```html
<nofo-heading
  as="h1|h2|h3|h4|h5|h6"
  size="1|2|3|4|5|6|7|8|9"
  weight="light|regular|medium|bold"
  align="left|center|right"
>
  Heading text
</nofo-heading>
```

**Props:** Same as Text component

### Code

Inline and block code display.

```html
<nofo-code size="1|2|3|4|5|6|7|8|9" variant="solid|soft|outline|ghost" color="accent-color">
  console.log('Hello')
</nofo-code>
```

**Props:**

- `size` - Font size
- `variant` - Visual variant
- `color` - Accent color
- `high-contrast` - High contrast mode

### Link

Styled link component.

```html
<nofo-link
  href="/path"
  size="1|2|3|4|5|6|7|8|9"
  color="accent-color"
  underline="auto|always|hover|none"
  high-contrast
>
  Link text
</nofo-link>
```

**Props:**

- `href` - Link URL
- `size` - Font size
- `color` - Link color
- `underline` - Underline behavior
- `target` - Link target
- `rel` - Link rel

### Formatting Components

```html
<nofo-em>Emphasized text</nofo-em>
<nofo-strong>Strong text</nofo-strong>
<nofo-kbd size="2">Cmd</nofo-kbd>
<nofo-quote>"Quote text"</nofo-quote>
<nofo-blockquote cite="https://example.com"> Block quote content </nofo-blockquote>
```

## Form Controls

### Button

Primary button component with multiple variants.

```html
<nofo-button
  size="1|2|3|4"
  variant="solid|soft|surface|outline|ghost"
  color="accent-color"
  radius="none|small|medium|large|full"
  disabled
  loading
  type="button|submit|reset"
>
  <nofo-icon name="plus"></nofo-icon>
  Button text
</nofo-button>
```

**Props:**

- `size` - Button size (1-4)
- `variant` - Visual variant
- `color` - Accent color
- `radius` - Border radius
- `disabled` - Disabled state
- `loading` - Loading state
- `high-contrast` - High contrast mode

**Events:**

- `nofo-click` - Dispatched on click

### Icon Button

Button optimized for icons only.

```html
<nofo-icon-button size="1|2|3|4" variant="solid|soft|surface|outline|ghost" aria-label="Settings">
  <nofo-icon name="gear"></nofo-icon>
</nofo-icon-button>
```

**Props:** Same as Button

### Text Field

Text input component with slots for icons.

```html
<nofo-text-field
  value="{value}"
  onValueChange="{handleChange}"
  defaultValue=""
  placeholder="Enter text..."
  size="1|2|3"
  variant="surface|classic|soft|ghost"
  type="text|email|password|search|tel|url|number|date|time"
  disabled
  readOnly
  required
  name="username"
>
  <nofo-text-field-slot name="prefix">
    <nofo-icon name="magnifying-glass"></nofo-icon>
  </nofo-text-field-slot>
  <nofo-text-field-slot name="suffix">
    <nofo-icon name="cross"></nofo-icon>
  </nofo-text-field-slot>
</nofo-text-field>
```

**Props:**

- `value` / `defaultValue` - Input value
- `size` - Input size
- `variant` - Visual variant
- `type` - Input type
- `placeholder` - Placeholder text
- `disabled` / `readOnly` - Input states
- `required` - Required field
- `name` - Form field name

**Events:**

- `value-change` - Dispatched on input change

### Text Area

Multi-line text input.

```html
<nofo-text-area
  value="{value}"
  onValueChange="{handleChange}"
  defaultValue=""
  placeholder="Enter message..."
  size="1|2|3"
  variant="surface|classic|soft|ghost"
  resize="none|vertical|horizontal|both"
  rows="{4}"
  disabled
  readOnly
  required
></nofo-text-area>
```

**Props:** Similar to Text Field with `rows`, `cols`, `resize` options

### Select

Dropdown select component.

```html
<nofo-select
  value="{value}"
  onValueChange="{handleChange}"
  defaultValue="option-1"
  size="1|2|3"
  variant="solid|soft|surface|ghost"
  disabled
>
  <nofo-select-trigger placeholder="Select...">
    <nofo-select-value />
    <nofo-select-icon>
      <nofo-icon name="chevron-down"></nofo-icon>
    </nofo-select-icon>
  </nofo-select-trigger>

  <nofo-select-content side="bottom" align="start">
    <nofo-select-group>
      <nofo-select-label>Fruits</nofo-select-label>
      <nofo-select-item value="apple">
        <nofo-select-item-text>Apple</nofo-select-item-text>
        <nofo-select-item-indicator>
          <nofo-icon name="check"></nofo-icon>
        </nofo-select-item-indicator>
      </nofo-select-item>
    </nofo-select-group>
    <nofo-select-separator />
  </nofo-select-content>
</nofo-select>
```

**Props:**

- `value` / `defaultValue` - Selected value
- `size` - Select size
- `variant` - Visual variant
- `disabled` - Disabled state

**Events:**

- `value-change` - Dispatched on selection change

### Checkbox

Checkbox input with label support.

```html
<nofo-checkbox
  size="1|2|3"
  variant="solid|soft|surface"
  color="accent-color"
  checked="{checked}"
  onCheckedChange="{handleChange}"
  defaultChecked="{false}"
  disabled
  required
  name="terms"
  value="accepted"
>
  <nofo-text>Accept terms</nofo-text>
</nofo-checkbox>
```

**Props:**

- `size` - Checkbox size
- `variant` - Visual variant
- `checked` / `defaultChecked` - Checked state
- `disabled` - Disabled state
- `indeterminate` - Indeterminate state (use `checked="indeterminate"`)

**Events:**

- `checked-change` - Dispatched on state change

### Checkbox Group

Group of checkboxes with shared state.

```html
<nofo-checkbox-group
  value={selected}
  onValueChange={setSelected}
  defaultValue={["option-1"]}
  name="features"
>
  <nofo-checkbox value="option-1">
    <nofo-text>Option 1</nofo-text>
  </nofo-checkbox>
  <nofo-checkbox value="option-2">
    <nofo-text>Option 2</nofo-text>
  </nofo-checkbox>
</nofo-checkbox-group>
```

**Props:**

- `value` / `defaultValue` - Array of selected values
- `name` - Form field name
- `disabled` - Disabled state

**Events:**

- `value-change` - Dispatched with array of selected values

### Radio

Radio button input.

```html
<nofo-radio-group
  value="{selected}"
  onValueChange="{setSelected}"
  defaultValue="option-1"
  name="options"
  orientation="vertical|horizontal"
>
  <nofo-radio value="option-1" size="1|2|3">
    <nofo-text>Option 1</nofo-text>
  </nofo-radio>
  <nofo-radio value="option-2">
    <nofo-text>Option 2</nofo-text>
  </nofo-radio>
</nofo-radio-group>
```

**Props:**

- `value` / `defaultValue` - Selected value
- `name` - Form field name
- `orientation` - Layout direction

**Events:**

- `value-change` - Dispatched on selection change

### Switch

Toggle switch component.

```html
<nofo-switch
  checked="{checked}"
  onCheckedChange="{handleChange}"
  defaultChecked="{false}"
  size="1|2|3"
  variant="solid|soft|surface"
  color="accent-color"
  disabled
  name="notifications"
>
  <nofo-text>Enable notifications</nofo-text>
</nofo-switch>
```

**Props:**

- `size` - Switch size
- `variant` - Visual variant
- `checked` / `defaultChecked` - Checked state
- `disabled` - Disabled state

**Events:**

- `checked-change` - Dispatched on state change

### Slider

Range slider component.

```html
<nofo-slider
  value="{value}"
  onValueChange="{handleChange}"
  defaultValue="{[50]}"
  min="{0}"
  max="{100}"
  step="{1}"
  size="1|2|3"
  variant="solid|soft|surface"
  disabled
  orientation="horizontal|vertical"
>
  <nofo-slider-track>
    <nofo-slider-range />
  </nofo-slider-track>
  <nofo-slider-thumb />
  <!-- Multiple thumbs for range slider -->
  <nofo-slider-thumb />
</nofo-slider>
```

**Props:**

- `value` / `defaultValue` - Value or array of values
- `min` / `max` - Range bounds
- `step` - Step increment
- `size` - Slider size
- `orientation` - Horizontal or vertical

**Events:**

- `value-change` - Dispatched on value change

### Form

Form container component.

```html
<nofo-form onSubmit="{handleSubmit}">
  <nofo-flex direction="column" gap="4">
    <nofo-text-field name="email" required />
    <nofo-button type="submit">Submit</nofo-button>
  </nofo-flex>
</nofo-form>
```

**Events:**

- `form-submit` - Dispatched on form submission

## Overlay Components

### Dialog

Modal dialog component.

```html
<nofo-dialog open="{isOpen}" onOpenChange="{setIsOpen}">
  <nofo-dialog-trigger>
    <nofo-button>Open Dialog</nofo-button>
  </nofo-dialog-trigger>

  <nofo-dialog-portal>
    <nofo-dialog-overlay />
    <nofo-dialog-content size="1|2|3|4">
      <nofo-dialog-title>Dialog Title</nofo-dialog-title>
      <nofo-dialog-description> Dialog description </nofo-dialog-description>

      <nofo-dialog-close>
        <nofo-button variant="soft">Close</nofo-button>
      </nofo-dialog-close>
    </nofo-dialog-content>
  </nofo-dialog-portal>
</nofo-dialog>
```

**Props:**

- `open` - Open state

**Events:**

- `open-change` - Dispatched on open/close

### Alert Dialog

Confirmation dialog for destructive actions.

```html
<nofo-alert-dialog open="{isOpen}" onOpenChange="{setIsOpen}">
  <nofo-alert-dialog-trigger>
    <nofo-button variant="danger">Delete</nofo-button>
  </nofo-alert-dialog-trigger>

  <nofo-alert-dialog-portal>
    <nofo-alert-dialog-overlay />
    <nofo-alert-dialog-content>
      <nofo-alert-dialog-title>Are you sure?</nofo-alert-dialog-title>
      <nofo-alert-dialog-description> This action cannot be undone. </nofo-alert-dialog-description>

      <nofo-alert-dialog-cancel>
        <nofo-button variant="soft">Cancel</nofo-button>
      </nofo-alert-dialog-cancel>
      <nofo-alert-dialog-action>
        <nofo-button variant="solid" color="red">Delete</nofo-button>
      </nofo-alert-dialog-action>
    </nofo-alert-dialog-content>
  </nofo-alert-dialog-portal>
</nofo-alert-dialog>
```

### Popover

Popover component for additional content.

```html
<nofo-popover open="{isOpen}" onOpenChange="{setIsOpen}">
  <nofo-popover-trigger>
    <nofo-button variant="soft">Open Popover</nofo-button>
  </nofo-popover-trigger>

  <nofo-popover-content
    size="1|2|3|4"
    side="top|right|bottom|left"
    align="start|center|end"
    sideOffset="{5}"
  >
    Popover content
    <nofo-popover-close>
      <nofo-icon-button variant="ghost">
        <nofo-icon name="cross"></nofo-icon>
      </nofo-icon-button>
    </nofo-popover-close>
  </nofo-popover-content>
</nofo-popover>
```

**Props:**

- `open` - Open state
- `side` - Positioning side
- `align` - Alignment
- `sideOffset` - Offset from trigger

### Dropdown Menu

Dropdown menu component.

```html
<nofo-dropdown-menu>
  <nofo-dropdown-menu-trigger>
    <nofo-button variant="soft">Options</nofo-button>
  </nofo-dropdown-menu-trigger>

  <nofo-dropdown-menu-content align="start" side="bottom">
    <nofo-dropdown-menu-item shortcut="⌘ N">
      <nofo-icon name="file-plus"></nofo-icon>
      New File
    </nofo-dropdown-menu-item>
    <nofo-dropdown-menu-separator />
    <nofo-dropdown-menu-item color="red">Delete</nofo-dropdown-menu-item>
  </nofo-dropdown-menu-content>
</nofo-dropdown-menu>
```

### Context Menu

Right-click context menu.

```html
<nofo-context-menu>
  <nofo-context-menu-trigger>
    <nofo-box p="5">Right click here</nofo-box>
  </nofo-context-menu-trigger>

  <nofo-context-menu-content>
    <nofo-context-menu-item shortcut="⌘ E">Edit</nofo-context-menu-item>
    <nofo-context-menu-separator />
    <nofo-context-menu-item color="red">Delete</nofo-context-menu-item>
  </nofo-context-menu-content>
</nofo-context-menu>
```

### Tooltip

Tooltip component.

```html
<nofo-tooltip open="{isOpen}" onOpenChange="{setIsOpen}" delayDuration="{700}">
  <nofo-tooltip-trigger>
    <nofo-icon-button variant="ghost">
      <nofo-icon name="info-circled"></nofo-icon>
    </nofo-icon-button>
  </nofo-tooltip-trigger>

  <nofo-tooltip-content side="top" align="center" sideOffset="{5}">
    Tooltip content
    <nofo-tooltip-arrow />
  </nofo-tooltip-content>
</nofo-tooltip>
```

**Props:**

- `open` - Open state
- `delayDuration` - Delay before showing (ms)
- `skipDelayDuration` - Delay before hiding (ms)

### Hover Card

Card that appears on hover.

```html
<nofo-hover-card openDelay="{200}" closeDelay="{300}">
  <nofo-hover-card-trigger>
    <nofo-link href="#">@username</nofo-link>
  </nofo-hover-card-trigger>

  <nofo-hover-card-content size="1|2|3"> Card content </nofo-hover-card-content>
</nofo-hover-card>
```

## Navigation Components

### Navigation

Navigation menu with groups and sub-menus.

```html
<nofo-navigation orientation="vertical|horizontal">
  <nofo-nav-group label="Main Menu">
    <nofo-nav-item value="home" href="/home" active>
      <nofo-icon name="home"></nofo-icon>
      Home
    </nofo-nav-item>

    <nofo-nav-sub>
      <nofo-nav-sub-trigger>
        Products
        <nofo-icon name="chevron-down"></nofo-icon>
      </nofo-nav-sub-trigger>
      <nofo-nav-sub-content>
        <nofo-nav-item value="product-1" href="/products/1"> Product 1 </nofo-nav-item>
      </nofo-nav-sub-content>
    </nofo-nav-sub>
  </nofo-nav-group>
</nofo-navigation>
```

### Breadcrumbs

Breadcrumb navigation.

```html
<nofo-breadcrumbs>
  <nofo-breadcrumbs-item>
    <nofo-link href="/">Home</nofo-link>
  </nofo-breadcrumbs-item>
  <nofo-breadcrumbs-separator />
  <nofo-breadcrumbs-item>
    <nofo-link href="/products">Products</nofo-link>
  </nofo-breadcrumbs-item>
  <nofo-breadcrumbs-separator />
  <nofo-breadcrumbs-item>
    <nofo-text>Current Page</nofo-text>
  </nofo-breadcrumbs-item>
</nofo-breadcrumbs>
```

### Tabs

Tab navigation component.

```html
<nofo-tabs
  value="{value}"
  onValueChange="{setValue}"
  defaultValue="account"
  orientation="horizontal|vertical"
>
  <nofo-tabs-list size="1|2">
    <nofo-tabs-trigger value="account"> Account </nofo-tabs-trigger>
    <nofo-tabs-trigger value="settings"> Settings </nofo-tabs-trigger>
  </nofo-tabs-list>

  <nofo-tabs-content value="account"> Account content </nofo-tabs-content>
  <nofo-tabs-content value="settings"> Settings content </nofo-tabs-content>
</nofo-tabs>
```

**Props:**

- `value` / `defaultValue` - Active tab value
- `orientation` - Tab orientation
- `activation-mode` - "automatic" or "manual"

**Events:**

- `value-change` - Dispatched on tab change

### Tab Nav

Navigation-style tabs.

```html
<nofo-tab-nav size="1|2">
  <nofo-tab-nav-link href="/" active> Dashboard </nofo-tab-nav-link>
  <nofo-tab-nav-link href="/projects"> Projects </nofo-tab-nav-link>
</nofo-tab-nav>
```

### Pagination

Pagination component.

```html
<nofo-pagination
  total="{100}"
  page="{page}"
  onPageChange="{setPage}"
  pageSize="{10}"
  siblingCount="{1}"
  showFirstLast
>
</nofo-pagination>
```

**Props:**

- `total` - Total number of items
- `page` - Current page (1-indexed)
- `pageSize` - Items per page
- `siblingCount` - Number of sibling pages to show
- `showFirstLast` - Show first/last buttons

**Events:**

- `page-change` - Dispatched on page change

## Feedback Components

### Toast

Toast notification component.

```html
<nofo-toast-group position="top-right|top-left|bottom-right|bottom-left|top-center|bottom-center">
  <nofo-toast
    variant="default|success|error|warning|info"
    duration="{5000}"
    open="{isOpen}"
    onOpenChange="{setIsOpen}"
  >
    <nofo-toast-title>Success</nofo-toast-title>
    <nofo-toast-description> Your changes have been saved. </nofo-toast-description>
    <nofo-toast-action alt-text="Undo">Undo</nofo-toast-action>
    <nofo-toast-close></nofo-toast-close>
  </nofo-toast>
</nofo-toast-group>
```

**Props:**

- `variant` - Toast variant
- `duration` - Auto-dismiss duration (ms, 0 = no auto-dismiss)
- `open` - Open state

**Events:**

- `open-change` - Dispatched on open/close

### Alert

Alert message component.

```html
<nofo-alert
  variant="info|success|warning|error"
  size="1|2|3"
  dismissible
  open="{isOpen}"
  onOpenChange="{setIsOpen}"
>
  <nofo-alert-icon>
    <nofo-icon name="info-circled"></nofo-icon>
  </nofo-alert-icon>
  <nofo-alert-content>
    <nofo-alert-title>Important notice</nofo-alert-title>
    <nofo-alert-description> Alert description </nofo-alert-description>
  </nofo-alert-content>
  <nofo-alert-close></nofo-alert-close>
</nofo-alert>
```

**Props:**

- `variant` - Alert variant
- `size` - Alert size
- `dismissible` - Show close button

### Banner

Banner component for page-level announcements.

```html
<nofo-banner variant="info|success|warning|error" dismissible open="{isOpen}">
  <nofo-icon name="info"></nofo-icon>
  <nofo-banner-content> Important announcement </nofo-banner-content>
  <nofo-banner-close></nofo-banner-close>
</nofo-banner>
```

## Display Components

### Card

Card container component.

```html
<nofo-card size="1|2|3|4|5" variant="surface|classic|ghost">
  <nofo-card-header>
    <nofo-card-title>Card Title</nofo-card-title>
    <nofo-card-description>Card description</nofo-card-description>
  </nofo-card-header>
  <nofo-card-content> Card content </nofo-card-content>
  <nofo-card-footer>
    <nofo-button>Action</nofo-button>
  </nofo-card-footer>
</nofo-card>
```

**Props:**

- `size` - Padding size (1-5)
- `variant` - Visual variant

### Badge

Badge component for labels and status.

```html
<nofo-badge size="1|2|3" variant="solid|soft|surface|outline" color="accent-color" high-contrast>
  New
</nofo-badge>
```

**Props:**

- `size` - Badge size
- `variant` - Visual variant
- `color` - Accent color
- `high-contrast` - High contrast mode

### Avatar

Avatar component with image and fallback.

```html
<nofo-avatar
  size="1|2|3|4|5|6|7|8|9"
  variant="solid|soft"
  color="accent-color"
  radius="none|small|medium|large|full"
  fallback="JD"
>
  <nofo-avatar-image src="/avatar.jpg" alt="John Doe" />
  <nofo-avatar-fallback delayMs="{600}">JD</nofo-avatar-fallback>
</nofo-avatar>
```

**Props:**

- `size` - Avatar size (1-9)
- `variant` - Visual variant
- `radius` - Border radius
- `fallback` - Fallback text

### Progress

Progress bar component.

```html
<nofo-progress
  value="{progress}"
  max="{100}"
  size="1|2|3"
  variant="solid|soft|surface"
  color="accent-color"
>
  <nofo-progress-indicator />
</nofo-progress>
```

**Props:**

- `value` - Current value (omit for indeterminate)
- `max` - Maximum value
- `size` - Progress bar size
- `variant` - Visual variant

### Spinner

Loading spinner component.

```html
<nofo-spinner size="1|2|3" loading="{isLoading}"></nofo-spinner>
```

**Props:**

- `size` - Spinner size
- `loading` - Show/hide spinner

### Skeleton

Loading skeleton component.

```html
<nofo-skeleton width="100%" height="20px" loading="{isLoading}" variant="text|circular|rectangular">
  {isLoading ? null : <nofo-text>Loaded content</nofo-text>}
</nofo-skeleton>
```

**Props:**

- `width` - Skeleton width
- `height` - Skeleton height
- `loading` - Show/hide skeleton
- `variant` - Shape variant

### Table

Table component with headers, body, and footer.

```html
<nofo-table size="1|2|3" variant="surface|ghost" layout="auto|fixed">
  <nofo-table-header>
    <nofo-table-row>
      <nofo-table-column-header-cell>Name</nofo-table-column-header-cell>
      <nofo-table-column-header-cell>Email</nofo-table-column-header-cell>
    </nofo-table-row>
  </nofo-table-header>

  <nofo-table-body>
    <nofo-table-row>
      <nofo-table-row-header-cell>John Doe</nofo-table-row-header-cell>
      <nofo-table-cell>john@example.com</nofo-table-cell>
    </nofo-table-row>
  </nofo-table-body>

  <nofo-table-footer>
    <nofo-table-row>
      <nofo-table-cell colspan="3">Total: 1</nofo-table-cell>
    </nofo-table-row>
  </nofo-table-footer>
</nofo-table>
```

**Props:**

- `size` - Table size
- `variant` - Visual variant
- `layout` - Table layout

### Empty State

Empty state component for when there's no data.

```html
<nofo-empty-state>
  <nofo-icon name="inbox" size="lg"></nofo-icon>
  <nofo-empty-state-title>No items found</nofo-empty-state-title>
  <nofo-empty-state-description>
    Get started by creating your first item.
  </nofo-empty-state-description>
  <nofo-button>Create Item</nofo-button>
</nofo-empty-state>
```

### Separator / Divider

Separator component.

```html
<nofo-separator size="1|2|3|4" orientation="horizontal|vertical" decorative />

<!-- Or use divider -->
<nofo-divider orientation="horizontal|vertical" />
```

### Callout

Callout component for highlights and notes.

```html
<nofo-callout size="1|2|3" variant="solid|soft|surface|outline" color="accent-color" high-contrast>
  <nofo-callout-icon>
    <nofo-icon name="info-circled"></nofo-icon>
  </nofo-callout-icon>
  <nofo-callout-text> Callout message </nofo-callout-text>
</nofo-callout>
```

### Data List

Data list for key-value pairs.

```html
<nofo-data-list size="1|2|3" orientation="horizontal|vertical" trim="normal|start|end|both">
  <nofo-data-list-item align="start|center|baseline">
    <nofo-data-list-label>Status</nofo-data-list-label>
    <nofo-data-list-value>
      <nofo-badge color="green">Active</nofo-badge>
    </nofo-data-list-value>
  </nofo-data-list-item>
</nofo-data-list>
```

## Interactive Components

### Accordion

Collapsible accordion component.

```html
<nofo-accordion
  type="single|multiple"
  value="{value}"
  onValueChange="{setValue}"
  defaultValue="item-1"
  collapsible
>
  <nofo-accordion-item value="item-1">
    <nofo-accordion-trigger>
      <nofo-heading size="4">Section 1</nofo-heading>
      <nofo-icon name="chevron-down"></nofo-icon>
    </nofo-accordion-trigger>
    <nofo-accordion-content> Content for section 1 </nofo-accordion-content>
  </nofo-accordion-item>
</nofo-accordion>
```

**Props:**

- `type` - "single" or "multiple"
- `value` / `defaultValue` - Selected item(s)
- `collapsible` - Allow closing selected item

**Events:**

- `value-change` - Dispatched on item open/close

### Collapsible

Simple collapsible content.

```html
<nofo-collapsible open="{isOpen}" onOpenChange="{setIsOpen}" defaultOpen="{false}">
  <nofo-collapsible-trigger>
    <nofo-heading size="4">Toggle</nofo-heading>
    <nofo-icon name="chevron-down"></nofo-icon>
  </nofo-collapsible-trigger>
  <nofo-collapsible-content> Collapsible content </nofo-collapsible-content>
</nofo-collapsible>
```

**Props:**

- `open` - Open state
- `defaultOpen` - Default open state

**Events:**

- `open-change` - Dispatched on open/close

### Toggle Group

Group of toggle buttons.

```html
<nofo-toggle-group
  type="single|multiple"
  value="{value}"
  onValueChange="{setValue}"
  size="1|2|3"
  variant="solid|soft|surface|outline"
>
  <nofo-toggle-group-item value="bold" aria-label="Bold">
    <nofo-icon name="bold"></nofo-icon>
  </nofo-toggle-group-item>
  <nofo-toggle-group-item value="italic" aria-label="Italic">
    <nofo-icon name="italic"></nofo-icon>
  </nofo-toggle-group-item>
</nofo-toggle-group>
```

**Props:**

- `type` - "single" or "multiple"
- `value` / `defaultValue` - Selected value(s)
- `size` - Toggle size
- `variant` - Visual variant

**Events:**

- `value-change` - Dispatched on selection change

### Segmented Control

Segmented control for mutually exclusive options.

```html
<nofo-segmented-control
  value="{selected}"
  onValueChange="{setSelected}"
  defaultValue="list"
  size="1|2|3"
  variant="solid|soft|surface"
>
  <nofo-segmented-control-item value="list">
    <nofo-icon name="list"></nofo-icon>
    List
  </nofo-segmented-control-item>
  <nofo-segmented-control-item value="grid">
    <nofo-icon name="grid"></nofo-icon>
    Grid
  </nofo-segmented-control-item>
</nofo-segmented-control>
```

**Props:**

- `value` / `defaultValue` - Selected value
- `size` - Control size
- `variant` - Visual variant

**Events:**

- `value-change` - Dispatched on selection change

### Steps

Step indicator component.

```html
<nofo-steps
  value="{currentStep}"
  onValueChange="{setCurrentStep}"
  defaultValue="1"
  orientation="horizontal|vertical"
>
  <nofo-steps-list>
    <nofo-steps-item value="1" status="complete">
      <nofo-steps-trigger>
        <nofo-steps-indicator>1</nofo-steps-indicator>
        <nofo-steps-title>Step 1</nofo-steps-title>
      </nofo-steps-trigger>
      <nofo-steps-content> Content for step 1 </nofo-steps-content>
    </nofo-steps-item>
  </nofo-steps-list>
</nofo-steps>
```

**Props:**

- `value` / `defaultValue` - Current step value
- `orientation` - Step orientation

**Events:**

- `value-change` - Dispatched on step change

### Rating

Star rating component.

```html
<nofo-rating
  value="{rating}"
  onValueChange="{setRating}"
  defaultValue="{0}"
  max="{5}"
  size="1|2|3"
  color="accent-color"
  disabled
  readOnly
>
</nofo-rating>
```

**Props:**

- `value` / `defaultValue` - Rating value (0-max)
- `max` - Maximum rating (default: 5)
- `size` - Star size
- `disabled` - Disabled state
- `readOnly` - Read-only state

**Events:**

- `value-change` - Dispatched on rating change

### Command Menu

Command palette component (Cmd/Ctrl + K).

```html
<nofo-command-menu open="{isOpen}" onOpenChange="{setIsOpen}">
  <nofo-command-menu-trigger>
    <nofo-button variant="soft">
      <nofo-icon name="magnifying-glass"></nofo-icon>
      Search...
    </nofo-button>
  </nofo-command-menu-trigger>

  <nofo-command-menu-content>
    <nofo-command-menu-input placeholder="Type a command..." />

    <nofo-command-menu-list>
      <nofo-command-menu-empty>No results found.</nofo-command-menu-empty>

      <nofo-command-menu-group heading="Suggestions">
        <nofo-command-menu-item value="calendar">
          <nofo-icon name="calendar"></nofo-icon>
          Calendar
        </nofo-command-menu-item>
      </nofo-command-menu-group>

      <nofo-command-menu-separator></nofo-command-menu-separator>
    </nofo-command-menu-list>
  </nofo-command-menu-content>
</nofo-command-menu>
```

**Props:**

- `open` - Open state

**Events:**

- `open-change` - Dispatched on open/close
- `select` - Dispatched on item selection

**Keyboard:**

- `Cmd/Ctrl + K` - Open command menu
- `Escape` - Close command menu
- `Arrow Up/Down` - Navigate items
- `Enter` - Select item

## Utility Components

### Theme

Theme provider component.

```html
<nofo-theme
  appearance="light|dark|inherit"
  accent-color="gray|gold|bronze|brown|yellow|amber|orange|tomato|red|ruby|crimson|pink|plum|purple|violet|iris|indigo|blue|cyan|teal|jade|green|grass|lime|mint|sky"
  gray-color="gray|mauve|slate|sage|olive|sand"
  panel-background="solid|translucent"
  radius="none|small|medium|large|full"
  scaling="90%|95%|100%|105%|110%"
>
  <!-- Your app -->
</nofo-theme>
```

**Props:**

- `appearance` - Color scheme
- `accent-color` - Accent color palette
- `gray-color` - Gray color palette
- `panel-background` - Panel background style
- `radius` - Border radius scale
- `scaling` - Size scaling factor

### Portal

Portal for rendering content outside DOM hierarchy.

```html
<nofo-portal>
  <nofo-dialog>
    <!-- Dialog content -->
  </nofo-dialog>
</nofo-portal>
```

### Visually Hidden

Screen reader only content.

```html
<nofo-visually-hidden> Screen reader only text </nofo-visually-hidden>
```

### Loading Overlay

Loading overlay with spinner.

```html
<nofo-loading-overlay loading="{isLoading}">
  <nofo-box p="4"> Content that will be covered when loading </nofo-box>
</nofo-loading-overlay>
```

**Props:**

- `loading` - Show/hide overlay

### Reset

CSS reset utility for child elements.

```html
<nofo-reset>
  <article>
    <h1>Article Title</h1>
    <p>Article content with reset styles.</p>
  </article>
</nofo-reset>
```

### Icon

Icon component (requires icon library integration).

```html
<nofo-icon name="chevron-down" size="sm|md|lg"></nofo-icon>
```

**Props:**

- `name` - Icon name
- `size` - Icon size

### Aspect Ratio

Maintain aspect ratio for content.

```html
<nofo-aspect-ratio ratio="16/9">
  <img src="/image.jpg" alt="Description" />
</nofo-aspect-ratio>
```

**Props:**

- `ratio` - Aspect ratio (e.g., "16/9", "1/1", "4/3")

### Inset

Inset component for bleeding content to card edges.

```html
<nofo-card>
  <nofo-inset clip="padding-box|border-box" side="all|top|right|bottom|left|x|y" p="current">
    <img src="/image.jpg" alt="Cover" />
  </nofo-inset>
  <nofo-text>Content below image</nofo-text>
</nofo-card>
```

**Props:**

- `clip` - Clipping behavior
- `side` - Sides to bleed
- Padding props (`p`, `px`, `py`, etc.) - Padding values

## Theming

### Design Tokens

All components use CSS variables for theming:

```css
/* Spacing Scale */
--space-1 through --space-9

/* Color Scales */
--accent-1 through --accent-12
--gray-1 through --gray-12

/* Typography */
--font-size-1 through --font-size-9
--line-height-1 through --line-height-9
--letter-spacing-1 through --letter-spacing-9

/* Colors */
--color-background
--color-panel-solid
--color-panel-translucent

/* Radius */
--radius (inherited from theme)

/* Scaling */
--scaling (inherited from theme)
```

### Customizing Themes

Override CSS variables in your stylesheet:

```css
nofo-theme {
  --accent-9: #your-color;
  --gray-6: #your-gray;
  --radius: 0.5rem;
}
```

## Events

### Event Handling

All components dispatch custom events that bubble and are composed:

```javascript
// Listen for value changes
const select = document.querySelector("nofo-select");
select.addEventListener("value-change", (e) => {
  console.log("New value:", e.detail.value);
});

// Listen for open changes
const dialog = document.querySelector("nofo-dialog");
dialog.addEventListener("open-change", (e) => {
  console.log("Dialog open:", e.detail.open);
});

// Listen for button clicks
const button = document.querySelector("nofo-button");
button.addEventListener("nofo-click", () => {
  console.log("Button clicked!");
});
```

### Event Detail Objects

Events include `detail` objects with relevant data:

- `value-change`: `{ value }`
- `checked-change`: `{ checked }`
- `open-change`: `{ open }`
- `page-change`: `{ page }`
- `form-submit`: `{ formData }`

## Accessibility

### ARIA Attributes

Components automatically include appropriate ARIA attributes:

- `aria-label` for icon-only buttons
- `aria-expanded` for collapsible components
- `aria-selected` for selected items
- `aria-disabled` for disabled components
- `role` attributes where semantic HTML isn't sufficient

### Keyboard Navigation

All interactive components support keyboard navigation:

- **Dialog**: `Escape` to close, `Tab` to navigate, `Enter` to confirm
- **Dropdown Menu**: `Arrow` keys to navigate, `Enter` to select
- **Command Menu**: `Cmd/Ctrl + K` to open, `Arrow` keys to navigate
- **Tabs**: `Arrow` keys to navigate between tabs
- **Accordion**: `Arrow` keys to navigate between items

### Focus Management

- Focus is trapped in modals and dialogs
- Focus is restored when overlays close
- Focus indicators are visible for keyboard navigation

## Best Practices

### 1. Always Use Theme Component

Wrap your application with `nofo-theme` to enable design tokens:

```html
<nofo-theme accent-color="blue" gray-color="slate">
  <!-- Your app -->
</nofo-theme>
```

### 2. Use Semantic HTML

Prefer semantic components over generic ones:

```html
<!-- Good -->
<nofo-heading as="h1">Title</nofo-heading>

<!-- Less ideal -->
<nofo-text size="8" weight="bold">Title</nofo-text>
```

### 3. Handle Events Properly

Always handle component events:

```javascript
const checkbox = document.querySelector("nofo-checkbox");
checkbox.addEventListener("checked-change", (e) => {
  // Update your application state
  updateState(e.detail.checked);
});
```

### 4. Use Compound Components

Leverage compound component patterns:

```html
<!-- Good - Compound component -->
<nofo-card>
  <nofo-card-header>
    <nofo-card-title>Title</nofo-card-title>
  </nofo-card-header>
  <nofo-card-content>Content</nofo-card-content>
</nofo-card>

<!-- Less ideal - Manual styling -->
<nofo-box style="border: 1px solid...">
  <nofo-heading>Title</nofo-heading>
  <nofo-text>Content</nofo-text>
</nofo-box>
```

### 5. Leverage Data Attributes for Styling

Use data attributes for state-based styling:

```css
/* Style based on component state */
nofo-button[data-disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

nofo-dialog[data-state="open"] {
  display: block;
}

nofo-toggle-group-item[data-state="on"] {
  background-color: var(--accent-9);
}
```

### 6. Use Responsive Props

Use object syntax for responsive values:

```html
<nofo-box
  p='{ "initial": "2", "sm": "4", "lg": "6" }'
  display='{ "initial": "none", "md": "block" }'
></nofo-box>
```

### 7. Compose Components

Build complex UIs by composing components:

```html
<nofo-card>
  <nofo-card-header>
    <nofo-flex align="center" justify="between">
      <nofo-heading size="4">Title</nofo-heading>
      <nofo-icon-button variant="ghost">
        <nofo-icon name="dots-horizontal"></nofo-icon>
      </nofo-icon-button>
    </nofo-flex>
  </nofo-card-header>
  <nofo-card-content>
    <nofo-text>Content</nofo-text>
  </nofo-card-content>
  <nofo-card-footer>
    <nofo-flex gap="3" justify="end">
      <nofo-button variant="soft">Cancel</nofo-button>
      <nofo-button>Save</nofo-button>
    </nofo-flex>
  </nofo-card-footer>
</nofo-card>
```

## Examples

### Complete Form Example

```html
<nofo-theme accent-color="blue" gray-color="slate">
  <nofo-card>
    <nofo-card-header>
      <nofo-card-title>Create Account</nofo-card-title>
      <nofo-card-description> Fill in your information to get started </nofo-card-description>
    </nofo-card-header>

    <nofo-card-content>
      <nofo-form onSubmit="{handleSubmit}">
        <nofo-flex direction="column" gap="4">
          <nofo-flex direction="column" gap="2">
            <nofo-text as="label" size="2" weight="bold"> Full Name </nofo-text>
            <nofo-text-field name="fullName" placeholder="John Doe" required />
          </nofo-flex>

          <nofo-flex direction="column" gap="2">
            <nofo-text as="label" size="2" weight="bold"> Email </nofo-text>
            <nofo-text-field name="email" type="email" placeholder="john@example.com" required>
              <nofo-text-field-slot name="prefix">
                <nofo-icon name="envelope-closed"></nofo-icon>
              </nofo-text-field-slot>
            </nofo-text-field>
          </nofo-flex>

          <nofo-checkbox name="terms" required>
            <nofo-text>I agree to the terms and conditions</nofo-text>
          </nofo-checkbox>

          <nofo-flex gap="3" justify="end">
            <nofo-button type="button" variant="soft" color="gray"> Cancel </nofo-button>
            <nofo-button type="submit"> Create Account </nofo-button>
          </nofo-flex>
        </nofo-flex>
      </nofo-form>
    </nofo-card-content>
  </nofo-card>
</nofo-theme>
```

### Dashboard Layout

```html
<nofo-theme accent-color="indigo" gray-color="slate">
  <nofo-box min-height="100vh">
    <!-- Header -->
    <nofo-box
      position="sticky"
      top="0"
      p="4"
      style="background: var(--color-panel-solid); border-bottom: 1px solid var(--gray-6);"
    >
      <nofo-container size="4">
        <nofo-flex align="center" justify="between">
          <nofo-heading size="5">Dashboard</nofo-heading>
          <nofo-flex gap="3">
            <nofo-button variant="ghost">Settings</nofo-button>
            <nofo-button>New Item</nofo-button>
          </nofo-flex>
        </nofo-flex>
      </nofo-container>
    </nofo-box>

    <!-- Main Content -->
    <nofo-section size="3">
      <nofo-container size="3">
        <nofo-grid columns='{ "initial": "1", "md": "2", "lg": "3" }' gap="4">
          <nofo-card>
            <nofo-card-content>
              <nofo-heading size="4">Card 1</nofo-heading>
              <nofo-text>Card content</nofo-text>
            </nofo-card-content>
          </nofo-card>
          <!-- More cards -->
        </nofo-grid>
      </nofo-container>
    </nofo-section>
  </nofo-box>
</nofo-theme>
```

### Data Table with Actions

```html
<nofo-card>
  <nofo-card-header>
    <nofo-card-title>Users</nofo-card-title>
  </nofo-card-header>
  <nofo-card-content>
    <nofo-table>
      <nofo-table-header>
        <nofo-table-row>
          <nofo-table-column-header-cell>Name</nofo-table-column-header-cell>
          <nofo-table-column-header-cell>Email</nofo-table-column-header-cell>
          <nofo-table-column-header-cell>Role</nofo-table-column-header-cell>
          <nofo-table-column-header-cell></nofo-table-column-header-cell>
        </nofo-table-row>
      </nofo-table-header>

      <nofo-table-body>
        <nofo-table-row>
          <nofo-table-row-header-cell>John Doe</nofo-table-row-header-cell>
          <nofo-table-cell>john@example.com</nofo-table-cell>
          <nofo-table-cell>
            <nofo-badge color="blue">Admin</nofo-badge>
          </nofo-table-cell>
          <nofo-table-cell>
            <nofo-dropdown-menu>
              <nofo-dropdown-menu-trigger>
                <nofo-icon-button variant="ghost">
                  <nofo-icon name="dots-horizontal"></nofo-icon>
                </nofo-icon-button>
              </nofo-dropdown-menu-trigger>
              <nofo-dropdown-menu-content>
                <nofo-dropdown-menu-item>Edit</nofo-dropdown-menu-item>
                <nofo-dropdown-menu-item>Delete</nofo-dropdown-menu-item>
              </nofo-dropdown-menu-content>
            </nofo-dropdown-menu>
          </nofo-table-cell>
        </nofo-table-row>
      </nofo-table-body>
    </nofo-table>
  </nofo-card-content>
</nofo-card>
```

## Component Checklist

When using components, ensure:

- ✅ Component is wrapped in `nofo-theme`
- ✅ All required props are provided
- ✅ Events are handled appropriately
- ✅ Accessibility attributes are set (aria-label for icon buttons)
- ✅ Responsive values use object syntax where needed
- ✅ Data attributes are used for styling hooks
- ✅ Compound components are used correctly

## Browser Support

Nofo components use modern web standards:

- **Web Components** (Custom Elements, Shadow DOM)
- **ES6+ JavaScript**
- **CSS Custom Properties**

Supported in all modern browsers:

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Contributing

When contributing new components:

1. Follow existing component patterns
2. Include data attributes for styling hooks
3. Support both controlled and uncontrolled patterns
4. Dispatch appropriate custom events
5. Include accessibility attributes
6. Document all props and events
7. Add examples in the README

## License

[Your License Here]

---

**Built with ❤️ using Web Components**
