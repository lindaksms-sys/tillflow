import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js?v=2')
      .then((reg) => {
        console.log('SW registered:', reg.scope);
        return reg.update();
      })
      .catch((err) => console.log('SW registration failed:', err));
  });
}
