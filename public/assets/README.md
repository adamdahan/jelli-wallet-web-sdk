# Jelli Assets

This directory contains all branding assets for the Jelli wallet application.

## Directory Structure

```
assets/
├── logos/          # Main brand logos
├── icons/          # Step icons and smaller brand elements  
└── images/         # Screenshots, illustrations, etc.
```

## Brand Guidelines

### Colors
- **Brand Pink**: `#FF8EC8` (primary brand color)
- **Background**: Soft pink gradient (`#fef7f7` → `#fdf2f8` → `#fff1f2`)
- **Text**: Gray scale (`#111827`, `#4b5563`, `#6b7280`)
- **Success**: Green (`#22c55e`, `#f0fdf4`)
- **Info**: Blue (`#1d4ed8`, `#eff6ff`)
- **Warning**: Red (`#dc2626`, `#fef2f2`)
- **Card**: White with pink-tinted shadow (`0 4px 12px rgba(255, 142, 200, 0.15)`)

### Typography
- **Font Family**: `system-ui, -apple-system, Segoe UI, Roboto, sans-serif`
- **Headings**: Bold, centered
- **Body**: Regular weight, readable line height

## Assets

### Logos
- `light-logo.png` - Main brand logo (PNG format)
- Used on: Welcome screen, OAuth callback, main branding

### Icons  
- `jelli-icon.svg` - Compact icon version (32x32px)
- `step-welcome.svg` - Welcome/greeting step icon
- `step-security.svg` - Security/PIN step icon  
- `step-success.svg` - Success/completion step icon

### Usage Guidelines
- Always maintain aspect ratios
- Use drop-shadow filters for depth: `filter: 'drop-shadow(0 10px 25px rgba(139, 92, 246, 0.3))'`
- Ensure sufficient contrast on all backgrounds
- Test assets on both light and dark themes

## File Formats
- **SVG**: Preferred for icons and logos (scalable, small file size)
- **PNG**: For complex illustrations or photos
- **WEBP**: For optimized web delivery of images

## Adding New Assets
1. Follow the naming convention: `category-description.extension`
2. Optimize file sizes before adding
3. Add entries to this README
4. Test across different screen sizes and devices
