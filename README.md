# PetServe

A local, integrated pet care prototype for **Petopia Pet Care Services, Tagum City**. This revision implements the main customer, employee, and administrator workflows from the supplied Chapter 1 and framework/DFD documents. All roles share a white interface with blue and yellow accents inspired by the shop's branding, readable text sizes, and locally hosted Nunito Sans typography.

## Run

Use Node.js 20 or newer. From this folder:

```sh
node server.js
```

Open **http://127.0.0.1:3000**. The application has no production dependencies. Saved records live in `data/db.json`, and gallery files live in `data/uploads/`. An older database is migrated automatically without resetting its pets, bookings, or payments. Stop the server before copying both the database and uploads directory for a backup.

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
- **Booking:** grooming, vaccination, deworming, and veterinary consultation; live availability, estimated prices, visit length, selected pet, visit notes, and a request summary. Slots follow the staff-configured opening days and start times in Asia/Manila, up to 90 days ahead.
- **Appointments:** requests, staff confirmation or decline, owner-facing staff messages, cancellation, rescheduling for renewed review, and completed care notes. Requests do not reserve a resource until confirmed. Confirmed bookings check overlapping durations for one grooming team and one veterinary team. A pet cannot have overlapping active requests.
- **Staff schedule:** daily visits by care team, editable regular opening days/times, and resource-specific full-day or one-hour blocks. Availability changes that conflict with confirmed visits are refused until those visits are rescheduled.
- **Service management:** employees and administrators edit service names, descriptions, estimated prices, visit lengths, and booking availability. Existing appointments retain their booked service name, estimated price, duration, and resource.
- **Completed services:** a separate service record links each completed service to its appointment and pet. Customers see it in their appointments and their pet's history.
- **Payments:** employees record amount received, method, reference, recorder, and timestamp after completing a visit. Customers view receipts; receipts print or save as PDF. Duplicate payment records are blocked.
- **Reports:** employees and administrators see appointment status counts, completed services, payment totals, outstanding payment records, service breakdowns, date filters, and CSV export. Report dates filter appointment dates; collections are payments linked to those appointments.
- **Accounts:** administrators manage access roles and account status. All roles can update their own name and contact number. Customers receive only their own pets, appointments, health records, service records, and receipts.
- **Care updates:** confirmed customer visits, pending employee requests, and recorded follow-up reminders appear in the notification panel.
- **Visit feedback:** customers rate completed visits and optionally leave a comment; they can edit their feedback. Feedback is visible to its author and authorized employees/administrators. Staff can reply, view the average rating, and identify feedback awaiting a reply.
- **Shared Petopia gallery:** employees and administrators upload captioned grooming photos and videos, optionally tagged to a service. All signed-in customers can browse the same gallery. Staff confirm permission to share and can remove posts. JPG, PNG, WebP, MP4, and WebM files are supported, up to 25 MB each and 100 posts. Uploaded media remains behind authentication, supports video seeking, and persists across restarts.
- **Responsive UI:** the same navigation, forms, cards, buttons, typography, and status colors serve all three roles. Desktop navigation collapses to an icon rail and remembers the preference; mobile navigation opens as a drawer. Tables scroll within their panels. Dialogs and the mobile drawer manage keyboard focus and support Escape dismissal. Forms include inline validation.

## Walkthrough

1. Sign in as the customer. Open **My pets**, add or edit a pet, upload a photo, and review **About**, **Health records**, and **Visit history**.
2. Open **Book a visit**, choose a pet, service, and available future time, then send the request. Try **Reschedule** to request a different time.
3. Sign in as the employee. Open **Appointments**, confirm the request, and inspect **Schedule**. Test **Manage availability** or **Block time**.
4. Use **Record completed care** to enter service notes, then **Record payment**. Open the generated receipt and use **Print / save PDF**.
5. Open **Petopia gallery** as the employee, upload a photo or video, add a caption, and confirm permission to share.
6. Return as the customer to inspect the completed service and receipt, leave visit feedback, and browse the shared gallery. Staff can reply in **Customer feedback**.
7. Sign in as the administrator. Review **Accounts** and **Reports**, apply a date range, and export the totals.

## Project structure

```text
server.js                     HTTP server entry point
src/
  config.js                   Seed service menu and constants
  db.js                       Migration, persistence, password hashing, projections
  helpers.js                  Input and Asia/Manila date helpers
  http.js                     HTTP body handling, access guards, static files
  routes.js                   Request dispatch and role-filtered bootstrap
  scheduling.js               Duration, opening-day, block, and conflict rules
  routes/
    accounts.js               Authentication, contact details, administrator access
    pets.js                   Pet profiles, archiving, health records
    appointments.js           Requests, transitions, rescheduling, services, payments
    clinic.js                 Availability, schedule, service menu, reports
    community.js              Visit feedback, staff replies, authenticated gallery media
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
    views/                    Authentication, overview, pets, booking, clinic, appointments, community
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

API tests use isolated databases and cover permissions, duplicate and overlapping bookings, availability changes, service snapshots, rescheduling, health record validation, payment ownership, receipts, report totals, persistence, role management, feedback privacy/editing/replies, gallery upload validation, protected media ranges, and gallery persistence.

The browser check uses an installed Google Chrome browser. Use `BROWSER_CHANNEL=msedge` to select Edge (PowerShell: `$env:BROWSER_CHANNEL = 'msedge'`). It exercises all three roles, photo upload without losing a draft, pet edits, health records, booking, rescheduling, completion, payment, receipt PDF, report export, saved sidebar preferences, mobile drawer navigation, gallery photo/video uploads and playback, feedback editing, staff replies, and mobile overflow checks. Screenshots and a receipt PDF are saved in the ignored `artifacts/ui/` directory. Browser and API tests do not touch the application's saved database.

`npm run format` applies the shared Prettier configuration.

## Prototype boundaries

This is a substantial functional prototype targeting the requested 80-90% demonstration scope, not a measured production completion percentage. The supplied documents remain the workflow guide; the app does not show development scope banners.

Visit feedback and the shared gallery are user-requested extensions to the Chapter 1 baseline. Their scope stays limited to completed-visit ratings/comments, staff replies, and staff-published media for signed-in customers. They do not add public reviews, customer uploads, social feeds, or media messaging. Update the paper's feature scope if these extensions are included in the evaluated prototype.

Nunito Sans is bundled under the SIL Open Font License; its license is retained in `public/assets/fonts/OFL.txt`. The blue/yellow paw mark is a prototype brand symbol, not a reproduction of the store's actual logo.

Payments are recorded at the clinic. The former simulated customer online payment endpoint is disabled; no external payment gateway or online card collection is implemented. Existing payment records remain intact. Product sales and inventory are outside the document scope.

The seeded prices, 60-minute services, weekend opening days, 5 PM closing time, and one resource per care team are defaults for demonstration. Confirm actual shop prices, durations, capacity, access rules, and payment steps before operational use. Staff can change the service menu, opening days, start times, and blocked availability.

Remaining production work includes shop acceptance testing, a database designed for multiple server processes, persistent expiring sessions, account recovery, operational audit logs, backups, HTTPS hosting, and real notification delivery. Current sessions are held in memory and sign out on a server restart. The server binds to localhost and is intended for local demonstration.
