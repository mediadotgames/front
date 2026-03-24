import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout.tsx";
import { HeatmapPage } from "./pages/HeatmapPage.tsx";
import { PiqaPage } from "./pages/PiqaPage.tsx";
import { TopicPage } from "./pages/TopicPage.tsx";
import { DocsPage } from "./pages/DocsPage.tsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HeatmapPage />} />
          <Route path="piqa" element={<PiqaPage />} />
          <Route path="topic/:id" element={<TopicPage />} />
          <Route path="docs" element={<DocsPage />} />
          <Route path="docs/:section" element={<DocsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
