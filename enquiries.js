const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { saveEnquiry, getAllEnquiries, getEnquiryById } = require('../../database/db');
const { sendEnquiryNotification } = require('../utils/mailer');

// ============================================================
// SECURITY CHECK #1: Strict Rate Limiting on Form Submission
// Max 5 submissions per 15 minutes per IP (Prevents Spam & Mail Bombing)
// ============================================================
const enquirySubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Enquiry submission limit reached. You can submit a maximum of 5 briefs every 15 minutes to prevent spam.'
  }
});

// ============================================================
// SECURITY CHECK #3: Authentication & Authorization Middleware
// Protects sensitive client enquiries from unauthorized third-party access (IDOR Prevention)
// ============================================================
function requireAdminAuth(req, res, next) {
  const adminSecret = process.env.ADMIN_API_KEY || 'vrajix_super_secret_admin_2026';
  const providedKey = req.headers['x-admin-key'] || 
                      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
                        ? req.headers.authorization.split(' ')[1] 
                        : null);

  if (!providedKey || providedKey !== adminSecret) {
    return res.status(403).json({
      success: false,
      error: '403 Forbidden: Access Denied. Valid admin authorization credentials required to access client records.'
    });
  }

  next();
}

// Input Sanitization Helper: Strips dangerous HTML & script tags (XSS Prevention)
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
}

/**
 * POST /api/enquiries
 * Public submission endpoint with Rate Limiting & Input Sanitization
 */
router.post('/', enquirySubmitLimiter, async (req, res) => {
  try {
    const { 
      clientName, 
      clientEmail, 
      clientPhone, 
      requiredService, 
      projectBudget, 
      projectTimeline, 
      projectDetails 
    } = req.body;

    // 1. Strict Field Validations
    if (!clientName || clientName.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Full name is required (min 2 characters).' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!clientEmail || !emailRegex.test(clientEmail.trim())) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }

    if (!clientPhone || clientPhone.trim().length < 8) {
      return res.status(400).json({ success: false, error: 'A valid phone number is required.' });
    }

    if (!requiredService) {
      return res.status(400).json({ success: false, error: 'Required service must be specified.' });
    }

    if (!projectDetails || projectDetails.trim().length < 15) {
      return res.status(400).json({ success: false, error: 'Project requirements must be at least 15 characters.' });
    }

    // 2. Sanitize Inputs
    const cleanName = sanitizeString(clientName);
    const cleanEmail = sanitizeString(clientEmail).toLowerCase();
    const cleanPhone = sanitizeString(clientPhone);
    const cleanService = sanitizeString(requiredService);
    const cleanBudget = sanitizeString(projectBudget || '₹50,000 - ₹1,50,000');
    const cleanTimeline = sanitizeString(projectTimeline || 'Standard (3-4 Weeks)');
    const cleanDetails = sanitizeString(projectDetails);

    const refId = 'VRX-' + Math.floor(1000 + Math.random() * 9000);
    const record = {
      refId,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      service: cleanService,
      budget: cleanBudget,
      timeline: cleanTimeline,
      details: cleanDetails,
      timestamp: new Date().toISOString()
    };

    // 3. Save via Parameterized SQL Query in db.js (SQL Injection Proof)
    const saved = await saveEnquiry(record);

    // 4. Asynchronous email alert to vrajix11@gmail.com
    sendEnquiryNotification(record).catch(err => {
      console.warn('[VRAJIX Mailer Notification Error]:', err.message);
    });

    return res.status(201).json({
      success: true,
      refId,
      message: 'Your project brief has been securely registered and dispatched to founders Himesh Sharma & Tarun Sharma.',
      data: {
        refId: saved.refId,
        service: saved.service,
        timestamp: saved.timestamp
      }
    });
  } catch (err) {
    console.error('[VRAJIX API Error]', err);
    return res.status(500).json({ success: false, error: 'Internal server error while processing brief.' });
  }
});

/**
 * GET /api/enquiries
 * Protected Endpoint: Requires Admin Authorization Key
 */
router.get('/', requireAdminAuth, async (req, res) => {
  try {
    const records = await getAllEnquiries();
    return res.status(200).json({ success: true, count: records.length, data: records });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve enquiries database.' });
  }
});

/**
 * GET /api/enquiries/:id
 * Protected Endpoint: Requires Admin Authorization Key
 */
router.get('/:id', requireAdminAuth, async (req, res) => {
  try {
    const record = await getEnquiryById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Enquiry record not found.' });
    }
    return res.status(200).json({ success: true, data: record });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve enquiry.' });
  }
});

module.exports = router;
