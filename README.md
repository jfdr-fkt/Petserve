# PetServe

A local, integrated pet care prototype for **Petopia Pet Care Services, Tagum City**. This revision implements the main customer, employee, and administrator workflows from the supplied Chapter 1 and framework/DFD documents. All roles share a white interface with blue and yellow accents inspired by the shop's branding, readable text sizes, and locally hosted Nunito Sans typography.

## Run

Use Node.js 20 or newer. From this folder, install dependencies and start the app:

```sh
npm install
npm start
```

Open **http://127.0.0.1:3000**. Startup builds the local React browser bundle automatically; `node server.js` also builds it before starting. Saved records, transfer submissions, wallet settings, and chat conversations live in `data/db.json`. Gallery files live in `data/uploads/`, private chat attachments in `data/uploads/chat/`, and private pet album files in `data/uploads/pets/`. An older database is migrated automatically without resetting its pets, bookings, or payments. Stop the server before copying both the database and uploads directory for a backup.

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

The sign-in page includes a collapsible **Quick sign in** account picker. Registration creates customer accounts only. Administrators can promote an account to employee or administrator and deactivate access. Access changes invalidate the affected account's other sessions. An administrator cannot deactivate or demote their own account.

For the presentation, normal startup adds five sample completed visits to the demo customer once: Cash, GCash, and Maya receipts, one Maya transfer awaiting staff verification, and one unpaid grooming visit. The examples use the regular visit and receipt labels and keep their saved state. Empty wallet settings receive placeholder details. Existing visits and configured shop wallets are retained. See [the presentation walkthrough](DEMO_WALKTHROUGH.md).

**Forgot password?** follows the email, reset link, and new-password flow. Reserved demo addresses (`.test`, `.invalid`, `.example`, and `example.com/net/org`) receive their reset link in the on-screen **Password reset link** panel. Links expire after twenty minutes and can be used once. Real addresses use clinic-assisted recovery: an administrator verifies the owner, then generates a link from **Accounts → Reset password**. This local prototype does not send real email. Changing a password requires the current password and signs out other sessions; resetting signs out all sessions.

## Included workflows

