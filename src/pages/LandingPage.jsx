import React, { useState, useEffect } from "react";
import bgImage from "../assets/background.jpg";
import { Link } from "react-router-dom";

const LandingPage = () => {
  const [offers, setOffers] = useState([]);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [notification, setNotification] = useState(null); // alert
  const [modal, setModal] = useState({ open: false, offer: null, phone: "" });
  const [showNotification, setShowNotification] = useState(false); // for animation
  const [headerText, setHeaderText] = useState("Welcome to Our store");

  // Track window resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Step 5: Fetch offers from backend
  useEffect(() => {
    fetch("/offers")
      .then((res) => res.json())
      .then((data) => setOffers(data))
      .catch((err) => {
        console.error("Error fetching offers:", err);
        // fallback if backend fails
        setOffers([
          { id: 1, name: "Bundle A", price: "Ksh 100" },
          { id: 2, name: "Bundle B", price: "Ksh 200" },
          { id: 3, name: "Bundle C", price: "Ksh 300" },
        ]);
      });
  }, []);

  // Fetch store settings
  useEffect(() => {
    fetch("/api/store-settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.headerText) {
          setHeaderText(data.headerText);
        }
      })
      .catch((err) => console.error("Error fetching store settings:", err));
  }, []);

  const getGridColumns = () => {
    if (windowWidth < 640) return "1fr";
    if (windowWidth < 1024) return "1fr 1fr";
    return "1fr 1fr 1fr";
  };

  const openModal = (offer) => setModal({ open: true, offer, phone: "" });
  const closeModal = () => setModal({ open: false, offer: null, phone: "" });

  const handlePayment = async () => {
    const { phone, offer } = modal;
    if (!phone) {
      showNotificationMessage("Phone number is required.", "error");
      return;
    }

    const amount = parseInt(offer.price.replace(/\D/g, ""), 10);

    // M-Pesa STK Push API request payload
    const requestPayload = {
      BusinessShortCode: 174379,
      Password: "MTc0Mzc5YmZiMjc5ZjlhYTliZGJjZjE1OGU5N2RkNzFhNDY3Y2QyZTBjODkzMDU5YjEwZjc4ZTZiNzJhZGExZWQyYzkxOTIwMjUxMDI2MTEyNDMy",
      Timestamp: new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14),
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: 174379,
      PhoneNumber: phone,
      CallBackURL: "https://mydomain.com/path",  // Replace with your actual callback URL
      AccountReference: "CompanyXLTD",
      TransactionDesc: `Payment for ${offer.name}`,
    };

    try {
      const response = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer GFKDtCn7x1a0hhUfs2D0yr8rzVsJ", // Replace with your actual token
        },
        body: JSON.stringify(requestPayload),
      });

      const data = await response.json();
      if (data.error) {
        showNotificationMessage("Payment failed. Try again.", "error");
        console.error(data.error);
      } else {
        showNotificationMessage(`Payment initiated for ${offer.name}. Complete on your phone.`, "success");
      }
    } catch (err) {
      console.error("Error initiating payment:", err);
      showNotificationMessage("Error initiating payment.", "error");
    }

    closeModal();
  };

  const showNotificationMessage = (message, type) => {
    setNotification({ message, type });
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 5000);
  };

  const styles = {
    container: {
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      fontFamily: "Arial, sans-serif",
      backgroundImage: `url(${bgImage})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      color: "#111",
    },
    overlay: {
      backgroundColor: "rgba(243, 244, 246, 0.9)",
      flex: 1,
      display: "flex",
      flexDirection: "column",
      position: "relative",
    },
    notification: {
      position: "fixed",
      top: showNotification ? "20px" : "-100px",
      right: "20px",
      padding: "1rem 1.5rem",
      borderRadius: "0.5rem",
      backgroundColor: notification?.type === "success" ? "#16a34a" : "#dc2626",
      color: "white",
      zIndex: 1000,
      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      maxWidth: "300px",
      transition: "top 0.5s ease",
    },
    modalBackdrop: {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
      opacity: modal.open ? 1 : 0,
      pointerEvents: modal.open ? "auto" : "none",
      transition: "opacity 0.3s ease",
    },
    modalContent: {
      backgroundColor: "white",
      padding: "2rem",
      borderRadius: "0.5rem",
      width: windowWidth < 640 ? "90%" : "400px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
      textAlign: "center",
      transform: modal.open ? "translateY(0)" : "translateY(-50px)",
      transition: "transform 0.3s ease",
    },
    input: { width: "100%", padding: "0.5rem", margin: "1rem 0", borderRadius: "0.25rem", border: "1px solid #ccc" },
    button: { backgroundColor: "#2563eb", color: "white", padding: "0.5rem 1rem", border: "none", borderRadius: "0.25rem", cursor: "pointer" },
    footer: { backgroundColor: "#1f2937", color: "#d1d5db", textAlign: "center", padding: "1rem", marginTop: "auto", fontSize: windowWidth < 640 ? "0.8rem" : "1rem" },
  };

  return (
    <div style={styles.container}>
      <div style={styles.overlay}>
        {notification && <div style={styles.notification}>{notification.message}</div>}

        {/* Welcome Section */}
        <section style={{ backgroundColor: "#2563eb", color: "white", padding: "5rem 1rem", textAlign: "center" }}>
          <h1 style={{ fontSize: windowWidth < 640 ? "2rem" : "2.5rem", fontWeight: "bold", marginBottom: "1rem" }}>
            {headerText}
          </h1>
          <p style={{ fontSize: windowWidth < 640 ? "1rem" : "1.2rem" }}>Buy your data bundles and minutes easily!</p>
        </section>

        {/* Offers Panel */}
        <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "4rem 1rem", flex: "1" }}>
          <h2 style={{ fontSize: windowWidth < 640 ? "1.5rem" : "2rem", fontWeight: "600", textAlign: "center", marginBottom: "2.5rem" }}>
            Our Offers
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: getGridColumns(), gap: "1.5rem" }}>
            {offers.length > 0 ? (
              offers.map((offer) => (
                <div key={offer.id} style={{ backgroundColor: "white", padding: "1.5rem", borderRadius: "0.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", textAlign: "center" }}>
                  <h3 style={{ fontSize: windowWidth < 640 ? "1rem" : "1.25rem", fontWeight: "bold", marginBottom: "0.5rem" }}>{offer.name}</h3>
                  <p style={{ marginBottom: "1rem", color: "#374151" }}>{offer.price}</p>
                  <button style={styles.button} onClick={() => openModal(offer)}>Buy Now</button>
                </div>
              ))
            ) : (
              <p style={{ textAlign: "center", gridColumn: "1 / -1" }}>No offers available at the moment.</p>
            )}
          </div>
        </section>

        {/* Footer with Admin Link */}
        <footer style={styles.footer}>
          Software designed by ConnectfyGlobe © 2025 | <Link to="/admin" style={{ color: "#d1d5db", textDecoration: "none" }}>Go to Admin Page</Link>
        </footer>

        {/* Payment Modal */}
        <div style={styles.modalBackdrop}>
          {modal.open && (
            <div style={styles.modalContent}>
              <h3>Buy {modal.offer.name}</h3>
              <p>Amount: {modal.offer.price}</p>
              <input
                type="tel"
                placeholder="Enter Mpesa phone number"
                value={modal.phone}
                onChange={(e) => setModal({ ...modal, phone: e.target.value })}
                style={styles.input}
              />
              <button style={{ ...styles.button, marginRight: "0.5rem" }} onClick={handlePayment}>Pay</button>
              <button style={{ ...styles.button, backgroundColor: "#dc2626" }} onClick={closeModal}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
