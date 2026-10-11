import { AppProvider } from "./store/AppContext";
import { AppShell } from "./components/AppShell";

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