- **My Pets:** searchable companion list, detailed profile, local photo upload, full profile editing, species filters, birthday/age, sex, weight, sensitivities, comfort notes, and archiving. Photo selection preserves the form draft. Active visits must be closed before archiving; appointment and payment history is retained.
- **Pet albums:** each pet has a **Photos & videos** tab. Owners upload JPG, PNG, WebP, MP4, or WebM files with optional captions, up to 25 MB each and 50 items per pet. Photos open in a larger viewer, and videos support playback and seeking. Only the pet's owner and authorized employees/administrators can view the album; only the owner can upload or remove its items. Pet album uploads stay separate from the shared Petopia gallery and the profile picture. Albums persist across restarts. Archived profiles hide their albums; account deletion removes album records and files, including media from archived pets, while retaining clinic care and payment history.
- **Health records:** vaccination, deworming, and health notes with record dates, optional clinic-provided follow-up dates, and source labels distinguishing owner information from clinic records. These are records, not diagnosis or treatment advice.
- **Booking:** grooming, vaccination, deworming, and veterinary consultation; live availability, service prices, selected pets, visit notes, and a request summary. Enable **Book multiple pets & services** to select all pets or any combination, then check one or more services for each pet. Service cards above apply common care to every selected pet; each pet's checklist can be adjusted independently. Up to thirty pets can be included when their care fits the selected day. The customer chooses an arrival time and previews a complete plan using configured slots, care-team capacity, pet conflicts, blocked times, and closing time. All services are submitted together or none are saved. Grooming, vaccination, and deworming keep individual service appointments linked under one care request; consultations share a slot in groups of up to six pets, with per-pet pricing. Each service retains its booked price and per-pet history. The original single-service booking and shared-consultation workflow remains available. Slots use Asia/Manila time, up to 90 days ahead.
- **Appointments:** requests, staff confirmation or decline, owner-facing staff messages, cancellation, owner/administrator rescheduling for renewed review, and completed care notes. Linked care requests appear together. Staff can confirm or decline all pending services in one action; every time is checked again before confirmation. Customers and staff can cancel remaining upcoming care while preserving completed services and payments. Individual service actions, records, feedback, and receipts remain available. Requests do not reserve a resource until confirmed. Confirmed bookings check overlapping durations for one grooming team and one veterinary team. A pet cannot have overlapping active requests.
- **Clinic schedule:** a monthly calendar with separate clinic-visit and employee-shift views, month/year selectors, today navigation, and keyboard access. Administrators select one employee and plan a whole month: select individual dates, all days, weekdays, or a recurring weekday; apply different working hours, rest days, leave, and employee-visible reasons to each selection; then save the month together. Changes preview before saving, drafts survive switching employees or months within the current session, and selected assignments can be cleared. Past dates remain viewable. The server validates the whole batch before saving and preserves untouched dates and other employees. Employees see only their own monthly assignments and upcoming shifts; their view refreshes when returning to the window and periodically while open. Only administrators edit shifts, regular clinic opening days/times, resource blocks, or reschedule visits for customers. Individual shift editing remains available. Shift assignments stay separate from clinic appointment capacity. Availability changes conflicting with confirmed visits require rescheduling first.
- **Service management:** employees and administrators edit service names, descriptions, prices, and booking availability. Estimated duration is removed from service cards, appointment displays, summaries, and editing forms. Internal scheduling buffers continue to prevent overlapping resource bookings. Existing appointments retain their booked service name, unit price, combined price, scheduling buffer, and resource.
- **Completed services:** a separate service record links each completed service to its appointment and pet. Customers see it in their appointments and their pet's history.
- **Payments:** employees record clinic payments or verify customer online transfers after completing a visit. In **Payments → Wallet settings**, staff set the shop's GCash/Maya account name, mobile number, instructions, and enabled status. Normal startup prepares placeholder wallets and sample payment records without replacing configured shop details. Configure the shop’s verified wallet before taking actual transfers. For actual wallet details, customers transfer using their wallet app, then submit the amount and transaction reference. Submissions stay unpaid until staff checks receipt in the shop's wallet and verifies them. Rejected submissions carry a staff note and can be resubmitted. Pending transfers block duplicate/manual payments. Receipts print or save as PDF after verification or clinic payment recording.
- **Reports:** employees and administrators see appointment status counts, completed services, payment totals, outstanding payment records, service breakdowns, date filters, and CSV export. Report dates filter appointment dates; collections are payments linked to those appointments.
- **Staff list:** all signed-in roles can view staff names, positions, and the reporting hierarchy. Only administrators can add, edit, or remove directory entries and choose **Reports to**. The organizational chart places a centered root above horizontal branches, with aligned rows and sideways scrolling on narrow screens. When several entries are at the top level, Petopia connects their branches under one company root. Administrators can choose who reports to each supervisor. Self-reporting and circular relationships are rejected. Removing a supervisor moves direct reports to their supervisor or to the top level, preserving the rest of the team. The directory is maintained separately from sign-in accounts; editing a listing does not grant account access or change shifts. Existing employee and administrator names initialize the list once, and saved edits and removals persist across restarts.
- **Accounts:** administrators manage access roles and account status. All roles have a centered **My account** page with name, contact number, profile photo, appearance, password change, and compact account removal controls. JPG, PNG, and WebP photos are resized locally, validated by the server, saved with the profile, and shown in the sidebar and account shortcut. Selecting a photo preserves an unsaved name or phone draft. Administrators can also delete other accounts or generate recovery links from **Accounts**. Deletion requires the acting user's current password and explicit confirmation, revokes every session, removes sign-in/contact details and authored chat/media/feedback content, cancels pending or confirmed visits, and archives pet profiles. Clinic care, health history, and payment records remain for staff; deleted owners display as **Deleted account** on visits. The final active administrator cannot be removed. Customers receive only their own pets, appointments, health records, service records, and receipts.
- **Care updates:** confirmed customer visits, pending employee requests, follow-up reminders, and unread chat messages appear in the notification panel.
- **Private chat:** customers message the Petopia care team; employees and administrators use a customer inbox. Conversations support staff replies, unread counts, Enter-to-send, Shift+Enter for new lines, and persistent history. Attach JPG, PNG, WebP, MP4, or WebM files up to 25 MB, with or without a caption. Attachments are accessible only to conversation participants and the care team, and videos support seeking. Authors can delete their own messages; administrators can remove any message. Deletion removes the text and attachment for everyone and leaves a **Message deleted** marker. Messages refresh every three seconds while the chat page is visible without replacing an unsent draft or interrupting video playback. Customers cannot read or write another customer's conversation. The care team shares an inbox and read state. Customers can delete their entire own conversation; administrators can delete any conversation. Whole-chat deletion requires confirmation, removes all text and attachment files for both sides, and allows a fresh conversation afterward.
- **Visit feedback:** customers rate completed visits and optionally leave a comment; they can edit their feedback. Feedback is visible to its author and authorized employees/administrators. Staff can reply, view the average rating, and identify feedback awaiting a reply.
- **Shared Petopia gallery:** employees and administrators upload captioned grooming photos and videos, optionally tagged to a service. All signed-in customers can browse the same gallery. Staff confirm permission to share and can remove posts. JPG, PNG, WebP, MP4, and WebM files are supported, up to 25 MB each and 100 posts. Uploaded media remains behind authentication, supports video seeking, and persists across restarts.
- **Responsive UI:** the same navigation, forms, cards, buttons, typography, and status colors serve all three roles. The sidebar separates daily workflows, payment/help or clinic tools, community, and account settings, with additional space above and below group headings. Clicking the PetServe logo or name opens Overview; Overview has no separate sidebar row. Booking and appointments lead the customer menu; appointments and scheduling lead the employee menu. Desktop navigation collapses to an icon rail and remembers the preference; mobile navigation opens as a drawer. The menu scrolls independently while the account/sign-out controls remain available. Shared dropdowns have centered, padded chevrons that rotate smoothly when opened, keyboard selection, type-ahead, and reduced-motion support. Tables scroll within their panels. Dialogs and the mobile drawer manage keyboard focus and support Escape dismissal. Forms include inline validation.
- **Appearance and session screens:** a simple dropdown inside **My account** offers Petopia light, Midnight dark, Soft sage, and Match device themes. Preferences are saved on the device and applied before first paint. Navigation, pet tabs, and dialogs open immediately without fade, slide, or scale effects. The roomier sign-in page has a looping cartoon pet scene; successful sign-in shows a separate 1.8-second running-pet welcome. Successful sign-out clears private workspace data and shows a distinct scene with waving pets outside a little house, then returns to login after 2.4 seconds. Both screens offer a skip button and Escape dismissal. Reduced-motion preferences stop the login loop, skip the welcome, and display a static goodbye for one second. Receipts use a readable light palette when printed.

