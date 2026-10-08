# PetServe

A local, integrated pet care prototype for **Petopia Pet Care Services, Tagum City**. This revision implements the main customer, employee, and administrator workflows from the supplied Chapter 1 and framework/DFD documents. All roles share a white interface with blue and yellow accents inspired by the shop's branding, readable text sizes, and locally hosted Nunito Sans typography.

## Run

Use Node.js 20 or newer. From this folder, install dependencies and start the app:

```sh
npm install
npm start
```

Open **http://127.0.0.1:3000**. Startup builds the local React browser bundle automatically; `node server.js` also builds it before starting. Saved records, transfer submissions, wallet settings, and chat conversations live in `data/db.json`, and gallery files live in `data/uploads/`. An older database is migrated automatically without resetting its pets, bookings, or payments. Stop the server before copying both the database and uploads directory for a backup.

To use another port in PowerShell:

```powershell
$env:PORT = 3001
node server.js
```

## Demo accounts

| Role          | Email               | Password     |
| ------------- | ------------------- | ------------ |
| Customer      | alex@example.test   | Petserve123! |
| Employee      | staff@petserve.test | Petserve123! |
| Administrator | admin@petserve.test | Petserve123! |

The sign-in page includes a collapsible demo account picker. Registration creates customer accounts only. Administrators can promote an account to employee or administrator and deactivate access. Access changes invalidate the affected account's other sessions. An administrator cannot deactivate or demote their own account.

## Included workflows

- **My Pets:** searchable companion list, detailed profile, local photo upload, full profile editing, species filters, birthday/age, sex, weight, sensitivities, comfort notes, and archiving. Photo selection preserves the form draft. Active visits must be closed before archiving; appointment and payment history is retained.
- **Health records:** vaccination, deworming, and health notes with record dates, optional clinic-provided follow-up dates, and source labels distinguishing owner information from clinic records. These are records, not diagnosis or treatment advice.
- **Booking:** grooming, vaccination, deworming, and veterinary consultation; live availability, service prices, selected pets, visit notes, and a request summary. A consultation can group up to six of the customer's pets into one visit at the same start time. Its service price applies per pet and the summary shows the combined price. Grooming, vaccination, and deworming remain individual visits. Every selected pet is checked for overlapping requests and included in the visit history and completed record. Slots follow the administrator-configured opening days and start times in Asia/Manila, up to 90 days ahead.
- **Appointments:** requests, staff confirmation or decline, owner-facing staff messages, cancellation, owner/administrator rescheduling for renewed review, and completed care notes. Requests do not reserve a resource until confirmed. Confirmed bookings check overlapping durations for one grooming team and one veterinary team. A pet cannot have overlapping active requests.
- **Clinic schedule:** employees can view daily care team visits and their own assigned shifts, including the next three upcoming shifts. Only administrators can assign, edit, or remove working hours, edit regular opening days/times, add or reopen resource-specific full-day or one-hour blocks, or reschedule visits on behalf of customers. Shifts support notes and reject overlapping hours for the same employee. Shift assignments are separate from clinic appointment capacity. Availability changes that conflict with confirmed visits are refused until those visits are rescheduled.
- **Service management:** employees and administrators edit service names, descriptions, prices, and booking availability. Estimated duration is removed from service cards, appointment displays, summaries, and editing forms. Internal scheduling buffers continue to prevent overlapping resource bookings. Existing appointments retain their booked service name, unit price, combined price, scheduling buffer, and resource.
- **Completed services:** a separate service record links each completed service to its appointment and pet. Customers see it in their appointments and their pet's history.
- **Payments:** employees record clinic payments or verify customer online transfers after completing a visit. In **Payments → Wallet settings**, staff set the shop's GCash/Maya account name, mobile number, instructions, and enabled status. Wallets start disabled with empty details; no destination account is invented. Customers transfer using their wallet app, then submit the amount and transaction reference. Submissions stay unpaid until staff checks receipt in the shop's wallet and verifies them. Rejected submissions carry a staff note and can be resubmitted. Pending transfers block duplicate/manual payments. Receipts print or save as PDF after verification or clinic payment recording.
- **Reports:** employees and administrators see appointment status counts, completed services, payment totals, outstanding payment records, service breakdowns, date filters, and CSV export. Report dates filter appointment dates; collections are payments linked to those appointments.
- **Accounts:** administrators manage access roles and account status. All roles can update their own name and contact number. Customers receive only their own pets, appointments, health records, service records, and receipts.
- **Care updates:** confirmed customer visits, pending employee requests, follow-up reminders, and unread chat messages appear in the notification panel.
- **Private chat:** customers message the Petopia care team; employees and administrators use a customer inbox. Conversations support staff replies, unread counts, Enter-to-send, Shift+Enter for new lines, and persistent history. Messages refresh every three seconds while the chat page is visible without replacing an unsent draft. Customers cannot read or write another customer's conversation. The care team shares an inbox and read state.
- **Visit feedback:** customers rate completed visits and optionally leave a comment; they can edit their feedback. Feedback is visible to its author and authorized employees/administrators. Staff can reply, view the average rating, and identify feedback awaiting a reply.
- **Shared Petopia gallery:** employees and administrators upload captioned grooming photos and videos, optionally tagged to a service. All signed-in customers can browse the same gallery. Staff confirm permission to share and can remove posts. JPG, PNG, WebP, MP4, and WebM files are supported, up to 25 MB each and 100 posts. Uploaded media remains behind authentication, supports video seeking, and persists across restarts.
- **Responsive UI:** the same navigation, forms, cards, buttons, typography, and status colors serve all three roles. Desktop navigation collapses to an icon rail and remembers the preference; mobile navigation opens as a drawer. Tables scroll within their panels. Dialogs and the mobile drawer manage keyboard focus and support Escape dismissal. Forms include inline validation.
- **Appearance and session screens:** a simple dropdown inside **My account** offers Petopia light, Midnight dark, Soft sage, and Match device themes. Preferences are saved on the device and applied before first paint. Navigation, pet tabs, and dialogs open immediately without fade, slide, or scale effects. The roomier sign-in page has a looping cartoon pet scene; successful sign-in shows a separate 1.8-second running-pet welcome. Successful sign-out clears private workspace data and shows a distinct scene with waving pets outside a little house, then returns to login after 2.4 seconds. Both screens offer a skip button and Escape dismissal. Reduced-motion preferences stop the login loop, skip the welcome, and display a static goodbye for one second. Receipts use a readable light palette when printed.

