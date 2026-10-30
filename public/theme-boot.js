// Runs before the first paint (a classic script in index.html's head; the CSP forbids inline
// ones): applies the theme the app saved last time (ThemeController), so the start screen
// already has the right colours. "system" and a first start follow the operating system.
try {
  const preference = localStorage.getItem("noblame.theme");
  const dark =
    preference === "dark" ||
    (preference !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
} catch {
  // No storage: the light theme until the settings load.
}
