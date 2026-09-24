import React from "react";
// SEO ADD (prerender): hydrateRoot for prerendered HTML, createRoot as fallback.
// react-snap prerenders each route to static HTML at build time. If we always
// call createRoot(...).render(...), React discards that prerendered markup
// and re-renders from scratch on the client — the crawler-visible HTML still
// has real content (good), but users get a blank-then-repaint flash, and any
// react-snap-injected DOM isn't reused. hydrateRoot attaches to the existing
// markup instead, matching what react-snap generated.
import { hydrateRoot, createRoot } from "react-dom/client";
// SEO ADD: HelmetProvider enables per-page <title>/meta via <SEO> component
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ChatProvider } from "./context/ChatContext";
import App from "./App";
import "./index.css";

const app = (
  <React.StrictMode>
    <HelmetProvider>
      <ThemeProvider>
        <AuthProvider>
          <ChatProvider>
            <App />
          </ChatProvider>
        </AuthProvider>
      </ThemeProvider>
    </HelmetProvider>
  </React.StrictMode>
);

const rootElement = document.getElementById("root");

// A prerendered page arrives with children already inside #root.
// A normal (non-prerendered) first load has an empty #root.
if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, app);
} else {
  createRoot(rootElement).render(app);
}
