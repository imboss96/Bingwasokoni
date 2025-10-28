const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Load environment variables from .env file (CRITICAL for Atlas URI)
require('dotenv').config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// --- MONGODB ATLAS CONNECTION ---
// Using process.env.ATLAS_URI to connect to the MongoDB Atlas cloud server
mongoose.connect(process.env.ATLAS_URI, { 
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((error) => console.error('❌ Error connecting to MongoDB Atlas:', error));


// ============== SCHEMAS AND MODELS ==============

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' }
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model('User', userSchema);

const offerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: String, required: true }
});

const Offer = mongoose.model('Offer', offerSchema);

const transactionSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['profit', 'loss'] },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', default: null },
  offerName: { type: String, default: null },
  transactionRef: { type: String, default: null },
  phoneNumber: { type: String, default: null },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  date: { type: Date, default: Date.now }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

const mpesaPaymentSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  amount: { type: Number, required: true },
  offerName: { type: String, required: true },
  offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
  checkoutRequestID: { type: String },
  merchantRequestID: { type: String },
  mpesaReceiptNumber: { type: String },
  transactionDate: { type: Date },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  resultCode: { type: String },
  resultDesc: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const MpesaPayment = mongoose.model('MpesaPayment', mpesaPaymentSchema);

// Settings Schema for M-Pesa Configuration
const settingsSchema = new mongoose.Schema({
  tillNumber: { type: String, default: '' },
  shortCode: { type: String, default: '' },
  consumerKey: { type: String, default: '' },
  consumerSecret: { type: String, default: '' },
  passkey: { type: String, default: '' },
  callbackUrl: { type: String, default: 'http://localhost:5000/mpesa/callback' },
  environment: { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },
  updatedAt: { type: Date, default: Date.now }
});

const Settings = mongoose.model('Settings', settingsSchema);

// Add this with other schemas, after the Settings schema

const storeSettingsSchema = new mongoose.Schema({
  headerText: { type: String, default: 'Welcome to Bingwa Sokoni' },
  updatedAt: { type: Date, default: Date.now }
});

const StoreSettings = mongoose.model('StoreSettings', storeSettingsSchema);

// ============== API ROUTES ==============

app.get('/api', (req, res) => {
  res.json({ message: 'Bingwa Sokoni Backend API is running!' });
});

app.get('/offers', async (req, res) => {
  try {
    const offers = await Offer.find();
    res.json(offers);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching offers' });
  }
});

app.post('/offers', async (req, res) => {
  const { name, price } = req.body;
  const offer = new Offer({ name, price });
  try {
    const savedOffer = await offer.save();
    res.json({ success: true, offer: savedOffer });
  } catch (err) {
    res.status(500).json({ message: 'Error saving offer' });
  }
});

app.put('/offers/:id', async (req, res) => {
  const { name, price } = req.body;
  try {
    const updatedOffer = await Offer.findByIdAndUpdate(req.params.id, { name, price }, { new: true });
    if (!updatedOffer) return res.status(404).json({ message: 'Offer not found' });
    res.json(updatedOffer);
  } catch (err) {
    res.status(500).json({ message: 'Error updating offer' });
  }
});

app.delete('/offers/:id', async (req, res) => {
  try {
    const deletedOffer = await Offer.findByIdAndDelete(req.params.id);
    if (!deletedOffer) return res.status(404).json({ message: 'Offer not found' });
    res.json({ success: true, message: 'Offer deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting offer' });
  }
});

// ============== SETTINGS ROUTES ==============

