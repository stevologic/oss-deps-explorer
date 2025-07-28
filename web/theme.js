const { createTheme } = MaterialUI;

const sentinelTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#00e5ff" },
    secondary: { main: "#9c27b0" },
    background: {
      default: "#0d1117",
      paper: "#161b22",
    },
    success: { main: "#00e676" },
    warning: { main: "#ffc107" },
    error: { main: "#ff5252" },
  },
  typography: {
    fontFamily: "Roboto, monospace",
  },
});
