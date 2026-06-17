# STREET RAGE - Omnichannel Retail POS & Inventory Space

A premium, high-performance retail management software designed for **STREET RAGE** stores. This system integrates real-time billing (POS), multi-device hardware syncing, size/color inventory matrices, CRM registry, and automated returns.

---

## Key Features

### 1. Hardwired Retail Compatibility
Tailored and verified for the store's physical checkout hardware set:
* **Thermal Bill Printer:** Model `SP-POS893UED` (80mm width, USB/LAN connection, high-speed thermal roll printing).
* **Barcode Scanner:** Model `MJ2818A` (USB Keyboard emulation, auto-carriage return scanning support).
* **Barcode Printer:** Model `TVS LP 46 Dlite Plus` (50x25mm sticky label layout, automated check-digit generation).
* **Print Margin Suppressors:** Injected `@page { margin: 0; }` style directives to disable native browser headers, footers, URLs, and date-stamps on thermal receipts and sticker layouts.

### 2. Fast Billing (POS)
* **Single-Variant Auto Add:** Scan a barcode on the search input—if the scanned item is single-variant (like accessories with a single color/size), it is **instantly added** directly to the invoice cart without showing dialog boxes.
* **Multi-Variant Popups:** For garments with size/color grids, scanning auto-opens a selection modal.
* **Indian GST Math Safety:** Restructured invoicing taxes with explicit `Math.round(val * 100) / 100` computations to prevent JavaScript floating-point representation rounding errors.
* **Flexible Checkouts:** Supports walk-in customers or CRM linked customers (verifying 10-digit mobile formatting and email syntax).
* **Payment Mode Reconciliation:** Cashiers specify checkout payments (**Cash**, **Card**, **UPI**, or **Store Credit**).

### 3. Role-Based Access (Privilege Separation)
* **Cashier Role (e.g. `billing@gmail.com`):** Restricts access so cashier staff can bill, scan, lookup customers, and process returns, but cannot view store-wide revenue analytics, product cost prices (masked with `***`), or delete inventory items.
* **Administrator Role (emails containing `admin` or `owner`):** Unlocks full access to cost sheets, item deletion buttons, and overall financial dashboard reports.

### 4. Returns & Exchanges (RMA)
* **Live Orders Lookup:** Search functions fetch the actual transaction database for validation instead of using placeholder fallbacks.
* **Legacy Invoice Support:** Legacy transactions (created before detailed logging was implemented) load a virtual item checkbox, allowing cashiers to process returns/exchanges without layouts breaking.
* **Matrix Re-stocking:** Restocks the exact size/color variant (e.g., `M / Navy`) to the inventory stock matrix, and handles deduction values for size exchanges.

### 5. Clean Database & Cloud-Sync
* **Zero Demo Data:** All hardcoded arrays are cleared for a completely fresh deployment.
* **Firebase Firestore Sync:** Automatically imports and pushes live products, transactions, returns, and customers to Google Cloud Firestore immediately on authentication.
* **Offline Cache:** Saves updates to local cache buffers for quick local rendering.

---

## Tech Stack

* **Framework:** React 18 (Vite compiler)
* **Database & Auth:** Firebase (Firestore & Firebase Auth)
* **Styling:** Vanilla CSS, Framer Motion (micro-animations), Lucide React
* **UI Base:** [shadcn/ui](https://ui.shadcn.com/)

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
VITE_FIREBASE_API_KEY="AIzaSyBi-DZHiGIsvy9SAYHnru..."
VITE_FIREBASE_AUTH_DOMAIN="street-rage.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="street-rage"
VITE_FIREBASE_STORAGE_BUCKET="street-rage.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="1081919852327"
VITE_FIREBASE_APP_ID="1:1081919852327:web:afcb63..."
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

---

## Netlify Deployment Guide

1. Push your repository to GitHub.
2. Link your repository in the Netlify Dashboard.
3. Configure the following build settings:
   * **Build command:** `npm run build`
   * **Publish directory:** `dist`
4. Add your `.env` variables under **Site settings > Environment variables**.
5. Deploy the site!