// Get M-Pesa settings
app.get('/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    // Don't send sensitive data to frontend
    res.json({
      tillNumber: settings.tillNumber,
      shortCode: settings.shortCode,
      environment: settings.environment,
      callbackUrl: settings.callbackUrl
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

// Update M-Pesa settings
app.put('/settings', async (req, res) => {
  const { tillNumber, shortCode, consumerKey, consumerSecret, passkey, callbackUrl, environment } = req.body;
  
  console.log('========== UPDATING SETTINGS ==========');
  console.log('Till Number:', tillNumber);
  console.log('Short Code:', shortCode);
  console.log('Environment:', environment);
  
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    
    if (tillNumber !== undefined) settings.tillNumber = tillNumber;
    if (shortCode !== undefined) settings.shortCode = shortCode;
    if (consumerKey !== undefined) settings.consumerKey = consumerKey;
    if (consumerSecret !== undefined) settings.consumerSecret = consumerSecret;
    if (passkey !== undefined) settings.passkey = passkey;
    if (callbackUrl !== undefined) settings.callbackUrl = callbackUrl;
    if (environment !== undefined) settings.environment = environment;
    
    settings.updatedAt = new Date();
    await settings.save();
    
    console.log('✅ Settings updated successfully');
    console.log('==========================================');
    
    res.json({ 
      success: true, 
      message: 'Settings updated successfully',
      settings: {
        tillNumber: settings.tillNumber,
        shortCode: settings.shortCode,
        environment: settings.environment,
        callbackUrl: settings.callbackUrl
      }
    });
  } catch (err) {
    console.error('❌ Error updating settings:', err);
    res.status(500).json({ message: 'Error updating settings' });
  }
});

// ============== M-PESA ROUTES ==============

// Initiate M-Pesa STK Push
app.post('/mpesa/payment', async (req, res) => {
  const { phone, amount, offerName } = req.body;
  
  console.log('========== M-PESA PAYMENT REQUEST ==========');
  console.log('Phone:', phone);
  console.log('Amount:', amount);
  console.log('Offer:', offerName);
  
  try {
    // Get settings
    const settings = await Settings.findOne();
    if (!settings || !settings.tillNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'M-Pesa till number not configured. Please contact admin.' 
      });
    }
    
    console.log('Till Number:', settings.tillNumber);
    
    const offer = await Offer.findOne({ name: offerName });
    
    const mpesaPayment = new MpesaPayment({
      phone,
      amount,
      offerName,
      offerId: offer ? offer._id : null,
      status: 'pending'
    });
    
    await mpesaPayment.save();
    
    // TODO: Integrate with actual M-Pesa API here
    // Use settings.tillNumber, settings.shortCode, etc.
    const simulatedResponse = {
      MerchantRequestID: `MR${Date.now()}`,
      CheckoutRequestID: `CR${Date.now()}`,
      ResponseCode: "0",
      ResponseDescription: "Success. Request accepted for processing",
      CustomerMessage: `Payment of Ksh ${amount} to Till ${settings.tillNumber}. Check your phone.`
    };
    
    mpesaPayment.merchantRequestID = simulatedResponse.MerchantRequestID;
    mpesaPayment.checkoutRequestID = simulatedResponse.CheckoutRequestID;
    await mpesaPayment.save();
    
    console.log('✅ M-Pesa payment initiated');
    console.log('==========================================');
    
    res.json({
      success: true,
      message: simulatedResponse.CustomerMessage,
      checkoutRequestID: simulatedResponse.CheckoutRequestID
    });
    
  } catch (err) {
    console.error('❌ Error initiating M-Pesa payment:', err);
    res.status(500).json({ success: false, message: 'Error initiating payment' });
  }
});

