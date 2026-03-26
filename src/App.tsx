import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.tsx";
import { Layout } from "./components/Layout.tsx";
import { HeatmapPage } from "./pages/HeatmapPage.tsx";
import { PiqaPage } from "./pages/PiqaPage.tsx";
import { TopicPage } from "./pages/TopicPage.tsx";
import { DocsPage } from "./pages/DocsPage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { SignupPage } from "./pages/SignupPage.tsx";
import { PreferencesPage } from "./pages/PreferencesPage.tsx";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HeatmapPage />} />
            <Route path="piqa" element={<PiqaPage />} />
            <Route path="topic/:id" element={<TopicPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="docs/:section" element={<DocsPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="preferences" element={<PreferencesPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