## Walkthrough

1. Sign in as the customer. Open **My pets**, add or edit a pet, upload a profile photo, and review **About**, **Health records**, and **Visit history**. Open **Photos & videos** to upload a photo or short video to that individual pet's album, view it, or remove it.
2. Open **Book a visit**, choose a service and available future time, then send the request. For mixed care, check **Book multiple pets & services**, use **Select all pets** or choose individual pets, and check the services each one needs. Choose an arrival time and review the complete service plan. For a shared consultation alone, select several pets with **Veterinary consultation**. Try **Reschedule** on an individual service to request a different time.
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
  media.js                    Upload validation, private media streaming and ranges
  routes.js                   Request dispatch and role-filtered bootstrap
  scheduling.js               Duration, opening-day, block, and conflict rules
  shift-plans.js              Monthly assignment validation, atomic updates and conflicts
  visits.js                   Group-pet selection and visit membership
  chat.js                     Role-filtered thread summaries and unread counts
  care-plans.js               Per-pet service validation and complete daily care planning
  account-security.js         Password validation, hashed one-use reset links and sessions
  demo-payments.js            Idempotent presentation visits, receipts and transfer examples
  routes/
    accounts.js               Authentication, contact details, administrator access
    account-deletion.js       Password-confirmed deletion, session and private content cleanup
    account-security.js       Password changes, demo recovery and administrator recovery
    chat-deletion.js          Confirmed whole-chat removal and attachment cleanup
    pets.js                   Pet profiles, archiving, health records
    pet-media.js              Owner uploads, protected pet albums, media streaming and removal
    staff.js                  Signed-in staff directory and administrator-only editing
    appointments.js           Requests, transitions, rescheduling, services, payments
    care-plans.js             Atomic multi-service requests, availability and grouped review
    clinic.js                 Administrator availability, service menu, reports
    shifts.js                 Administrator single-shift and monthly planning routes
    community.js              Visit feedback, staff replies, authenticated gallery media
    transfers.js              Wallet settings, transfer submissions and verification
    chat.js                   Private conversation access, messages and read state
    chat-media.js             Private attachments and permission-checked message deletion
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
    calendar-dates.js          Month, weekday and assignment labels
    schedule-calendar.js       Calendar rendering, navigation and keyboard access
    shift-planner.js           Per-employee monthly drafts, bulk assignments and saving
    schedule-updates.js        Live employee schedule refresh lifecycle
    icons.js                  Shared SVG icon definitions
    components.js             Shared forms, buttons, cards, receipts
    shell.js                  Role-aware navigation and notifications
    navigation.js             Role-aware workflow groups and menu ordering
    dialogs.js                Focused editing and workflow dialogs
    community-dialogs.js      Feedback and gallery editing dialogs
    pet-media.js              Individual pet albums, upload/removal dialogs, larger media viewer
    account-dialogs.js        Password management, recovery links and removal confirmations
    profile.js                Profile photo selection that preserves form drafts
    care-dialogs.js           Linked care request review and cancellation
    booking-plan.js           Per-pet selections, validation and service-time previews
    select-controls.js        Shared accessible dropdowns with animated chevrons
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

