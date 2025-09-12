# Jelli Web Onboarding Design Update

## Overview
Updated the jelli-web onboarding experience to match Phantom wallet's design patterns while maintaining a light, friendly, and approachable aesthetic.

## Design System

### Color Palette
- **Primary Gradient**: Purple to Pink (`from-purple-500 to-pink-500`)
- **Background**: Soft gradient (`from-blue-50 via-purple-50 to-pink-50`)
- **Cards**: Clean white with subtle shadows
- **Text**: Gray scale for hierarchy (`text-gray-900`, `text-gray-600`, `text-gray-500`)

### Typography
- **Headings**: Bold, centered, clear hierarchy
- **Body**: Readable, friendly tone
- **Labels**: Subtle but clear guidance

### Components

#### Screen Layout
- Centered card design with gradient background
- Subtle decorative elements (gradient circles)
- Responsive padding and sizing
- Maximum width container for optimal reading

#### Buttons
- **Primary**: Gradient background with hover effects and transform
- **Secondary**: Light gray with subtle borders
- **Outline**: Transparent with colored borders
- **Loading States**: Integrated spinners with text
- **Focus States**: Purple ring for accessibility

#### PIN Input
- Visual PIN entry with dots for privacy
- 4 individual input boxes with focus states
- Responsive sizing for mobile devices
- Hidden actual input for accessibility

#### Progress Indicator
- Clean progress bar with gradient fill
- Step counter and percentage display
- Smooth animations

#### Loading States
- Consistent spinner design
- Contextual loading messages
- Smooth transitions

## Screen Designs

### 1. Welcome Screen
- Jelli logo with gradient background
- Clear value proposition
- Single primary action (Sign In with Google)
- Friendly, welcoming tone

### 2. Choice Screen  
- Personalized greeting with user's name
- Two clear options: Create or Recover
- Visual hierarchy with primary/secondary buttons
- Friendly emoji and messaging

### 3. PIN Creation Screen
- Visual PIN input with confirmation
- Progressive disclosure (show confirm after first PIN)
- Password setup integrated seamlessly
- Clear security messaging

### 4. Recovery Screen
- Welcoming back messaging
- Same visual PIN input
- Password setup for daily use
- Clear instructions

### 5. Loading Screen
- Dedicated loading state during wallet creation/recovery
- Spinner with contextual messaging
- Progress updates
- Calming design to reduce anxiety

### 6. Completion Screen
- Celebration with emoji and animation
- Clear success messaging
- Security reminder card
- Single clear next action

## Key Improvements

### UX Enhancements
- **Progressive Disclosure**: Show elements as needed
- **Clear Navigation**: Progress indicator shows where users are
- **Contextual Messaging**: Different messages for create vs recover
- **Loading States**: Dedicated screens for processing states
- **Error Handling**: Beautiful error messages with helpful context

### Visual Improvements
- **Modern Design**: Rounded corners, gradients, shadows
- **Consistent Spacing**: Systematic spacing scale
- **Color Hierarchy**: Clear visual hierarchy with color
- **Responsive Design**: Works on all screen sizes
- **Accessibility**: Focus states, semantic HTML, screen reader support

### Technical Features
- **Maintained Functionality**: All existing wallet logic preserved
- **Performance**: Lightweight components with smooth animations
- **Responsive**: Mobile-first design with desktop enhancements
- **Clean Code**: Reusable component system

## Responsive Design

### Mobile (< 640px)
- Smaller padding and margins
- Reduced PIN input size
- Optimized button sizing
- Comfortable touch targets

### Desktop (≥ 640px)
- Larger spacing and elements
- Enhanced visual effects
- Optimal reading width
- Hover states and animations

## Accessibility Features
- Semantic HTML structure
- Focus management for PIN input
- Screen reader friendly labels
- Keyboard navigation support
- High contrast colors
- Clear error messaging

## Browser Compatibility
- Modern browsers with CSS Grid and Flexbox
- Tailwind CSS for consistent styling
- Graceful degradation for older browsers
- Touch-friendly on mobile devices

## Future Enhancements
- Dark mode support
- More animation and micro-interactions
- Additional security features UI
- Multi-language support
- Enhanced accessibility features

---

The new design successfully combines Phantom's proven UX patterns with Jelli's unique seedless wallet value proposition, creating a welcoming and trustworthy onboarding experience.
