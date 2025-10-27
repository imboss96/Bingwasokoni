import { BrowserRouter as Router, Routes, Route } from "react-router-dom"; // Use Routes instead of Switch
import LandingPage from "./pages/LandingPage";
import AdminPage from "./pages/AdminPage";
import { AuthProvider } from "./contexts/authContext"; // Import the AuthProvider
import LoginPage from "./pages/LoginPage"; // Import LoginPage
import SignUpPage from "./pages/SignupPage"; // signup

function App() {
  return (
    <AuthProvider> {/* Wrap your entire Router with AuthProvider */}
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/login" element={<LoginPage />} /> {/* Add the login route */}
          <Route path="/signup" element={<SignUpPage />} /> {/* Fixed this line */}
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