// M-Pesa Callback URL
app.post('/mpesa/callback', async (req, res) => {
  console.log('========== M-PESA CALLBACK ==========');
  console.log(JSON.stringify(req.body, null, 2));
  
  try {
    const { Body } = req.body;
    const { stkCallback } = Body;
    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;
    
    const payment = await MpesaPayment.findOne({ checkoutRequestID: CheckoutRequestID });
    
    if (!payment) {
      console.log('❌ Payment record not found');
      return res.json({ ResultCode: 1, ResultDesc: 'Payment record not found' });
    }
    
    payment.resultCode = ResultCode.toString();
    payment.resultDesc = ResultDesc;
    
    if (ResultCode === 0) {
      payment.status = 'success';
      
      if (CallbackMetadata && CallbackMetadata.Item) {
        const items = CallbackMetadata.Item;
        const receiptItem = items.find(item => item.Name === 'MpesaReceiptNumber');
        if (receiptItem) {
          payment.mpesaReceiptNumber = receiptItem.Value;
        }
        
        const dateItem = items.find(item => item.Name === 'TransactionDate');
        if (dateItem) {
          payment.transactionDate = new Date(dateItem.Value.toString());
        }
      }
      
      await payment.save();
      
      const transaction = new Transaction({
        type: 'profit',
        amount: payment.amount,
        description: `M-Pesa payment for ${payment.offerName}`,
        offerId: payment.offerId,
        offerName: payment.offerName,
        transactionRef: payment.mpesaReceiptNumber,
        phoneNumber: payment.phone,
        status: 'success'
      });
      
      await transaction.save();
      
      console.log('✅ Payment successful and transaction recorded');
      console.log('M-Pesa Receipt:', payment.mpesaReceiptNumber);
      
    } else {
      payment.status = 'failed';
      await payment.save();
      
      const transaction = new Transaction({
        type: 'loss',
        amount: 0,
        description: `Failed M-Pesa payment for ${payment.offerName} - ${ResultDesc}`,
        offerId: payment.offerId,
        offerName: payment.offerName,
        transactionRef: CheckoutRequestID,
        phoneNumber: payment.phone,
        status: 'failed'
      });
      
      await transaction.save();
      
      console.log('❌ Payment failed and recorded');
    }
    
    console.log('==========================================');
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
    
  } catch (err) {
    console.error('❌ Error processing callback:', err);
    res.json({ ResultCode: 1, ResultDesc: 'Error processing callback' });
  }
});

