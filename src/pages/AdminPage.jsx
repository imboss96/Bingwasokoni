import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/authContext";

// The App component provides a dashboard for managing offers,
// transactions, M-Pesa payments, and system settings.
const App = () => {
  // State variables
  const [offers, setOffers] = useState([]);
  const [form, setForm] = useState({ name: "", price: "", id: null });
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [transactions, setTransactions] = useState([]);
  const [mpesaPayments, setMpesaPayments] = useState([]);
  const [transactionForm, setTransactionForm] = useState({
    type: "profit",
    amount: "",
    description: "",
    offerId: "",
    transactionRef: "",
    phoneNumber: ""
  });
  const [settings, setSettings] = useState({
    tillNumber: "",
    shortCode: "",
    environment: "sandbox",
    callbackUrl: ""
  });

  // --- New State for Time, User Info, and UI Elements ---
  const [currentTime, setCurrentTime] = useState(new Date());
  // Placeholder for auto-generated admin ID
  const [adminUserId] = useState("ADMN-94B3C5E0");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  // Placeholder for actual notifications
  const [notificationsList] = useState([
    { id: 1, text: "New M-Pesa payment received.", time: "10m ago" },
    { id: 2, text: "Offer 'Premium Package' updated.", time: "1h ago" },
    { id: 3, text: "System maintenance scheduled for tonight.", time: "3h ago" },
  ]);

  // --- Auth modal state ---
  const { isAuthenticated, user, login, signup, logout, updatePassword } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(!isAuthenticated);
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'signup'
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);


  // --- Utility Hooks & Functions ---

  /**
   * Displays a notification message for a short period.
   * @param {string} message - The message to display.
   * @param {'success'|'error'} [type='success'] - The type of notification.
   */
  const showAppNotification = useCallback((message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  /**
   * Generalized async data fetching function with exponential backoff.
   * NOTE: Uses relative URLs (e.g., '/offers'). Assumes a backend server is running
   * and serving these endpoints relative to the frontend's origin.
   * @param {string} url - The API endpoint (relative path).
   * @param {function} setData - The state setter function.
   * @param {string} [errorMsg] - Message for console on error.
   */
    const fetchData = useCallback(async (url, setData, errorMsg, retries = 3, delay = 500) => {
        let success = false; // Flag to track if fetch was successful
        try {
            setLoading(true); // Indicate loading state

            // --- RESTORED FETCH LOGIC ---
            const response = await fetch(url);
            if (!response.ok) {
                // If response is not ok, throw an error to trigger retry
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setData(data);
            success = true; // Mark as successful
            // --- END RESTORED FETCH LOGIC ---

        } catch (error) {
            console.error(`${errorMsg} (Attempt ${4 - retries}):`, error);
            if (retries > 0) {
                // Wait and retry
                await new Promise(resolve => setTimeout(resolve, delay));
                // Call recursively without awaiting, but manage loading state in finally
                fetchData(url, setData, errorMsg, retries - 1, delay * 2);
                return; // Prevent finally block from running prematurely in recursive calls
            } else {
                console.error(`Failed to fetch ${url} after multiple retries.`);
                showAppNotification(`Failed to load data from ${url}. Please check connection or try again later.`, "error");
                 // Set empty state on final failure to avoid crashes
                if (url === '/offers') setData([]);
                if (url === '/transactions') setData([]);
                if (url === '/mpesa/payments') setData([]);
                if (url === '/settings') setData({ tillNumber: "", shortCode: "", environment: "sandbox", callbackUrl: "" });
            }
        } finally {
             // **FIXED**: Only set loading to false on the final attempt (success or final failure)
            if (success || retries === 0) {
                 setLoading(false);
            }
        }
    }, [showAppNotification]); // Added showAppNotification dependency


  // Use useCallback for API calls to stabilize them for use in useEffect
  const fetchOffers = useCallback(() => fetchData("/offers", setOffers, "Error fetching offers:"), [fetchData]);
  const fetchTransactions = useCallback(() => fetchData("/transactions", setTransactions, "Error fetching transactions:"), [fetchData]);
  const fetchMpesaPayments = useCallback(() => fetchData("/mpesa/payments", setMpesaPayments, "Error fetching M-Pesa payments:"), [fetchData]);
  const fetchSettings = useCallback(() => fetchData("/settings", setSettings, "Error fetching settings:"), [fetchData]);

  // --- Effects ---

  // Real-time clock update
  useEffect(() => {
      const timer = setInterval(() => {
          setCurrentTime(new Date());
      }, 1000);

      return () => clearInterval(timer);
  }, []);

  // Keep modal visibility in sync with authentication state
  useEffect(() => {
    setShowAuthModal(!isAuthenticated);
  }, [isAuthenticated]);

  // Initial data load and continuous polling for transactions/payments
  useEffect(() => {
    fetchOffers();
    fetchTransactions();
    fetchMpesaPayments();
    fetchSettings();

    // Polling for live updates
    const interval = setInterval(() => {
      // Avoid polling if a fetch is already loading
      if (!loading) {
        fetchTransactions();
        fetchMpesaPayments();
      }
    }, 30000); // Poll every 30 seconds

    // Cleanup function
    return () => clearInterval(interval);
  }, [fetchOffers, fetchTransactions, fetchMpesaPayments, fetchSettings, loading]); // Added loading dependency


  // --- Derived State (useMemo) ---

  // Memoize financial calculations to avoid recalculating on every render
  const { totalProfits, totalLosses, netBalance, failedTransactions } = useMemo(() => {
    // Ensure transactions is an array before processing
    if (!Array.isArray(transactions)) {
        console.warn("Transactions data is not an array:", transactions); // Added warning
        return { totalProfits: 0, totalLosses: 0, netBalance: 0, failedTransactions: [] };
    }

    const profits = transactions
      .filter(t => t && typeof t === 'object' && t.type === "profit" && t.status === "success") // Added checks for valid transaction object
      .reduce((acc, t) => acc + parseFloat(t.amount || 0), 0);

    const losses = transactions
      .filter(t => t && typeof t === 'object' && t.type === "loss") // Added checks for valid transaction object
      .reduce((acc, t) => acc + parseFloat(t.amount || 0), 0);

    const balance = profits - losses;

    const failed = transactions.filter(t => t && typeof t === 'object' && t.status === "failed"); // Added checks for valid transaction object

    return {
      totalProfits: profits,
      totalLosses: losses,
      netBalance: balance,
      failedTransactions: failed || [], // Ensure failed is always an array
    };
  }, [transactions]); // Recalculate only when transactions change

  // --- Time Formatting ---
  const formattedTime = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const formattedDate = currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // --- Handlers ---

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);

    const isEdit = !!form.id;
    const url = isEdit ? `/offers/${form.id}` : "/offers";
    const method = isEdit ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, price: form.price }),
      });

      if (response.ok) {
        showAppNotification(isEdit ? "Offer updated successfully! 🎉" : "New offer added! 🎁");
        setForm({ name: "", price: "", id: null });
        fetchOffers();
      } else {
        throw new Error(`Failed to save offer - Status: ${response.status}`);
      }
    } catch (err) {
      showAppNotification("Error saving offer. Please try again.", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [form, fetchOffers, showAppNotification]); // Corrected dependency name

  const handleDelete = useCallback(async (id) => {
    // Using console.log instead of window.confirm
    console.log(`Attempting to delete offer: ${id}`);
    try {
        setLoading(true); // Indicate loading
        const response = await fetch(`/offers/${id}`, { method: "DELETE" });
        if (!response.ok) throw new Error(`Failed to delete offer - Status: ${response.status}`);
        showAppNotification("Offer deleted successfully! 🗑️");
        fetchOffers(); // Refresh the list
    } catch (err) {
      showAppNotification("Error deleting offer.", "error");
      console.error(err);
    } finally {
        setLoading(false); // Stop loading
    }
  }, [fetchOffers, showAppNotification]); // Corrected dependency name

  const handleEdit = useCallback((offer) => {
    // Basic check if offer is valid
    if(offer && offer._id) {
        setForm({ name: offer.name || '', price: offer.price || '', id: offer._id });
    } else {
        console.error("Invalid offer data provided to handleEdit:", offer);
    }
  }, []);

  const handleTransactionSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
        const response = await fetch("/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(transactionForm),
        });

      if (!response.ok) throw new Error(`Failed to add transaction - Status: ${response.status}`);

      showAppNotification("Transaction added successfully! ➕");
      setTransactionForm({ // Reset form
        type: "profit",
        amount: "",
        description: "",
        offerId: "",
        transactionRef: "",
        phoneNumber: ""
      });
      fetchTransactions(); // Refresh list
    } catch (err) {
      showAppNotification("Error adding transaction. Check your data.", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [transactionForm, fetchTransactions, showAppNotification]); // Corrected dependencies

  const handleDeleteTransaction = useCallback(async (id) => {
    // Using console.log instead of window.confirm
    console.log(`Attempting to delete transaction: ${id}`);
    try {
        setLoading(true); // Indicate loading
        const response = await fetch(`/transactions/${id}`, { method: "DELETE" });
        if (!response.ok) throw new Error(`Failed to delete transaction - Status: ${response.status}`);
        showAppNotification("Transaction deleted! ❌");
        fetchTransactions(); // Refresh list
    } catch (err) {
      showAppNotification("Error deleting transaction.", "error");
      console.error(err);
    } finally {
        setLoading(false); // Stop loading
    }
  }, [fetchTransactions, showAppNotification]); // Corrected dependencies

  const simulateCallback = useCallback(async (checkoutRequestID, success) => {
    setLoading(true); // Indicate processing
    try {
        const response = await fetch("/mpesa/simulate-callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checkoutRequestID, success }),
        });
        if (!response.ok) throw new Error(`Failed to simulate callback - Status: ${response.status}`);
        showAppNotification(`Payment ${success ? 'success' : 'failure'} simulated! 🔄`);
        // Re-fetch everything to ensure all related data is updated
        fetchTransactions();
        fetchMpesaPayments();
    } catch (err) {
      showAppNotification("Error simulating M-Pesa callback.", "error");
      console.error(err);
    } finally {
        setLoading(false);
    }
  }, [fetchTransactions, fetchMpesaPayments, showAppNotification]); // Corrected dependencies

  const handleSaveSettings = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
        const response = await fetch("/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settings), // Send the current settings state
        });

      if (response.ok) {
        showAppNotification("Settings saved successfully! ⚙️");
        // Optionally fetch settings again if the backend response doesn't return the updated settings
        // fetchSettings();
      } else {
        throw new Error(`API failed to save settings - Status: ${response.status}`);
      }
    } catch (err) {
      showAppNotification("Error saving settings.", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [settings, showAppNotification]); // Removed fetchSettings, assuming backend returns updated settings or UI reflects change immediately

  // --- Toggle Handlers for Popovers ---
  const toggleProfileMenu = () => {
    setShowProfileMenu(!showProfileMenu);
    setShowNotificationMenu(false); // Close other menu
  };

  const toggleNotificationMenu = () => {
    setShowNotificationMenu(!showNotificationMenu);
    setShowProfileMenu(false); // Close other menu
  };

  // Account settings modal state and handlers
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  const openAccountModal = () => {
    setShowProfileMenu(false);
    setShowAccountModal(true);
  };

  const handleAccountCancel = () => {
    setAccountForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setShowAccountModal(false);
  };

  const handleAccountSave = async (e) => {
    e.preventDefault();
    // basic validation
    if (accountForm.newPassword !== accountForm.confirmPassword) {
      showAppNotification("New passwords do not match", "error");
      return;
    }
    if (accountForm.newPassword.length < 6) {
      showAppNotification("Password must be at least 6 characters", "error");
      return;
    }
    try {
      await updatePassword(accountForm.currentPassword, accountForm.newPassword);
      showAppNotification("Password updated successfully!", "success");
      setShowAccountModal(false);
      setAccountForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      console.error("Failed to update password:", err);
      showAppNotification(err.message || "Failed to update password", "error");
    }
  };

  // Logout handler wired to auth context
  const handleLogoutClick = async (e) => {
    e && e.preventDefault();
    try {
      // call logout from auth context
      await logout();
      setShowProfileMenu(false);
      showAppNotification("Logged out successfully", "success");
      // Redirect to homepage after logout
      navigate('/');
    } catch (err) {
      console.error("Logout failed:", err);
      showAppNotification("Logout failed", "error");
    }
  };

  // --- Styles ---
  const styles = {
    // Container and layout
    container: { display: "flex", minHeight: "100vh", backgroundColor: "#f3f4f6", fontFamily: "Inter, sans-serif" }, // Lighter gray background
    sidebar: { width: "260px", backgroundColor: "#ffffff", borderRight: "1px solid #e5e7eb", position: "fixed", height: "100vh", overflowY: "auto", display: "flex", flexDirection: "column", boxShadow: "2px 0 5px rgba(0,0,0,0.05)" },
    mainContent: { flex: 1, marginLeft: "260px", padding: "0" },
    contentArea: { padding: "2rem" },

    // Logo and User Info in Sidebar
    logoContainer: { padding: "1.5rem 1rem 1rem 1rem", borderBottom: "1px solid #e5e7eb", marginBottom: "1rem" },
    logo: { fontSize: "1.4rem", fontWeight: "bold", color: "#10b981", marginBottom: "0.5rem", textAlign: "center" }, // Emerald color
    logoPlaceholder: { height: "40px", width: "auto", margin: "0 auto 0.5rem auto", display: "block", backgroundColor: "#f9fafb", borderRadius: "6px", padding: "0.5rem", border: "1px dashed #d1d5db", cursor: "pointer", textAlign: "center" },
    userInfo: { padding: "1rem", marginTop: "auto", borderTop: "1px solid #e5e7eb", backgroundColor: "#f9fafb" },

    // Top Bar
    topBar: { backgroundColor: "#ffffff", padding: "0.75rem 2rem", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
    timeDisplay: { display: 'flex', flexDirection: 'column', textAlign: 'left' },
    currentTime: { fontSize: "1.3rem", fontWeight: "600", color: "#1f2937" },
    currentDate: { fontSize: "0.85rem", color: "#6b7280" },
    topBarIcons: { display: "flex", gap: "0.5rem", alignItems: "center", position: "relative" }, // Reduced gap, added position relative
    iconButton: { background: "none", border: "none", padding: "0.5rem", borderRadius: "50%", cursor: "pointer", color: "#6b7280", transition: "background-color 0.2s, color 0.2s", position: "relative" }, // Added position relative for badge
    iconButtonHover: { backgroundColor: "#f3f4f6", color: "#1f2937" }, // Hover state
    notificationBadge: { position: 'absolute', top: '2px', right: '2px', width: '10px', height: '10px', backgroundColor: '#ef4444', borderRadius: '50%', border: '1px solid white' },

    // Popover Menus (Notifications & Profile)
    popover: { position: 'absolute', top: 'calc(100% + 10px)', right: 0, backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', width: '280px', zIndex: 110, border: '1px solid #e5e7eb', overflow: 'hidden' },
    popoverHeader: { padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem', fontWeight: '600', color: '#374151' },
    popoverContent: { maxHeight: '300px', overflowY: 'auto' },
    popoverItem: { display: 'block', width: '100%', padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#374151', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background-color 0.1s' },
    popoverItemHover: { backgroundColor: '#f9fafb' },
    popoverItemTime: { fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' },
    popoverFooter: { padding: '0.5rem 1rem', borderTop: '1px solid #e5e7eb', textAlign: 'center', fontSize: '0.8rem' },
    popoverLink: { color: '#10b981', textDecoration: 'none', fontWeight: '500' },

    // Page Title & Subtitle
    title: { color: "#1f2937", marginBottom: "0.5rem", fontSize: "1.8rem", fontWeight: "bold" }, // Slightly smaller title
    subtitle: { color: "#6b7280", marginBottom: "1.5rem", fontSize: "0.95rem" },

    // App Notification Bar
    notification: { color: "white", padding: "0.8rem 1.5rem", borderRadius: "8px", margin: "1rem 2rem", textAlign: "center", position: "sticky", top: "calc(0.75rem + 1rem + 1px + 1rem)", zIndex: 101, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }, // Adjusted top position

    // Sidebar Navigation
    navSection: { padding: "0 1rem" },
    navItem: { display: "flex", alignItems: "center", padding: "0.75rem 1rem", color: "#4b5563", textDecoration: "none", borderRadius: "8px", marginBottom: "0.25rem", cursor: "pointer", border: "none", backgroundColor: "transparent", width: "100%", textAlign: "left", fontSize: "0.9rem", fontWeight: "500", transition: "all 0.2s ease-in-out" }, // Slightly smaller font
    navItemActive: { backgroundColor: "#d1fae5", color: "#059669", fontWeight: "600" }, // Keep active style prominent
    navIcon: { marginRight: "0.75rem", fontSize: "1.1rem" }, // Slightly smaller icons

    // Summary Cards
    summaryCards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }, // Smaller min width
    card: { padding: "1.25rem", borderRadius: "10px", backgroundColor: "white", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.03)", transition: "transform 0.2s, box-shadow 0.2s" },
    cardHover: { transform: "translateY(-2px)", boxShadow: "0 4px 8px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.05)" }, // Subtle hover effect
    coloredCard: { color: "white", textAlign: "center" },
    cardIcon: { fontSize: "1.5rem", marginBottom: "0.5rem" }, // Smaller icon
    cardTitle: { fontSize: "0.8rem", marginBottom: "0.25rem", fontWeight: "600", color: "inherit", opacity: 0.9 }, // Inherit color, slightly bolder
    cardAmount: { fontSize: "1.6rem", fontWeight: "bold", marginBottom: "0.25rem", color: "inherit" }, // Inherit color
    cardSubtext: { fontSize: "0.75rem", opacity: 0.8, color: "inherit" }, // Inherit color

    // Forms
    formBox: { backgroundColor: "#fff", padding: "1.5rem", borderRadius: "10px", marginBottom: "2rem", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.03)" },
    input: { width: "100%", padding: "0.75rem 1rem", marginBottom: "1rem", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.9rem", boxSizing: "border-box", transition: "border-color 0.2s, box-shadow 0.2s", outline: "none" },
    inputFocus: { borderColor: "#10b981", boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.2)" }, // Focus style
    button: { width: "100%", backgroundColor: "#10b981", color: "white", border: "none", padding: "0.75rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "600", marginBottom: "0.5rem", transition: "background-color 0.2s", opacity: loading ? 0.7 : 1 },
    buttonHover: { backgroundColor: "#059669" }, // Darker green on hover
    cancelButton: { width: "100%", backgroundColor: "#6b7280", color: "white", border: "none", padding: "0.75rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "600", transition: "background-color 0.2s" },
    cancelButtonHover: { backgroundColor: "#4b5563" },

    // Tables
    tableContainer: { overflowX: "auto", backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: "0 1px 3px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.03)" },
    table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: '600px' }, // Min width for horizontal scroll
    th: { borderBottom: "1px solid #e5e7eb", textAlign: "left", padding: "0.75rem 1rem", color: "#374151", backgroundColor: "#f9fafb", fontSize: "0.8rem", fontWeight: "600", textTransform: 'uppercase', letterSpacing: '0.05em' }, // Uppercase headers
    td: { borderBottom: "1px solid #f3f4f6", padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#4b5563" },
    tableRowHover: { backgroundColor: '#f9fafb' }, // Hover for table rows
    badge: { padding: "0.2rem 0.6rem", borderRadius: "9999px", fontSize: "0.7rem", fontWeight: "600", display: "inline-block", textTransform: 'uppercase' }, // Smaller, uppercase badge text
    editBtn: { backgroundColor: "#f59e0b", color: "white", border: "none", borderRadius: "4px", padding: "0.3rem 0.7rem", cursor: "pointer", marginRight: "0.5rem", fontSize: "0.8rem", transition: "background-color 0.2s" },
    editBtnHover: { backgroundColor: '#d97706' },
    deleteBtn: { backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "4px", padding: "0.3rem 0.7rem", cursor: "pointer", fontSize: "0.8rem", transition: "background-color 0.2s" },
    deleteBtnHover: { backgroundColor: '#dc2626' },

    // Footer
    footer: { textAlign: "center", padding: "1.5rem", color: "#6b7280", fontSize: "0.85rem", borderTop: "1px solid #e5e7eb", marginTop: "2rem", backgroundColor: "#ffffff" }
  };


  // --- Helper Component for Tables ---

  /** Renders a status badge */
  const StatusBadge = ({ status }) => {
    const statusText = status ? status.toUpperCase() : "PENDING";
    let bgColor, textColor;
    switch (statusText) {
      case "SUCCESS": bgColor = "#dcfce7"; textColor = "#166534"; break; // Green-100, Green-800
      case "FAILED": bgColor = "#fee2e2"; textColor = "#991b1b"; break; // Red-100, Red-900
      default: bgColor = "#ffedd5"; textColor = "#9a3412"; // Amber-100, Amber-800
    }
    return <span style={{ ...styles.badge, backgroundColor: bgColor, color: textColor }}>{statusText}</span>;
  };

  /** Renders a type badge (Profit/Loss) */
  const TypeBadge = ({ type }) => {
    const isProfit = type === "profit";
    const bgColor = isProfit ? "#dcfce7" : "#fee2e2";
    const textColor = isProfit ? "#166534" : "#991b1b";
    return <span style={{ ...styles.badge, backgroundColor: bgColor, color: textColor }}>{type.toUpperCase()}</span>;
  };


  // --- Render Sections ---

  // --- Auth handlers (login/signup in modal) ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      if (authMode === "login") {
        // standard login: include password and remember option
        console.log("Attempting login for", authEmail);
        const res = await login(authEmail, authPassword, { remember: keepSignedIn });
        console.log("Login result:", res);
        showAppNotification("Logged in successfully!", "success");
        setShowAuthModal(false);
      } else {
        if (authPassword !== authConfirmPassword) {
          setAuthError("Passwords do not match");
          return;
        }
        if (authPassword.length < 6) {
          setAuthError("Password must be at least 6 characters");
          return;
        }
        console.log("Attempting signup for", authEmail);
        const res = await signup(authEmail, authPassword);
        console.log("Signup result:", res);
        showAppNotification("Account created and logged in!", "success");
        setShowAuthModal(false);
      }
    } catch (err) {
      console.error("Auth error caught in modal:", err);
      setAuthError(err.message || "Authentication failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const switchToSignup = () => {
    setAuthMode("signup");
    setAuthError("");
  };

  const switchToLogin = () => {
    setAuthMode("login");
    setAuthError("");
  };

  const renderDashboard = () => (
    <div>
      <h1 style={styles.title}>Dashboard 🏠</h1>
      <p style={styles.subtitle}>Welcome back! Here's a quick overview of your business performance.</p>
      <div style={styles.summaryCards}>
        {/* Card 1: Successful Payments */}
        <div style={styles.card} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
          <div style={{ ...styles.cardIcon, color: "#10b981" }}>✅</div>
          <div style={{ ...styles.cardTitle, color: "#047857" }}>Successful Payments</div>
          <div style={{ ...styles.cardAmount, color: "#065f46" }}>{(transactions || []).filter(t => t.type === "profit" && t.status === "success").length}</div>
          <div style={{ ...styles.cardSubtext, color: "#047857" }}>Completed purchases</div>
        </div>
         {/* Card 2: Total Revenue */}
        <div style={styles.card} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
          <div style={{ ...styles.cardIcon, color: "#3b82f6" }}>📈</div>
          <div style={{ ...styles.cardTitle, color: "#1e40af" }}>Total Revenue</div>
          <div style={{ ...styles.cardAmount, color: "#1e3a8a" }}>Ksh {totalProfits.toFixed(2)}</div>
          <div style={{ ...styles.cardSubtext, color: "#1e40af" }}>Gross income</div>
        </div>
         {/* Card 3: Total Expenses */}
        <div style={styles.card} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
          <div style={{ ...styles.cardIcon, color: "#ef4444" }}>📉</div>
          <div style={{ ...styles.cardTitle, color: "#b91c1c" }}>Total Expenses</div>
          <div style={{ ...styles.cardAmount, color: "#991b1b" }}>Ksh {totalLosses.toFixed(2)}</div>
          <div style={{ ...styles.cardSubtext, color: "#b91c1c" }}>Money spent</div>
        </div>
         {/* Card 4: Net Balance */}
        <div style={styles.card} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
          <div style={{ ...styles.cardIcon, color: netBalance >= 0 ? "#10b981" : "#ef4444" }}>{netBalance >= 0 ? '💰' : '🛑'}</div>
          <div style={{ ...styles.cardTitle, color: netBalance >= 0 ? "#047857" : "#b91c1c" }}>Net Balance</div>
          <div style={{ ...styles.cardAmount, color: netBalance >= 0 ? "#065f46" : "#991b1b" }}>Ksh {netBalance.toFixed(2)}</div>
          <div style={{ ...styles.cardSubtext, color: netBalance >= 0 ? "#047857" : "#b91c1c" }}>Overall standing</div>
        </div>
      </div>
      <div style={{ marginTop: "2rem" }}>
        <h3 style={{ color: "#1f2937", marginBottom: "1rem", fontSize: '1.1rem', fontWeight: '600' }}>Recent Transactions</h3>
         <div style={styles.tableContainer}>
           <table style={styles.table}>
             <thead><tr><th style={styles.th}>Date</th><th style={styles.th}>Type</th><th style={styles.th}>Amount</th><th style={styles.th}>Description</th><th style={styles.th}>Status</th></tr></thead>
             <tbody>
               {(transactions || []).slice(0, 5).map((t) => ( // Added fallback for transactions
                 <tr key={t._id} style={{ transition: 'background-color 0.1s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.tableRowHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                   <td style={styles.td}>{new Date(t.date).toLocaleDateString()}</td>
                   <td style={styles.td}><TypeBadge type={t.type} /></td>
                   <td style={{...styles.td, fontWeight: '500', color: t.type === 'profit' ? '#059669' : '#dc2626'}}>Ksh {parseFloat(t.amount || 0).toFixed(2)}</td>
                   <td style={styles.td}>{t.description}</td>
                   <td style={styles.td}><StatusBadge status={t.status} /></td>
                 </tr>
               ))}
             </tbody>
           </table>
           {(transactions || []).length === 0 && <p style={{textAlign: 'center', padding: '1rem', color: '#6b7280'}}>No transactions recorded yet.</p>}
         </div>
      </div>
    </div>
  );

  const renderOffers = () => (
    <div>
      <h1 style={styles.title}>Offers Management 📦</h1>
      <p style={styles.subtitle}>Create and manage your product or service offerings.</p>
      <div style={styles.formBox}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>{form.id ? "Edit Offer" : "Add New Offer"}</h3>
        <input type="text" placeholder="Offer Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={styles.input} onFocus={e => e.target.style.borderColor = styles.inputFocus.borderColor} onBlur={e => e.target.style.borderColor = ''}/>
        <input type="text" placeholder="Price (e.g., Ksh 100)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} style={styles.input} onFocus={e => e.target.style.borderColor = styles.inputFocus.borderColor} onBlur={e => e.target.style.borderColor = ''}/>
        <button onClick={handleSubmit} disabled={loading} style={styles.button} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.buttonHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = styles.button.backgroundColor}>{loading ? "Saving..." : form.id ? "Update Offer" : "Add Offer"}</button>
        {form.id && <button onClick={() => setForm({ name: "", price: "", id: null })} style={styles.cancelButton} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.cancelButtonHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = styles.cancelButton.backgroundColor}>Cancel Edit</button>}
      </div>
      <h3 style={{ color: "#1f2937", marginBottom: "1rem", fontSize: '1.1rem', fontWeight: '600' }}>All Offers ({(offers || []).length})</h3>
       <div style={styles.tableContainer}>
         <table style={styles.table}>
           <thead><tr><th style={styles.th}>Name</th><th style={styles.th}>Price</th><th style={styles.th}>Actions</th></tr></thead>
           <tbody>
             {(offers || []).map((offer) => ( // Added fallback for offers
               <tr key={offer._id} style={{ transition: 'background-color 0.1s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.tableRowHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                 <td style={styles.td}>{offer.name}</td>
                 <td style={styles.td}>{offer.price}</td>
                 <td style={styles.td}>
                   <button style={styles.editBtn} onClick={() => handleEdit(offer)} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.editBtnHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = styles.editBtn.backgroundColor}>Edit</button>
                   <button style={styles.deleteBtn} onClick={() => handleDelete(offer._id)} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.deleteBtnHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = styles.deleteBtn.backgroundColor}>Delete</button>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
         {(offers || []).length === 0 && <p style={{textAlign: 'center', padding: '1rem', color: '#6b7280'}}>No offers have been created yet.</p>}
       </div>
    </div>
  );

  const renderAccounting = () => (
    <div>
      <h1 style={styles.title}>Transaction Management 💰</h1>
      <p style={styles.subtitle}>Track, manage, and manually log all financial transactions (Profits and Losses).</p>
      {/* Summary cards remain the same as dashboard for consistency */}
      <div style={styles.summaryCards}>
         <div style={{ ...styles.card, ...styles.coloredCard, backgroundColor: "#10b981" }}><div style={styles.cardTitle}>Total Profits</div><div style={styles.cardAmount}>Ksh {totalProfits.toFixed(2)}</div></div>
         <div style={{ ...styles.card, ...styles.coloredCard, backgroundColor: "#ef4444" }}><div style={styles.cardTitle}>Total Losses</div><div style={styles.cardAmount}>Ksh {totalLosses.toFixed(2)}</div></div>
         <div style={{ ...styles.card, ...styles.coloredCard, backgroundColor: "#3b82f6" }}><div style={styles.cardTitle}>Net Balance</div><div style={styles.cardAmount}>Ksh {netBalance.toFixed(2)}</div></div>
         <div style={{ ...styles.card, ...styles.coloredCard, backgroundColor: "#f59e0b" }}><div style={styles.cardTitle}>Failed Transactions</div><div style={styles.cardAmount}>{failedTransactions.length}</div></div>
      </div>
      <div style={styles.formBox}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>Add Manual Transaction</h3>
        <select value={transactionForm.type} onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value })} style={styles.input} onFocus={e => e.target.style.borderColor = styles.inputFocus.borderColor} onBlur={e => e.target.style.borderColor = ''}>
          <option value="profit">Profit (Income)</option>
          <option value="loss">Loss (Expense)</option>
        </select>
        <input type="number" step="0.01" placeholder="Amount (Ksh)" value={transactionForm.amount} onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })} style={styles.input} onFocus={e => e.target.style.borderColor = styles.inputFocus.borderColor} onBlur={e => e.target.style.borderColor = ''}/>
        <input type="text" placeholder="Description/Note" value={transactionForm.description} onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })} style={styles.input} onFocus={e => e.target.style.borderColor = styles.inputFocus.borderColor} onBlur={e => e.target.style.borderColor = ''}/>
        <input type="text" placeholder="Transaction Ref (Optional)" value={transactionForm.transactionRef} onChange={(e) => setTransactionForm({ ...transactionForm, transactionRef: e.target.value })} style={styles.input} onFocus={e => e.target.style.borderColor = styles.inputFocus.borderColor} onBlur={e => e.target.style.borderColor = ''}/>
        <input type="text" placeholder="Phone Number (Optional)" value={transactionForm.phoneNumber} onChange={(e) => setTransactionForm({ ...transactionForm, phoneNumber: e.target.value })} style={styles.input} onFocus={e => e.target.style.borderColor = styles.inputFocus.borderColor} onBlur={e => e.target.style.borderColor = ''}/>
        <select value={transactionForm.offerId} onChange={(e) => setTransactionForm({ ...transactionForm, offerId: e.target.value })} style={styles.input} onFocus={e => e.target.style.borderColor = styles.inputFocus.borderColor} onBlur={e => e.target.style.borderColor = ''}>
          <option value="">Select Related Offer (Optional)</option>
          {(offers || []).map((offer) => (<option key={offer._id} value={offer._id}>{offer.name}</option>))}
        </select>
        <button onClick={handleTransactionSubmit} disabled={loading} style={styles.button} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.buttonHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = styles.button.backgroundColor}>{loading ? "Adding..." : "Add Transaction"}</button>
      </div>
      <h3 style={{ color: "#1f2937", marginBottom: "1rem", fontSize: '1.1rem', fontWeight: '600' }}>Transaction History ({(transactions || []).length})</h3>
       <div style={styles.tableContainer}>
         <table style={styles.table}>
           <thead><tr><th style={styles.th}>Date</th><th style={styles.th}>Type</th><th style={styles.th}>Amount</th><th style={styles.th}>Description</th><th style={styles.th}>Ref Code</th><th style={styles.th}>Phone</th><th style={styles.th}>Status</th><th style={styles.th}>Actions</th></tr></thead>
           <tbody>
             {(transactions || []).map((t) => ( // Added fallback for transactions
               <tr key={t._id} style={{ transition: 'background-color 0.1s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.tableRowHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                 <td style={styles.td}>{new Date(t.date).toLocaleDateString()}</td>
                 <td style={styles.td}><TypeBadge type={t.type} /></td>
                 <td style={{...styles.td, fontWeight: '500', color: t.type === 'profit' ? '#059669' : '#dc2626'}}>Ksh {parseFloat(t.amount || 0).toFixed(2)}</td>
                 <td style={styles.td}>{t.description}</td>
                 <td style={styles.td}>{t.transactionRef || "N/A"}</td>
                 <td style={styles.td}>{t.phoneNumber || "N/A"}</td>
                 <td style={styles.td}><StatusBadge status={t.status} /></td>
                 <td style={styles.td}><button style={styles.deleteBtn} onClick={() => handleDeleteTransaction(t._id)} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.deleteBtnHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = styles.deleteBtn.backgroundColor}>Delete</button></td>
               </tr>
             ))}
           </tbody>
         </table>
         {(transactions || []).length === 0 && <p style={{textAlign: 'center', padding: '1rem', color: '#6b7280'}}>No transactions found.</p>}
       </div>
    </div>
  );

  const renderMpesa = () => (
    <div>
      <h1 style={styles.title}>M-Pesa Payments 📱</h1>
      <p style={styles.subtitle}>Monitor and manage Safaricom M-Pesa payment records (STK Push transactions).</p>
      <h3 style={{ color: "#1f2937", marginBottom: "1rem", fontSize: '1.1rem', fontWeight: '600' }}>M-Pesa Payment Records ({(mpesaPayments || []).length})</h3>
       <div style={styles.tableContainer}>
         <table style={styles.table}>
           <thead><tr><th style={styles.th}>Date/Time</th><th style={styles.th}>Phone</th><th style={styles.th}>Amount</th><th style={styles.th}>Offer</th><th style={styles.th}>M-Pesa Code</th><th style={styles.th}>Status</th><th style={styles.th}>Actions (TEST)</th></tr></thead>
           <tbody>
             {(mpesaPayments || []).map((p) => ( // Added fallback for mpesaPayments
               <tr key={p._id} style={{ transition: 'background-color 0.1s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.tableRowHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                 <td style={styles.td}>{new Date(p.createdAt).toLocaleString()}</td>
                 <td style={styles.td}>{p.phone}</td>
                 <td style={{...styles.td, fontWeight: '500'}}>Ksh {parseFloat(p.amount || 0).toFixed(2)}</td>
                 <td style={styles.td}>{p.offerName}</td>
                 <td style={{...styles.td, fontFamily: 'monospace', fontSize: '0.8rem'}}>{p.mpesaReceiptNumber || p.checkoutRequestID}</td>
                 <td style={styles.td}><StatusBadge status={p.status} /></td>
                 <td style={styles.td}>
                   {p.status === "pending" && (
                     <>
                       <button style={{ ...styles.editBtn, fontSize: "0.75rem", padding: "0.3rem 0.5rem" }} onClick={() => simulateCallback(p.checkoutRequestID, true)} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.editBtnHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = styles.editBtn.backgroundColor}>Sim Success</button>
                       <button style={{ ...styles.deleteBtn, fontSize: "0.75rem", padding: "0.3rem 0.5rem", marginLeft: "0.3rem" }} onClick={() => simulateCallback(p.checkoutRequestID, false)} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.deleteBtnHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = styles.deleteBtn.backgroundColor}>Sim Fail</button>
                     </>
                   )}
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
         {(mpesaPayments || []).length === 0 && <p style={{textAlign: 'center', padding: '1rem', color: '#6b7280'}}>No M-Pesa payment records found.</p>}
       </div>
    </div>
  );

  const renderSettings = () => (
    <div>
      <h1 style={styles.title}>System Settings ⚙️</h1>
      <p style={styles.subtitle}>Configure your M-Pesa integration and general system preferences.</p>
      <div style={styles.formBox}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>M-Pesa Settings Configuration</h3>
        <input type="text" placeholder="Till Number" value={settings.tillNumber || ''} onChange={(e) => setSettings({ ...settings, tillNumber: e.target.value })} style={styles.input} onFocus={e => e.target.style.borderColor = styles.inputFocus.borderColor} onBlur={e => e.target.style.borderColor = ''}/>
        <input type="text" placeholder="Short Code (e.g. Paybill/BuyGoods)" value={settings.shortCode || ''} onChange={(e) => setSettings({ ...settings, shortCode: e.target.value })} style={styles.input} onFocus={e => e.target.style.borderColor = styles.inputFocus.borderColor} onBlur={e => e.target.style.borderColor = ''}/>
        <select value={settings.environment || 'sandbox'} onChange={(e) => setSettings({ ...settings, environment: e.target.value })} style={styles.input} onFocus={e => e.target.style.borderColor = styles.inputFocus.borderColor} onBlur={e => e.target.style.borderColor = ''}>
          <option value="sandbox">Sandbox (Testing)</option>
          <option value="production">Production (Live)</option>
        </select>
        <input type="text" placeholder="Callback URL" value={settings.callbackUrl || ''} onChange={(e) => setSettings({ ...settings, callbackUrl: e.target.value })} style={styles.input} onFocus={e => e.target.style.borderColor = styles.inputFocus.borderColor} onBlur={e => e.target.style.borderColor = ''}/>
        <button onClick={handleSaveSettings} disabled={loading} style={styles.button} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.buttonHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = styles.button.backgroundColor}>{loading ? "Saving..." : "Save Settings"}</button>
      </div>
    </div>
  );

  // --- Main Render ---

  // Determine which content to render based on the active tab
  const renderContent = () => {
    switch (activeTab) {
      case "dashboard": return renderDashboard();
      case "offers": return renderOffers();
      case "accounting": return renderAccounting();
      case "mpesa": return renderMpesa();
      case "settings": return renderSettings();
      default: return renderDashboard();
    }
  };

  const overlayActive = !isAuthenticated && showAuthModal;

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.logoContainer}>
          <div style={styles.logo}>Bingwa Sokoni Admin</div>
          <div style={styles.logoPlaceholder} title="Click to upload/change logo">
            {/* Basic file input for logo upload - non-functional in this example */}
             <input type="file" accept="image/*" style={{ display: 'none' }} id="logoUpload" />
             <label htmlFor="logoUpload" style={{ cursor: 'pointer' }}>
                 <span style={{ marginRight: '0.5rem' }}>⬆️</span> Upload Logo
             </label>
          </div>
        </div>

        <div style={styles.navSection}>
          <nav>
             {/* Navigation Items */}
             {['dashboard', 'offers', 'accounting', 'mpesa', 'settings'].map((tab) => {
                 const icons = { dashboard: '🏠', offers: '📦', accounting: '💰', mpesa: '📱', settings: '⚙️' };
                 return (
                     <button
                         key={tab}
                         style={{ ...styles.navItem, ...(activeTab === tab ? styles.navItemActive : {}) }}
                         onClick={() => setActiveTab(tab)}
                         onMouseEnter={e => { if (activeTab !== tab) e.currentTarget.style.backgroundColor = '#f3f4f6'; }} // Subtle hover for non-active items
                         onMouseLeave={e => { if (activeTab !== tab) e.currentTarget.style.backgroundColor = 'transparent'; }}
                     >
                         <span style={styles.navIcon}>{icons[tab]}</span> {tab.charAt(0).toUpperCase() + tab.slice(1)}
                     </button>
                 );
             })}
          </nav>
        </div>

        {/* Admin User ID at the bottom of the sidebar */}
        <div style={styles.userInfo}>
            <p style={{ fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>Admin User ID:</p>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', overflowWrap: 'break-word', fontFamily: 'monospace' }}>{adminUserId}</p>
        </div>
      </div>

      {/* Main Content Area */}
  <div style={{ ...styles.mainContent, filter: overlayActive ? 'blur(5px)' : 'none', pointerEvents: overlayActive ? 'none' : 'auto' }}>
        {/* Top Bar with Real-Time Clock, Notifications, Profile */}
        <div style={styles.topBar}>
          <div style={styles.timeDisplay}>
            <div style={styles.currentDate}>{formattedDate}</div>
            <div style={styles.currentTime}>{formattedTime}</div>
          </div>
          <div style={styles.topBarIcons}>
             {/* Notification Bell */}
             <button
                 style={styles.iconButton}
                 title="Notifications"
                 onClick={toggleNotificationMenu}
                 onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.iconButtonHover.backgroundColor}
                 onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
             >
                 🔔
                 {/* Notification Badge */}
                 {notificationsList.length > 0 && <span style={styles.notificationBadge}></span>}
             </button>

             {/* Profile Avatar */}
             <button
                 style={styles.iconButton}
                 title="User Profile"
                 onClick={toggleProfileMenu}
                 onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.iconButtonHover.backgroundColor}
                 onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
             >
                 {/* Placeholder Avatar - Replace with actual image or initials */}
                 <span style={{ display: 'inline-block', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#d1d5db', color: '#4b5563', textAlign: 'center', lineHeight: '24px', fontSize: '0.8rem', fontWeight: 'bold'}}>
                     A {/* Initial */}
                 </span>
             </button>

             {/* Notification Popover */}
            {showNotificationMenu && (
                <div style={styles.popover}>
                    <div style={styles.popoverHeader}>Notifications</div>
                    <div style={styles.popoverContent}>
                        {notificationsList.length > 0 ? (
                            notificationsList.map(notif => (
                                <div key={notif.id} style={styles.popoverItem} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.popoverItemHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                                    {notif.text}
                                    <div style={styles.popoverItemTime}>{notif.time}</div>
                                </div>
                            ))
                        ) : (
                            <div style={{ ...styles.popoverItem, textAlign: 'center', color: '#9ca3af' }}>No new notifications</div>
                        )}
                    </div>
                    <div style={styles.popoverFooter}>
                        {/* Placeholder link */}
                        <a href="#" onClick={(e) => { e.preventDefault(); console.log("View All Notifications clicked"); }} style={styles.popoverLink}>View All</a>
                    </div>
                </div>
            )}

            {/* Profile Popover */}
            {showProfileMenu && (
                <div style={styles.popover}>
                   <div style={styles.popoverHeader}>Admin Profile</div>
                   <div style={styles.popoverContent}>
                        {/* Placeholder links */}
                        <button onClick={() => openAccountModal()} style={{ ...styles.popoverItem, background: 'none', border: 'none', width: '100%', textAlign: 'left', padding: '0.75rem 1rem' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.popoverItemHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>Account Settings</button>
                        <button onClick={handleLogoutClick} style={{ ...styles.popoverItem, background: 'none', border: 'none', width: '100%', textAlign: 'left', padding: '0.75rem 1rem' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = styles.popoverItemHover.backgroundColor} onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>Logout</button>
                   </div>
                </div>
            )}
          </div>
        </div>

        {/* Main Application Notification */}
        {notification && (
          <div style={{ ...styles.notification, backgroundColor: notification.type === "error" ? "#ef4444" : "#10b981" }}>
            {notification.message}
          </div>
        )}

        <div style={styles.contentArea}>
          {renderContent()}
        </div>

        <footer style={styles.footer}>
          <p>&copy; Bingwa Sokoni {new Date().getFullYear()}. All rights reserved.</p>
        </footer>
      </div>

      {/* Auth Modal Overlay (login/signup) */}
      {showAuthModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ width: '100%', maxWidth: '420px', background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.25rem' }}>{authMode === 'login' ? 'Admin Login' : 'Create an Account'}</h2>
            <p style={{ marginTop: 0, marginBottom: '1rem', color: '#6b7280' }}>{authMode === 'login' ? 'Sign in to continue to the admin dashboard' : 'Create an account to manage your store'}</p>

            {authError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem', borderRadius: 6, marginBottom: '0.75rem' }}>{authError}</div>}

            <form onSubmit={handleAuthSubmit}>
              <input type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '0.75rem', border: '1px solid #d1d5db', borderRadius: 6 }} />

              <>
                {/* Password is required for login; for signup we also ask to confirm */}
                <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: authMode === 'signup' ? '0.5rem' : '1rem', border: '1px solid #d1d5db', borderRadius: 6 }} />
                {authMode === 'signup' && (
                  <input type="password" placeholder="Confirm Password" value={authConfirmPassword} onChange={(e) => setAuthConfirmPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '1px solid #d1d5db', borderRadius: 6 }} />
                )}

                {/* Keep me signed in checkbox shown for both modes (useful after signup too) */}
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input id="keepSignedIn" type="checkbox" checked={keepSignedIn} onChange={(e) => setKeepSignedIn(e.target.checked)} />
                  <label htmlFor="keepSignedIn" style={{ color: '#6b7280', fontSize: '0.95rem' }}>Keep me signed in</label>
                </div>
              </>

              <button type="submit" disabled={authLoading} style={{ width: '100%', padding: '0.75rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600 }}>{authLoading ? (authMode === 'login' ? 'Logging in...' : 'Creating...') : (authMode === 'login' ? 'Login' : 'Create Account')}</button>
            </form>

            <div style={{ marginTop: '0.75rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
              {authMode === 'login' ? (
                <>
                  Don't have an account? <button onClick={switchToSignup} style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Sign up</button>
                </>
              ) : (
                <>
                  Already have an account? <button onClick={switchToLogin} style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Login</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Account Settings Modal */}
      {showAccountModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1250 }} onClick={() => setShowAccountModal(false)}>
          <div style={{ width: '100%', maxWidth: '520px', background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.25rem' }}>Account Settings</h2>
            <p style={{ marginTop: 0, marginBottom: '1rem', color: '#6b7280' }}>Manage your account details.</p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#374151' }}>Email</label>
              <div style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb' }}>{user?.email || '—'}</div>
            </div>

            <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Change Password</h3>
            <form onSubmit={handleAccountSave}>
              <input type="password" placeholder="Current Password" value={accountForm.currentPassword} onChange={(e) => setAccountForm({ ...accountForm, currentPassword: e.target.value })} style={{ width: '100%', padding: '0.75rem', marginBottom: '0.75rem', border: '1px solid #d1d5db', borderRadius: 6 }} required />
              <input type="password" placeholder="New Password" value={accountForm.newPassword} onChange={(e) => setAccountForm({ ...accountForm, newPassword: e.target.value })} style={{ width: '100%', padding: '0.75rem', marginBottom: '0.75rem', border: '1px solid #d1d5db', borderRadius: 6 }} required />
              <input type="password" placeholder="Confirm New Password" value={accountForm.confirmPassword} onChange={(e) => setAccountForm({ ...accountForm, confirmPassword: e.target.value })} style={{ width: '100%', padding: '0.75rem', marginBottom: '0.75rem', border: '1px solid #d1d5db', borderRadius: 6 }} required />

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" style={{ ...styles.button, flex: 1 }}>Update Password</button>
                <button type="button" onClick={handleAccountCancel} style={{ ...styles.cancelButton, flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

