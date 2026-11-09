# VRAJIX — Complete Digital Studio Website & Platform

> **Tagline:** Make it matter.  
> **Brand Type:** Independent Creative Technology & Digital Agency  
> **Founders:** Himesh Sharma & Tarun Sharma (Equal Co-Founders)  
> **Official Contact:** vrajix11@gmail.com  
> **Location:** Agra, Uttar Pradesh, India (Worldwide Remote)

---

## 🚀 Overview

VRAJIX is an editorial, high-performance digital agency web application. 

### Core Features:
- Fully responsive across mobile smartphones, tablets, and laptops.
- Equal Co-Founder presentation for **Himesh Sharma** & **Tarun Sharma** with dedicated profiles and direct communication links.
- Filterable showcase of services: Website Development, Mobile App Development, and Digital Solutions & Growth.
- Filterable case studies with interactive case study preview modals.
- Real-time client enquiry brief system with client-side validation, SQLite database storage, CSV export, direct WhatsApp connect, and email fallbacks.

---

## 🛠️ Quick Local Start

```bash
cd backend
npm install
npm run dev
```

Server runs on `http://localhost:5000` with the complete frontend and REST API active.

---

## 🛡️ Comprehensive Security Architecture Audit

The VRAJIX platform enforces industry-standard enterprise security controls:

### 1. Rate Limiting (DoS & Spam Defense)
- **Global API Limiter**: Enforces a maximum of 100 requests per 15 minutes per IP address.
- **Form Submission Limiter**: Enforces a strict limit of 5 project submissions per 15 minutes per IP to eliminate bot-spam and email bomb exploits.

### 2. Authorization vs. Authentication (IDOR Prevention)
- Public users can only submit briefs via `POST /api/enquiries` and receive their reference ID.
- Access to client data via `GET /api/enquiries` and `GET /api/enquiries/:id` is strictly protected by `requireAdminAuth` middleware. Requests without a valid `x-admin-key` or `Bearer` token receive `403 Forbidden`.

### 3. Secrets Management
- All API keys, database paths, and email SMTP credentials are read exclusively through server-side environment variables (`process.env`).
- Zero secrets are embedded into the frontend HTML or client-side JavaScript.

### 4. Input Sanitization & SQL Injection Defense
- Strict type, regex, and character validation.
- All user input is sanitized before persistence.
- All SQL database interactions in `database/db.js` use parameterized queries (`?` place-markers) to ensure 100% protection against SQL Injection attacks.
- `helmet` HTTP headers are enforced to prevent Cross-Site Scripting (XSS), Clickjacking, and MIME Sniffing.
