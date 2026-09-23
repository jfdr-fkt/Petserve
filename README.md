# PetServe · presentation prototype

**PetServe** is a runnable local web application for a pet care booking workflow. It is a focused **30% class prototype**, not a claim that exactly 30% of the final project is complete. It demonstrates a complete path from pet owner to staff to payment record. Built for a presentation for Petopia Pet Care Services; the clinic name and listed services came from the shop photos and interview notes.

## Start in VS Code

1. Extract this ZIP, then open the `petserve-prototype` folder in VS Code.
2. Install [Node.js](https://nodejs.org/) **20 or newer** if it is not already installed. Run `node --version` in the VS Code terminal.
3. In that folder, run **`node server.js`** (or `npm start`; no `npm install` needed).
4. Open **http://127.0.0.1:3000** in a browser. Keep the terminal open while presenting.
5. To stop the app, press **Ctrl+C** in that terminal.

The first run creates `data/db.json` automatically. Requests and payments stay there after a restart. If port 3000 is busy, run `PORT=3001 node server.js` in macOS/Linux, or `$env:PORT=3001; node server.js` in PowerShell and use that port in the URL. The server intentionally listens on this computer only.

## Demo sign-ins

| Role | Email | Password |
| --- | --- | --- |
| Pet owner | `alex@example.test` | `Petserve123!` |
| Staff | `staff@petserve.test` | `Petserve123!` |

These are **fictional local demo accounts**. You can also create a new customer account on the sign-in page. Registration never creates a staff account. Do not deploy with these sample credentials.

## Five-minute presentation walkthrough

1. Sign in as **Alex**. Open **My pets** and show the seeded sample dog, Milo; optionally add another fictional pet.
2. Open **Book a visit**. Choose grooming, Milo, an upcoming **Saturday or Sunday** and a time (e.g. 10:00 AM). Submit. The visit appears **Pending** in My appointments.
3. Sign out (arrow beside the profile) and sign in as **Staff**. Open **Appointment queue** and press **Confirm**. Add an optional note for the customer. You cannot confirm two grooming requests for the same slot.
4. Press **Mark completed**. Then **Record payment**, enter a sample amount and method. This only saves a payment that staff says was received; **there is no online payment processing**.
5. Return to the customer account. My appointments now shows **Completed** and the saved payment record. Staff can show the **Reports** page for request counts and recorded amounts.

## What works now

- Customer registration and sign-in; separate seeded staff account.
- Customer-owned pet profiles and access checks.
- Grooming, vaccination and deworming requests.
- Sample Saturday/Sunday booking slots in the **Asia/Manila** time zone, with pending → confirmed/rejected → completed/cancelled status changes. Customer can cancel a pending request.
- Double-booking protection for a **confirmed** groomer or veterinarian slot; staff can review simultaneous requests before confirming one.
- Staff records a single received payment against a completed visit; customer sees the result. No price is pre-filled or invented.
- Basic staff totals; data stored locally in a JSON file so a restart retains the demo.

## Scope and shop details to verify

- The printed veterinarian card lists **Saturday and Sunday, 8 AM–6 PM**. The app uses **sample** weekend slots from 9 AM to 4 PM for *all* services for a demo. Confirm the groomer’s availability, exact operating days, slot length, breaks, holidays and appointment capacity before real use.
- Shop interview notes list pet grooming, vaccination, deworming and supplies (food, medicine, bowls, diapers, accessories). Product sales and inventory are **future modules**, so they are not represented as completed work here.
- Confirm actual service names, prices, deposits, payment options, policies and staff roles with Petopia. `Cash`, `E-wallet` and `Other` are generic manual record categories.
- This prototype has **no** text/email reminders, receipt printing, medical record system, online payments, stock management, account recovery, audit trail or production-grade security/privacy controls. Keep all entered data fictional. It runs on one computer; other devices do not automatically share the data.

## Where to continue coding

| File | Purpose |
| --- | --- |
| `server.js` | HTTP API, booking rules, authentication and JSON persistence. `SERVICES` and `TIME_SLOTS` are near the top. |
| `public/index.html` | Page shell. |
| `public/styles.css` | Responsive styling. |
| `public/app.js` | Customer and staff views, forms and API requests. |
| `data/db.json` | Created on first launch; contains local sample accounts and saved demo data. |
| `tests/flow.test.js` | A meaningful end-to-end API flow. Run `npm test`. |

To reset only the local demo, stop the server, delete `data/db.json`, then restart it. This recreates the sample users and Milo and **removes all additional local entries**. For a real deployment, replace JSON storage with a database, add secure session persistence and operational controls, confirm the shop's rules, and remove the demo credentials.

## System flow for the defense

| Input | Process | Output |
| --- | --- | --- |
| Customer and pet details, service, preferred date/time, optional note | Staff reviews the request and confirms or rejects it; the server checks the service team's slot | Appointment status visible to customer and staff |
| Amount and method **after** completed service | Staff records a received payment once | Payment details appear on the appointment; staff report totals update |

**PetServe** is the project name; **Petopia Pet Care Services** is the participating shop. Medical decisions remain with its veterinarian.
