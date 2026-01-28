import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const themes = {
    neutral: {
        primary: '#6366f1',
        background: '#f8fafc',
        text: '#1e293b',
        secondaryText: '#64748b',
        chatBubble: '#ffffff',
        accent: '#e2e8f0',
    },
    happy: {
        primary: '#22c55e',
        background: '#f0fdf4',
        text: '#14532d',
        secondaryText: '#166534',
        chatBubble: '#dcfce7',
        accent: '#bbf7d0',
    },
    sad: {
        primary: '#60a5fa',
        background: '#eff6ff',
        text: '#1e3a8a',
        secondaryText: '#1e40af',
        chatBubble: '#dbeafe',
        accent: '#bfdbfe',
    },
    angry: {
        primary: '#f87171',
        background: '#fef2f2',
        text: '#7f1d1d',
        secondaryText: '#991b1b',
        chatBubble: '#fee2e2',
        accent: '#fecaca',
    },
    dark: {
        primary: '#818cf8',
        background: '#0f172a',
        text: '#f8fafc',
        secondaryText: '#94a3b8',
        chatBubble: '#1e293b',
        accent: '#334155',
    }
};

export const ThemeProvider = ({ children }) => {
    const [currentTheme, setCurrentTheme] = useState('neutral');
    const [manualOverride, setManualOverride] = useState(false);

    const setThemeByEmotion = (emotion) => {
        if (manualOverride) return; // Respect user's manual choice

        if (themes[emotion]) {
            setCurrentTheme(emotion);
        } else {
            setCurrentTheme('neutral');
        }
    };

    const toggleTheme = () => {
        setManualOverride(true);
        const themeKeys = Object.keys(themes);
        const currentIndex = themeKeys.indexOf(currentTheme);
        const nextIndex = (currentIndex + 1) % themeKeys.length;
        setCurrentTheme(themeKeys[nextIndex]);
    };

    const resetToAuto = () => {
        setManualOverride(false);
    };

    const value = {
        theme: themes[currentTheme],
        themeName: currentTheme,
        manualOverride,
        setThemeByEmotion,
        toggleTheme,
        resetToAuto
    };

    useEffect(() => {
        const root = document.documentElement;
        const theme = themes[currentTheme];
        Object.keys(theme).forEach(key => {
            root.style.setProperty(`--theme-${key}`, theme[key]);
        });
    }, [currentTheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
