# PetServe · presentation prototype

**PetServe** is a runnable local web application for a pet care booking workflow. It is a focused **50% class prototype** demonstrating a complete path from pet owner to staff to payment record, pet profile photos, online payments, and pet medical & service history. Built for a presentation for Petopia Pet Care Services; the clinic name and listed services came from the shop photos and interview notes.

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

1. Sign in as **Alex**. Open **My pets** and show the seeded sample dog, Milo; set or change pet picture, view pet service history (grooming, vaccines), and add a health record.
2. Open **Book a visit**. Choose grooming, Milo, an upcoming **Saturday or Sunday** and a time (e.g. 10:00 AM). Submit.
3. Show **Online Payment**: customer can pay online directly (via GCash, Maya, or Credit Card) for instant confirmation and receipt generation!
4. Sign out and sign in as **Staff**. Open **Appointment queue** to review, confirm, or mark completed, and record manual payments or inspect online payment records.
5. View the **Reports** page for status breakdowns and recorded collection totals.

## What works now (50% Scope)

- Customer registration and sign-in; separate seeded staff account.
- **Pet Profile Photos & Custom Avatars**: Add or edit pet profile photos/pictures for dogs, cats, and other pets.
- **Online Customer Payments**: Customers can pay online directly via GCash, Maya, or Credit Card with instant digital receipt generation.
- **Pet Service & Vaccine History**: Under each pet profile, view full service history (Grooming, Vaccination, Deworming), health logs, and quick direct booking.
- Sample Saturday/Sunday booking slots in the **Asia/Manila** time zone, with pending → confirmed/rejected → completed/cancelled status changes.
- Double-booking protection for a **confirmed** groomer or veterinarian slot.
- Staff payment recording & receipt printing.
- Basic staff totals & data stored locally in `data/db.json`.

## Where to continue coding

| File | Purpose |
| --- | --- |
| `server.js` | HTTP API, booking rules, online payments, pet photos, health logs, and JSON persistence. |
| `public/index.html` | Page shell. |
| `public/styles.css` | Modern responsive styling & card layouts. |
| `public/app.js` | Customer and staff views, pet photo picker, online payment modal, pet history timeline. |
| `data/db.json` | Created on first launch; contains local sample accounts and saved demo data. |
| `tests/flow.test.js` | End-to-end API verification suite. Run `node --test tests/flow.test.js`. |

**PetServe** is the project name; **Petopia Pet Care Services** is the participating shop. Medical decisions remain with its veterinarian.
