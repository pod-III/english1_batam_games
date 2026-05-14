# Tooltip Design System (Class Tally)

This document outlines the design and implementation of the custom tooltip system used in the Class Tally tool. The system is designed to provide minimal, high-fidelity feedback for interactive elements.

## 1. Design Philosophy
The tooltip system follows the **Soft Brutalist** and **Premium Aesthetic** guidelines of the KlassKit ecosystem:
- **Minimalist**: Single-line labels only. No distractions or complex layouts.
- **High Contrast**: Dark theme tooltips (`bg-slate-900/90`) on light backgrounds and vice-versa.
- **Glassmorphism**: Uses `backdrop-blur-md` for a premium, integrated feel.
- **Micro-Animations**: Features a subtle pop-in effect (`scale-95` to `scale-100`) and smooth opacity transitions.

## 2. Implementation Details

### HTML Structure
A singleton tooltip element is placed at the root of the `<body>`:
```html
<div id="tooltip" class="fixed z-[9999] pointer-events-none opacity-0 transition-opacity duration-200 bg-slate-900/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-slate-900 px-2 py-1 rounded-lg text-[10px] font-black border border-white/20 dark:border-black/10 shadow-xl scale-95 transition-transform duration-200 uppercase tracking-wider"></div>
```

### CSS Styling (Tailwind)
- **Background**: `bg-slate-900/90` with `backdrop-blur-md`.
- **Typography**: `text-[10px] font-black uppercase tracking-wider`.
- **Border**: `border border-white/20` (subtle glass border).
- **Shadow**: `shadow-xl` for depth.

### JavaScript Module
The `Tooltip` module handles global event delegation for any element with a `data-tooltip` attribute:

```javascript
const Tooltip = {
    init: () => {
        const el = document.getElementById('tooltip');
        if (!el) return;

        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                const content = target.getAttribute('data-tooltip');
                el.textContent = content;
                el.classList.remove('opacity-0', 'scale-95');
                el.classList.add('opacity-100', 'scale-100');
                
                const rect = target.getBoundingClientRect();
                const tooltipRect = el.getBoundingClientRect();
                
                let top = rect.top - tooltipRect.height - 10;
                let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                
                // Keep within screen
                if (top < 10) top = rect.bottom + 10;
                if (left < 10) left = 10;
                if (left + tooltipRect.width > window.innerWidth - 10) {
                    left = window.innerWidth - tooltipRect.width - 10;
                }
                
                el.style.top = `${top}px`;
                el.style.left = `${left}px`;
            }
        });

        document.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                el.classList.add('opacity-0', 'scale-95');
                el.classList.remove('opacity-100', 'scale-100');
            }
        });
    }
};
```

## 3. Usage
To add a tooltip to any interactive element, simply add the `data-tooltip` attribute:

```html
<button data-tooltip="Edit Student">
    <i data-lucide="pencil"></i>
</button>
```

## 4. Best Practices
1. **Short Labels**: Use 1-3 words (e.g., "Add Star", "Reset Score").
2. **Interactive Only**: Only apply to buttons, links, or complex UI toggles. Do not apply to static text or containers.
3. **Z-Index**: Ensure the `#tooltip` remains at `z-[9999]` to overlay modals and sidebars.
