"use client";

import { BsMoonFill, BsSunFill } from "react-icons/bs";
import { useEffect, useState } from "react";

type Theme = "light" | "dracula";

const themes: Record<Theme, Theme> = {
  light: "light",
  dracula: "dracula",
};

const getThemeFromLocalStorage = (): Theme => {
  if (typeof window !== "undefined") {
    return (localStorage.getItem("theme") as Theme | null) ?? themes.light;
  }
  return themes.light;
};

const ThemeToggle = () => {
  const initTheme = getThemeFromLocalStorage();
  const [theme, setTheme] = useState<Theme | null>(initTheme);
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    const localTheme = getThemeFromLocalStorage();
    document.documentElement.setAttribute("data-theme", localTheme);
    setTheme(localTheme);
    setIsThemeReady(true);
  }, []);

  const handleClick = () => {
    const newTheme = theme === themes.light ? themes.dracula : themes.light;
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    setTheme(newTheme);
  };

  if (!isThemeReady) return null;

  return (
    <button onClick={handleClick} className='btn btn-sm btn-outline transition-all'>
      {theme === "light" ? (
        <BsMoonFill className='h-4 w-4 ' />
      ) : (
        <BsSunFill className='h-4 w-4 ' />
      )}
    </button>
  );
};
export default ThemeToggle;
