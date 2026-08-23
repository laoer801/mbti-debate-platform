import { useState, useEffect, useCallback } from 'react'
import { ThemeMode, FontSize } from '../types'

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() =>
    (localStorage.getItem('mbti-theme') as ThemeMode) || 'dark')
  const [fontSize, setFontSize] = useState<FontSize>(() =>
    (localStorage.getItem('mbti-font') as FontSize) || 'normal')

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'high-contrast', 'font-large', 'font-xlarge')
    if (theme === 'dark') document.documentElement.classList.add('dark')
    if (theme === 'high-contrast') document.documentElement.classList.add('high-contrast')
    if (fontSize === 'large') document.documentElement.classList.add('font-large')
    if (fontSize === 'xlarge') document.documentElement.classList.add('font-xlarge')
    localStorage.setItem('mbti-theme', theme)
    localStorage.setItem('mbti-font', fontSize)
  }, [theme, fontSize])

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'light' ? 'dark' : t === 'dark' ? 'light' : 'light')
  }, [])

  return { theme, setTheme, fontSize, setFontSize, toggleTheme }
}