## Walkthrough

1. Sign in as the customer. Open **My pets**, add or edit a pet, upload a photo, and review **About**, **Health records**, and **Visit history**.
2. Open **Book a visit**, choose a service and available future time, then send the request. For **Veterinary consultation**, select several pets to create one group visit. Try **Reschedule** to request a different time.
3. Sign in as the employee. Open **Appointments**, confirm the request, and inspect **Schedule**. Schedule editing controls are available only to the administrator.
4. Use **Record completed care** to enter service notes. For clinic payment, choose **Record payment**. To demonstrate online transfers, set the shop's wallet details in **Payments → Wallet settings**, return as the customer and submit a transaction reference, then verify receipt as the employee. Open the generated receipt and use **Print / save PDF**.
5. Open **Petopia gallery** as the employee, upload a photo or video, add a caption, and confirm permission to share.
6. Return as the customer to inspect the completed service and receipt, leave visit feedback, and browse the shared gallery. Staff can reply in **Customer feedback**.
7. Sign in as the administrator. Use **Schedule** to test **Manage availability**, **Block time**, and **Reopen**. Use **Assign shift** to set employee hours, then sign in as that employee to view them. Review **Accounts** and **Reports**, apply a date range, and export the totals.
8. Try **Chat with Petopia** as a customer and **Customer messages** as staff in separate browsers or private windows. Open **My account** to test themes.

## Project structure

```text
server.js                     HTTP server entry point
client/
  interface.jsx               React shell and immediate dialog rendering bridge
scripts/
  build.cjs                   Local browser bundling with esbuild
src/
  config.js                   Seed service menu and constants
  db.js                       Migration, persistence, password hashing, projections
  helpers.js                  Input and Asia/Manila date helpers
  http.js                     HTTP body handling, access guards, static files
  routes.js                   Request dispatch and role-filtered bootstrap
  scheduling.js               Duration, opening-day, block, and conflict rules
  visits.js                   Group-pet selection and visit membership
  chat.js                     Role-filtered thread summaries and unread counts
  routes/
    accounts.js               Authentication, contact details, administrator access
    pets.js                   Pet profiles, archiving, health records
    appointments.js           Requests, transitions, rescheduling, services, payments
    clinic.js                 Administrator availability, service menu, reports
    shifts.js                 Administrator shift assignment and overlap validation
    community.js              Visit feedback, staff replies, authenticated gallery media
    transfers.js              Wallet settings, transfer submissions and verification
    chat.js                   Private conversation access, messages and read state
public/
  index.html                  Accessible page and dialog mounts
  app.js                      Navigation and interaction orchestration
  styles.css                  Stylesheet entry point
  css/                        Shared tokens, base, layout, components, views, responsive rules
  assets/                     Local pet illustrations and licensed Nunito Sans fonts
  js/
    api.js                    API client and toast feedback
    state.js                  Central UI state and drafts
    utils.js                  Escaping, dates, amounts
    icons.js                  Shared SVG icon definitions
    components.js             Shared forms, buttons, cards, receipts
    shell.js                  Role-aware navigation and notifications
    dialogs.js                Focused editing and workflow dialogs
    community-dialogs.js      Feedback and gallery editing dialogs
    payment-dialogs.js        Wallet transfer, settings and verification dialogs
    chat.js                   Polling, delivery and updates that preserve drafts
    pet-scenes.js             Local cartoon dog/cat vector scenes
    session-scenes.js         Login/logout scenes, skip, focus management and cleanup
    shift-schedule.js          Shift display and administrator editing dialogs
    themes.js                 Theme dropdown and saved preferences
    theme-init.js             Initial palette before first paint
    views/                    Authentication, overview, pets, booking, clinic, appointments, community, chat
 tests/                       API integration and browser workflow checks
```

