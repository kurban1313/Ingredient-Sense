import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import CameraView from "./components/mobile/CameraView";
import { SplashScreen } from "./components/mobile/SplashScreen";

function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<CameraView />} />
      </Routes>
    </Router>
  );
}

export default App;
