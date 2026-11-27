// Server-safe: the root layout inlines this, so it must not pull in React hooks.
export const THEME_KEY = 'sarwa.theme';

// Runs before first paint so a saved theme never flashes; with no choice the OS decides (theme.css).
export const themeScript = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.classList.add(t)}catch(e){}`;