// Simulate M-Pesa callback for testing
app.post('/mpesa/simulate-callback', async (req, res) => {
  const { checkoutRequestID, success } = req.body;
  
  try {
    const payment = await MpesaPayment.findOne({ checkoutRequestID });
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    if (success) {
      payment.status = 'success';
      payment.resultCode = '0';
      payment.resultDesc = 'The service request is processed successfully.';
      payment.mpesaReceiptNumber = `MPE${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      payment.transactionDate = new Date();
      await payment.save();
      
      const transaction = new Transaction({
        type: 'profit',
        amount: payment.amount,
        description: `M-Pesa payment for ${payment.offerName}`,
        offerId: payment.offerId,
        offerName: payment.offerName,
        transactionRef: payment.mpesaReceiptNumber,
        phoneNumber: payment.phone,
        status: 'success'
      });
      await transaction.save();
      
    } else {
      payment.status = 'failed';
      payment.resultCode = '1032';
      payment.resultDesc = 'Request cancelled by user';
      await payment.save();
      
      const transaction = new Transaction({
        type: 'loss',
        amount: 0,
        description: `Failed M-Pesa payment for ${payment.offerName} - User cancelled`,
        offerId: payment.offerId,
        offerName: payment.offerName,
        transactionRef: checkoutRequestID,
        phoneNumber: payment.phone,
        status: 'failed'
      });
      await transaction.save();
    }
    
    res.json({ success: true, payment });
    
  } catch (err) {
    res.status(500).json({ message: 'Error simulating callback' });
  }
});

app.get('/mpesa/payments', async (req, res) => {
  try {
    const payments = await MpesaPayment.find().sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching payments' });
  }
});

// ============== TRANSACTION ROUTES ==============

app.get('/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ date: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

app.post('/transactions', async (req, res) => {
  const { type, amount, description, offerId, transactionRef, phoneNumber, status } = req.body;
  
  try {
    let offerName = null;
    if (offerId && offerId.trim() !== '') {
      try {
        const offer = await Offer.findById(offerId);
        if (offer) offerName = offer.name;
      } catch (err) {
        console.log('Invalid offer ID');
      }
    }

    const transaction = new Transaction({
      type,
      amount: parseFloat(amount),
      description,
      offerId: (offerId && offerId.trim() !== '') ? offerId : null,
      offerName,
      transactionRef: transactionRef || null,
      phoneNumber: phoneNumber || null,
      status: status || 'success'
    });

    const savedTransaction = await transaction.save();
    res.json({ success: true, transaction: savedTransaction });
  } catch (err) {
    console.error('Error saving transaction:', err);
    res.status(500).json({ message: 'Error saving transaction', error: err.message });
  }
});

app.delete('/transactions/:id', async (req, res) => {
  try {
    const deletedTransaction = await Transaction.findByIdAndDelete(req.params.id);
    if (!deletedTransaction) return res.status(404).json({ message: 'Transaction not found' });
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting transaction' });
  }
});

app.get('/accounting/summary', async (req, res) => {
  try {
    const transactions = await Transaction.find();
    const totalProfits = transactions.filter(t => t.type === 'profit').reduce((acc, t) => acc + t.amount, 0);
    const totalLosses = transactions.filter(t => t.type === 'loss').reduce((acc, t) => acc + t.amount, 0);
    const balance = totalProfits - totalLosses;
    const successfulTransactions = transactions.filter(t => t.status === 'success').length;
    const failedTransactions = transactions.filter(t => t.status === 'failed').length;
    
    res.json({ 
      totalProfits, 
      totalLosses, 
      balance, 
      transactionCount: transactions.length,
      successfulTransactions,
      failedTransactions
    });
  } catch (err) {
    res.status(500).json({ message: 'Error calculating summary' });
  }
});

// ============== USER ROUTES ==============

app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });
    const newUser = new User({ email, password, role: 'user' });
    await newUser.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error registering user' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    // IMPORTANT: In a real app, use a secure, complex key from env vars
    const token = jwt.sign({ userId: user._id, role: user.role }, 'yourSecretKey', { expiresIn: '1h' }); 
    res.json({ token, user: { id: user._id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: 'Error logging in' });
  }
});

app.get('/create-test-user', async (req, res) => {
  try {
    await User.deleteOne({ email: 'test@test.com' });
    const testUser = new User({ email: 'test@test.com', password: 'test123', role: 'user' });
    await testUser.save();
    res.json({ message: 'Test user created', credentials: { email: 'test@test.com', password: 'test123' } });
  } catch (err) {
    res.status(500).json({ message: 'Error creating test user' });
  }
});

app.post('/create-admin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      existingUser.role = 'admin';
      await existingUser.save();
      return res.json({ message: 'User updated to admin' });
    }
    const newAdmin = new User({ email, password, role: 'admin' });
    await newAdmin.save();
    res.status(201).json({ message: 'Admin created successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error creating admin' });
  }
});

// Add these routes before the Frontend Proxy section

// Get store settings
app.get('/api/store-settings', async (req, res) => {
  try {
    let settings = await StoreSettings.findOne();
    if (!settings) {
      settings = new StoreSettings();
      await settings.save();
    }
    res.json({
      headerText: settings.headerText
    });
  } catch (err) {
    console.error('Error fetching store settings:', err);
    res.status(500).json({ message: 'Error fetching store settings' });
  }
});

// Update store settings
app.post('/api/store-settings', async (req, res) => {
  const { headerText } = req.body;
  
  try {
    let settings = await StoreSettings.findOne();
    if (!settings) {
      settings = new StoreSettings();
    }
    
    if (headerText !== undefined) {
      settings.headerText = headerText;
    }
    
    settings.updatedAt = new Date();
    await settings.save();
    
    console.log('✅ Store settings updated successfully');
    
    res.json({ 
      success: true, 
      message: 'Store settings updated successfully',
      settings: {
        headerText: settings.headerText
      }
    });
  } catch (err) {
    console.error('❌ Error updating store settings:', err);
    res.status(500).json({ message: 'Error updating store settings' });
  }
});

// ============== FRONTEND PROXY (Must be last route) ==============

app.use('/', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true, // WebSocket support for hot reload
  // Only proxy if request doesn't match our API routes
  filter: (pathname, req) => {
    const apiRoutes = [
      '/api',
      '/offers',
      '/transactions',
      '/settings',
      '/mpesa',
      '/accounting',
      '/register',
      '/login',
      '/create-test-user',
      '/create-admin',
      '/api/store-settings'  // Add this line
    ];
    // Check if the request path starts with any of the defined API routes
    return !apiRoutes.some(route => pathname.startsWith(route));
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy Error:', err.message);
    res.status(500).json({ 
      message: 'Frontend not available. Make sure your frontend is running on port 3000.' 
    });
  }
}));

// ============================================================

app.listen(PORT, () => {
  console.log('===========================================');
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('===========================================');
  console.log('M-Pesa Integration Active');
  console.log('Callback URL: http://localhost:5000/mpesa/callback');
  console.log('📡 Proxying frontend from http://localhost:3000');
  console.log('===========================================');
});
