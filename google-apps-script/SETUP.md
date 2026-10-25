# Connecting the booking calendar to Google Calendar

This connects the "Book a Session" calendar on knphysio.online to Kabelo's
Google Calendar. Once it's set up:

- Anything in his calendar (appointments, personal plans, days off) shows as
  unavailable on the website.
- When a patient books, the appointment is added to his calendar straight
  away, and he gets an email with the patient's details.
- Open slots are first come, first served: if a slot shows on the website,
  it's bookable. Kabelo only needs to keep his calendar up to date.
- The website only ever sees *when* he is busy, never event names or details.

Setup takes about 10 minutes and only needs to be done once.

## 1. Create the script

1. On a computer, sign in to Google as **kabelonyalungu7@gmail.com**.
2. Go to <https://script.google.com> and click **New project**.
3. Click **Untitled project** at the top and rename it to **KN Physio Bookings**.
4. Delete everything in the editor, then paste in the full contents of
   [`Code.gs`](https://github.com/edwardmawela222/knphysio/blob/main/google-apps-script/Code.gs).
5. Click the **Save** icon.

## 2. Set the time zone

1. Click the **gear icon** (Project Settings) on the left.
2. Under **Time zone**, choose **(GMT+02:00) South Africa Standard Time – Johannesburg**.

## 3. Publish it as a web app

1. Click **Deploy → New deployment** (top right).
2. Click the gear next to **Select type** and choose **Web app**.
3. Fill in:
   - **Description:** Website bookings
   - **Execute as:** Me (kabelonyalungu7@gmail.com)
   - **Who has access:** Anyone
4. Click **Deploy**, then **Authorize access** and choose his Google account.
5. Google will warn **"Google hasn't verified this app"**. That's expected for a
   script you wrote yourself. Click **Advanced → Go to KN Physio Bookings
   (unsafe)**, then **Allow**. The script asks for:
   - **Calendar:** to read busy times and add bookings
   - **Send email as you:** to email him about new bookings
6. Copy the **Web app URL** (it ends in `/exec`) and send it to the website
   developer, who will switch the website over to the live calendar.

## Check it works

Open the Web app URL with a date range added to the end, for example:

```
https://script.google.com/macros/s/…/exec?from=2026-11-01&to=2026-11-30
```

You should see something like `{"ok":true,"busy":[…]}` listing his busy times.

## Day-to-day use

| To… | Do this in Google Calendar |
| --- | --- |
| Accept a booking | Nothing to do. It's already in the calendar and the slot is taken. |
| Cancel a booking (an exception) | Let the patient know on WhatsApp, then delete the event. The slot opens up on the website again. |
| Make a time unavailable (away, errands, leave) | Add an event at that time. An all-day event blocks the whole day. |
| Keep an event without blocking slots | Set the event to show as **Free**. |

Only events between 09:00 and 18:00, Monday to Saturday, affect the website,
because those are the only times it offers. Each phone number can have at
most 2 upcoming website bookings at a time.

Opening hours (Mon–Sat 09:00–18:00) are set in both `Code.gs` and the
`AVAILABILITY` block in `index.html`. If the hours change, update both.

## Updating the script later

Paste the new code, save, then **Deploy → Manage deployments → ✏️ Edit →
Version: New version → Deploy**. This keeps the same Web app URL, so the
website doesn't need changing.