API tests use isolated databases and cover permissions, duplicate and overlapping bookings, group ownership and per-pet conflicts, multi-pet service combinations, daily capacity, complete request creation and confirmation without partial writes, cancellation that preserves completed care and payments, consultation grouping within a care plan, availability changes, service snapshots, rescheduling, health record validation, payment ownership, transfer rejection/verification and duplicate prevention, receipts, report totals, persistence, role management, private chat and unread counts, concurrent chat attachments, protected photo/video ranges, author/administrator message deletion, password-confirmed account deletion, session revocation and retained clinic records, feedback privacy/editing/replies, gallery upload validation, gallery persistence, profile photo validation, password change and session revocation, reset expiry and one-use protection, administrator-assisted recovery, whole-chat deletion permissions and attachment cleanup, and idempotent presentation payment examples.

The browser checks build the client and use an installed Google Chrome browser. Use `BROWSER_CHANNEL=msedge` to select Edge (PowerShell: `$env:BROWSER_CHANNEL = 'msedge'`). They exercise all three roles, photo upload without losing a draft, pet edits, health records, individual and group bookings, five-pet selection, individual and common service checklists, complete care previews, grouped staff confirmation, rescheduling, both pets' visit histories, completion, clinic payment, Maya transfer verification, receipt PDF, report export, grouped navigation, saved sidebar preferences, mobile drawer navigation, gallery photo/video uploads and playback, feedback editing, staff replies, live private chat with photo/video attachments and deletion, uninterrupted playback during polling and sidebar changes, customer/administrator account removal, theme persistence/device changes, aligned animated dropdowns, centered account layout, profile photos and draft preservation, password change and reset, compact account removal, logo navigation, full conversation deletion, sample receipts and transfer verification, keyboard selection and Escape behavior, reduced motion, continuous running-pet motion, removed duration labels, and mobile overflow. Screenshots and a receipt PDF are saved in the ignored `artifacts/ui/` directory. Browser and API tests do not touch the application's saved database.

`npm run format` applies the shared Prettier configuration.

`npm run build` regenerates the ignored `public/build/app.js` bundle after editing client code. The modular workflow views still produce escaped markup; React owns the persistent shell and dialog rendering. The synchronous rendering bridge preserves existing focus and form-draft behavior. React and esbuild are local npm dependencies; the browser does not load code from a CDN. Pet animation is isolated to local SVG artwork and CSS keyframes on sign-in and sign-out screens; it does not run during workspace navigation.

## Prototype boundaries

This is a substantial functional prototype targeting the requested 80-90% demonstration scope, not a measured production completion percentage. The supplied documents remain the workflow guide; the app does not show development scope banners.

Visit feedback, the shared gallery, group consultations, wallet transfer submissions, private chat, themes, and animations are user-requested extensions to the Chapter 1 baseline. Update the paper's feature scope if these extensions are included in the evaluated prototype.

Nunito Sans is bundled under the SIL Open Font License; its license is retained in `public/assets/fonts/OFL.txt`. The blue/yellow paw mark is a prototype brand symbol, not a reproduction of the store's actual logo.

Online payments use customer-initiated GCash/Maya transfers with manual staff verification. Submitting a reference does not move money or automatically mark a visit paid. No payment gateway, card data collection, wallet API access, or automated reconciliation is implemented. Existing payment records remain intact. Product sales and inventory are outside the document scope.

The seeded prices, internal 60-minute scheduling buffers, weekend opening days, 5 PM closing time, one resource per care team, six-pet consultation limit, and per-pet consultation pricing are defaults for demonstration. Confirm actual shop prices, grouping policy, capacity, access rules, and payment steps before operational use. Employees and administrators can change the service menu and wallet details. Only administrators can change employee shifts, opening days, start times, and blocked availability. Shift assignments start empty and use same-day start/end times; recurring rosters, overnight shifts, and attendance tracking are not implemented.

Remaining production work includes shop acceptance testing, a database designed for multiple server processes, persistent expiring sessions, real recovery email delivery, operational audit logs, backups, HTTPS hosting, and real notification delivery. Current sessions are held in memory and sign out on a server restart. The server binds to localhost and is intended for local demonstration.
