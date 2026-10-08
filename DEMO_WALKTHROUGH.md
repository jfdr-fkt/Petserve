# PetServe presentation walkthrough

Start with `npm start`, then open **http://127.0.0.1:3000**. In PowerShell, use `npm.cmd start` if script execution is restricted.

The sign-in page's demo picker fills these accounts. All start with **Petserve123!**:

| Role          | Email               |
| ------------- | ------------------- |
| Customer      | alex@example.test   |
| Employee      | staff@petserve.test |
| Administrator | admin@petserve.test |

Use separate browsers or private windows for the customer and employee so you can show both sides together.

1. **Payments immediately:** sign in as the customer and open **Payments & receipts**. Three sample receipts demonstrate Cash, GCash, and Maya. Open a receipt and show **Print / save PDF**. Sample entries are labeled **Demo visit**.
2. **Staff verification:** as the employee, open **Payments**, choose **Review transfer** for the pending Maya submission, confirm receipt, and save. Refresh the customer page to show the receipt appearing.
3. **Customer online payment:** choose the unpaid grooming visit, open **Pay with GCash / Maya**, and enter a sample reference such as `DEMO-GROOMING-001`. Demonstration wallet details are fictional: **do not send real money**. Submit, then verify the transfer from the employee side.
4. **Multiple pets, different services:** add a few pet profiles. In **Book a visit**, enable **Book multiple pets & services**. Select all pets, use the shared grooming card, then add deworming, vaccination, or consultation on individual checklists. Choose a future open day and an available arrival time. Show the service-time preview and send the request. The employee can confirm the linked services together from **Appointments**.
5. **Profile and settings:** open **My account**, choose a photo, save it, and show the sidebar photo. Change the theme using the dropdown. Password change and account removal sit in the Security section. Use a disposable registered account when demonstrating deletion.
6. **Chat:** send a message and a photo or video between the two windows. Delete a message, or use **Delete chat** as the customer to remove the entire conversation after confirming. Administrators can also delete conversations.
7. **Forgot password:** sign out, choose **Forgot password?**, and enter a demo address. Open the link in the **Demo inbox**, set a new password, and sign in with it. Reset links work once and expire after twenty minutes. If you reset a demo account, its password changes; use the new one for the rest of the presentation.
8. **Overview and administration:** click the **PetServe logo or name** to return to Overview. As the administrator, show account access, password recovery links, and schedule editing. Employees can view the schedule and their own shifts.

The sample payments load only once. Verification and profile changes remain saved between restarts; restarting signs everyone out. Keep the database and uploaded files together when backing up the demo.
