tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    pink: '#FF6B95',
                    orange: '#FF8C42',
                    green: '#00E676',
                    blue: '#2979FF',
                    purple: '#A855F7',
                    dark: '#1e293b',
                    chalk: '#f8fafc',
                    blackboard: '#0f172a',
                    chalkboard: '#1e293b',
                }
            },
            fontFamily: {
                heading: ['Fredoka', 'sans-serif'],
                body: ['Nunito', 'sans-serif'],
            },
            boxShadow: {
                'neo': '4px 4px 0px 0px rgba(30, 41, 59, 1)',
                'neo-sm': '2px 2px 0px 0px rgba(30, 41, 59, 1)',
                'neo-pressed': '0px 0px 0px 0px rgba(30, 41, 59, 1)',
                'neo-white': '4px 4px 0px 0px rgba(255, 255, 255, 1)',
                'neo-sm-white': '2px 2px 0px 0px rgba(255, 255, 255, 1)',
            },
            borderWidth: {
                '3': '3px',
            },
            animation: {
                'pop-center': 'pop-in-center 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                'pop-left': 'pop-in-left 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                'fade-in': 'fade-in 0.3s ease-out forwards',
                'bounce-subtle': 'bounce-subtle 2s infinite',
            },
            keyframes: {
                'pop-in-center': {
                    '0%': { transform: 'translate(-50%, -50%) scale(0.5)', opacity: '0' },
                    '100%': { transform: 'translate(-50%, -50%) scale(1)', opacity: '1' }
                },
                'pop-in-left': {
                    '0%': { transform: 'translate(0, -50%) scale(0.5)', opacity: '0' },
                    '100%': { transform: 'translate(0, -50%) scale(1)', opacity: '1' }
                },
                'fade-in': {
                    '0%': { opacity: '0', transform: 'translateY(5px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },
                'bounce-subtle': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-5px)' }
                }
            }
        }
    }
}
