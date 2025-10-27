import React, { createContext, useContext, useState, useEffect } from "react";

// Create context
const AuthContext = createContext();

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  // On mount, check for a stored token and validate it with the backend
  useEffect(() => {
    const initAuth = async () => {
      try {
        let token = null;
        try {
          token = localStorage.getItem("authToken");
        } catch (storageErr) {
          console.warn("localStorage unavailable during initAuth:", storageErr);
          token = null;
        }

        if (token) {
          const response = await fetch("/auth/check", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            if (data.user) {
              setUser(data.user);
              setIsAuthenticated(true);
            }
          } else {
            try { localStorage.removeItem("authToken"); } catch (e) { /* ignore */ }
          }
        }
      } catch (err) {
        console.error("Auth init failed:", err);
        try { localStorage.removeItem("authToken"); } catch (e) { /* ignore */ }
      }
    };

    initAuth();
  }, []);

  // Login function that calls your backend
  const login = async (email, password, options = {}) => {
    try {
      // Use the /auth/login endpoint (backend used this previously)
      const body = password ? { email, password } : { email };
  const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const text = await response.text().catch(() => "");
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { message: text }; }

      if (!response.ok) {
        // Surface backend error message when present
        const msg = (data && data.message) ? data.message : `Login failed (status ${response.status})`;
        throw new Error(msg);
      }

      console.log("🔍 Backend response:", data);

      // If backend returned user directly, set it
      if (data.user) {
        setUser(data.user);
        setIsAuthenticated(true);

        // persist token if returned and remember requested
        if (options.remember && data.token) {
          try { localStorage.setItem("authToken", data.token); } catch (e) { console.error("Failed to store token", e); }
        }

        return data;
      }

      // If backend returned only a token (typical for some flows), persist if requested and attempt to fetch user
      if (data.token) {
        if (options.remember) {
          try { localStorage.setItem("authToken", data.token); } catch (e) { console.error("Failed to store token", e); }
        }

        // try to validate token and fetch user
        try {
          const checkResp = await fetch("/auth/check", { headers: { Authorization: `Bearer ${data.token}` } });
          if (checkResp.ok) {
            const checkData = await checkResp.json();
            if (checkData.user) {
              setUser(checkData.user);
              setIsAuthenticated(true);
              return { token: data.token, user: checkData.user };
            }
          }
        } catch (e) {
          console.warn("Token validation failed:", e);
        }

        // If we reach here the backend likely expects a magic-link flow; return data so UI can inform the user
        return data;
      }

      // If no token or user returned, backend probably expects another step (e.g., magic link); return raw data
      return data;
    } catch (error) {
      console.error("❌ Login error:", error);
      setIsAuthenticated(false);
      setUser(null);
      throw error;
    }
  };

  // Signup function that registers a new user and optionally logs them in
  const signup = async (email, password) => {
    try {
      // Use the /auth/register endpoint to match /auth/login
  const response = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const text = await response.text().catch(() => "");
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { message: text }; }

      if (!response.ok) {
        const msg = data && data.message ? data.message : `Signup failed (status ${response.status})`;
        throw new Error(msg);
      }

      // If backend returns user info, set it and mark authenticated
      if (data.user) {
        setUser(data.user);
        setIsAuthenticated(true);
      }

      // If backend returned a token, persist it (useful for keep-signed-in flows)
      if (data.token) {
        try { localStorage.setItem("authToken", data.token); } catch (e) { console.error("Failed to store token", e); }
      }

      return data;
    } catch (err) {
      console.error("❌ Signup error:", err);
      throw err;
    }
  };

  // Logout function
  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    // remove persisted token when logging out
    try { localStorage.removeItem("authToken"); } catch (e) { /* ignore */ }
  };

  // Update password helper
  const updatePassword = async (currentPassword, newPassword) => {
    try {
      const response = await fetch("/auth/update-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Password update failed");
      }

      return await response.json();
    } catch (err) {
      console.error("❌ Update password error:", err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, updatePassword, signup }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to access auth context
export const useAuth = () => {
  return useContext(AuthContext);
};