import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import backgroundImage from "../assets/background.jpg";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Simulate a fake login delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("✅ Redirecting to /admin ...");
      navigate("/admin", { replace: true });
    } catch (err) {
      console.error("❌ Login failed:", err);
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ ...styles.container, backgroundImage: `url(${backgroundImage})` }}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>Bingwa Sokoni</h1>
        <p style={styles.headerSubtitle}>Login to access your dashboard</p>
      </header>

      <div style={styles.formContainer}>
        <h2 style={styles.heading}>Login</h2>
        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            style={styles.input}
          />
          <button
            type="submit"
            style={{
              ...styles.button,
              opacity: isLoading ? 0.6 : 1,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p style={styles.signUpText}>
          Don't have an account?{" "}
          <a href="/signup" style={styles.signUpLink}>
            Create an account
          </a>
        </p>
      </div>

      <footer style={styles.footer}>
        <p style={styles.footerText}>© 2025 Bingwa Sokoni. All rights reserved.</p>
      </footer>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100vh",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
  header: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    color: "white",
    padding: "1rem",
    textAlign: "center",
  },
  headerTitle: {
    fontSize: "32px",
    margin: 0,
  },
  headerSubtitle: {
    fontSize: "16px",
    margin: "0.5rem 0 0 0",
  },
  formContainer: {
    maxWidth: "400px",
    width: "100%",
    padding: "2rem",
    backgroundColor: "#fff",
    borderRadius: "8px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    margin: "2rem auto",
    opacity: 0.9,
  },
  heading: {
    textAlign: "center",
    color: "#333",
    fontSize: "24px",
    marginBottom: "1.5rem",
  },
  input: {
    padding: "0.8rem",
    width: "100%",
    marginBottom: "1rem",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "16px",
    outline: "none",
    transition: "border-color 0.3s ease",
  },
  button: {
    width: "100%",
    padding: "0.8rem",
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "16px",
    cursor: "pointer",
    transition: "background-color 0.3s ease",
  },
  error: {
    color: "red",
    textAlign: "center",
    marginBottom: "1rem",
    padding: "0.5rem",
    backgroundColor: "#fee",
    borderRadius: "4px",
  },
  signUpText: {
    textAlign: "center",
    marginTop: "1rem",
    color: "#333",
  },
  signUpLink: {
    color: "#2563eb",
    textDecoration: "none",
  },
  footer: {
    backgroundColor: "#333",
    color: "white",
    textAlign: "center",
    padding: "1rem",
    marginTop: "auto",
  },
  footerText: {
    margin: 0,
    fontSize: "14px",
  },
};

export default LoginPage;
