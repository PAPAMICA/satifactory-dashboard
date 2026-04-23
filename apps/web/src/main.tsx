import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./i18n";
import "./index.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      /* Données à jour au retour sur l’onglet / reconnexion réseau, sans recharger la page. */
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 0,
      /* refetchInterval continue même si l’onglet n’est pas au premier plan. */
      refetchIntervalInBackground: true,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