## Checks

For development tools, install dependencies once:

```sh
npm install
npm test
npm run test:browser
npm run format:check
```

In PowerShell environments that block `npm.ps1`, use `npm.cmd` instead.

API tests use isolated databases and cover permissions, duplicate and overlapping bookings, group ownership and per-pet conflicts, availability changes, service snapshots, rescheduling, health record validation, payment ownership, transfer rejection/verification and duplicate prevention, receipts, report totals, persistence, role management, private chat and unread counts, feedback privacy/editing/replies, gallery upload validation, protected media ranges, and gallery persistence.

The browser checks build the client and use an installed Google Chrome browser. Use `BROWSER_CHANNEL=msedge` to select Edge (PowerShell: `$env:BROWSER_CHANNEL = 'msedge'`). They exercise all three roles, photo upload without losing a draft, pet edits, health records, individual and group bookings, rescheduling, both pets' visit histories, completion, clinic payment, Maya transfer verification, receipt PDF, report export, saved sidebar preferences, mobile drawer navigation, gallery photo/video uploads and playback, feedback editing, staff replies, live private chat while preserving a draft, theme persistence/device changes, reduced motion, removed duration labels, and mobile overflow. Screenshots and a receipt PDF are saved in the ignored `artifacts/ui/` directory. Browser and API tests do not touch the application's saved database.

`npm run format` applies the shared Prettier configuration.

`npm run build` regenerates the ignored `public/build/app.js` bundle after editing client code. The modular workflow views still produce escaped markup; React owns the persistent shell and dialog rendering. The synchronous rendering bridge preserves existing focus and form-draft behavior. React and esbuild are local npm dependencies; the browser does not load code from a CDN. Pet animation is isolated to local SVG artwork and CSS keyframes on sign-in and sign-out screens; it does not run during workspace navigation.

## Prototype boundaries

This is a substantial functional prototype targeting the requested 80-90% demonstration scope, not a measured production completion percentage. The supplied documents remain the workflow guide; the app does not show development scope banners.

Visit feedback, the shared gallery, group consultations, wallet transfer submissions, private chat, themes, and animations are user-requested extensions to the Chapter 1 baseline. Update the paper's feature scope if these extensions are included in the evaluated prototype.

Nunito Sans is bundled under the SIL Open Font License; its license is retained in `public/assets/fonts/OFL.txt`. The blue/yellow paw mark is a prototype brand symbol, not a reproduction of the store's actual logo.

Online payments use customer-initiated GCash/Maya transfers with manual staff verification. Submitting a reference does not move money or automatically mark a visit paid. No payment gateway, card data collection, wallet API access, or automated reconciliation is implemented. Existing payment records remain intact. Product sales and inventory are outside the document scope.

The seeded prices, internal 60-minute scheduling buffers, weekend opening days, 5 PM closing time, one resource per care team, six-pet consultation limit, and per-pet consultation pricing are defaults for demonstration. Confirm actual shop prices, grouping policy, capacity, access rules, and payment steps before operational use. Employees and administrators can change the service menu and wallet details. Only administrators can change employee shifts, opening days, start times, and blocked availability. Shift assignments start empty and use same-day start/end times; recurring rosters, overnight shifts, and attendance tracking are not implemented.

Remaining production work includes shop acceptance testing, a database designed for multiple server processes, persistent expiring sessions, account recovery, operational audit logs, backups, HTTPS hosting, and real notification delivery. Current sessions are held in memory and sign out on a server restart. The server binds to localhost and is intended for local demonstration.
