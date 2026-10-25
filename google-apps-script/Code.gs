/**
 * Kabelo Nyalungu Physiotherapy - website booking connector.
 *
 * Runs on Kabelo's Google account as a web app and connects the booking
 * calendar on knphysio.online to his main Google Calendar:
 *
 *   GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD
 *        Returns the busy times in that range (start/end only, never event
 *        titles or details), so the website can hide slots that are taken.
 *
 *   POST {"start": "YYYY-MM-DDTHH:mm", "name": ..., "phone": ..., ...}
 *        Checks the slot is still free and inside opening hours, then adds a
 *        "Pending" event to the calendar and emails Kabelo the details.
 *
 * Setup steps: see SETUP.md in this folder.
 */

// Keep these in step with AVAILABILITY in index.html.
var CONFIG = {
  // 0 = Sunday ... 6 = Saturday. Leave a day out to mark it closed.
  hours: {
    1: { start: '09:00', end: '18:00' },
    2: { start: '09:00', end: '18:00' },
    3: { start: '09:00', end: '18:00' },
    4: { start: '09:00', end: '18:00' },
    5: { start: '09:00', end: '18:00' },
    6: { start: '09:00', end: '18:00' }
  },
  slotMinutes: 60,
  minNoticeHours: 2,
  maxDaysAhead: 100,

  // Stops one phone number from holding lots of slots at once.
  maxPendingPerPhone: 2,

  // Email Kabelo whenever a new booking comes in.
  notifyByEmail: true
};

var PENDING_PREFIX = 'Pending: ';

function doGet(e) {
  var params = (e && e.parameter) || {};
  var from = parseDay_(params.from);
  var to = parseDay_(params.to);

  if (!from || !to || to < from) {
    return json_({ ok: false, error: 'bad_range' });
  }

  var today = startOfToday_();
  var latest = addDays_(today, CONFIG.maxDaysAhead);
  if (from < today) from = today;
  if (to > latest) to = latest;

  var busy = [];

  if (from <= to) {
    busy = CalendarApp.getDefaultCalendar()
      .getEvents(from, addDays_(to, 1))
      .filter(isBusy_)
      .map(function (event) {
        return {
          start: event.getStartTime().toISOString(),
          end: event.getEndTime().toISOString()
        };
      });
  }

  return json_({ ok: true, busy: busy });
}

function doPost(e) {
  var data;

  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }

  var start = parseSlot_(data.start);
  var booking = {
    name: clean_(data.name, 80),
    phone: clean_(data.phone, 30),
    email: clean_(data.email, 120),
    service: clean_(data.service, 80),
    visitType: clean_(data.visitType, 40),
    notes: clean_(data.notes, 1000)
  };

  if (!start || !booking.name || !booking.phone) {
    return json_({ ok: false, error: 'bad_request' });
  }

  if (!isBookable_(start)) {
    return json_({ ok: false, error: 'unavailable' });
  }

  var end = new Date(start.getTime() + CONFIG.slotMinutes * 60000);

  // Only one booking is processed at a time, so two patients can't take the same slot
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return json_({ ok: false, error: 'try_again' });
  }

  try {
    var calendar = CalendarApp.getDefaultCalendar();

    if (calendar.getEvents(start, end).some(isBusy_)) {
      return json_({ ok: false, error: 'taken' });
    }

    if (pendingCountFor_(calendar, booking.phone) >= CONFIG.maxPendingPerPhone) {
      return json_({ ok: false, error: 'too_many' });
    }

    var details = [
      'Booked via knphysio.online - confirm with the patient, or delete this event to free the slot.',
      '',
      'Name: ' + booking.name,
      'Phone: ' + booking.phone,
      'Email: ' + (booking.email || '-'),
      'Service: ' + (booking.service || '-'),
      'Visit type: ' + (booking.visitType || '-'),
      '',
      'Notes:',
      booking.notes || '-'
    ].join('\n');

    calendar.createEvent(
      PENDING_PREFIX + booking.name + ' - ' + (booking.service || 'Physiotherapy'),
      start,
      end,
      { description: details, location: booking.visitType }
    );

    if (CONFIG.notifyByEmail) {
      MailApp.sendEmail(
        Session.getEffectiveUser().getEmail(),
        'New booking: ' + booking.name + ', ' + formatSlot_(start),
        'A new appointment was booked on knphysio.online for ' + formatSlot_(start) + '.\n\n' + details
      );
    }
  } finally {
    lock.releaseLock();
  }

  return json_({ ok: true });
}

// Events marked "Free", and invitations Kabelo declined, don't block slots
function isBusy_(event) {
  if (
    typeof event.getTransparency === 'function' &&
    event.getTransparency() === CalendarApp.EventTransparency.TRANSPARENT
  ) {
    return false;
  }

  if (event.getMyStatus && event.getMyStatus() === CalendarApp.GuestStatus.NO) {
    return false;
  }

  return true;
}

function isBookable_(start) {
  var hours = CONFIG.hours[start.getDay()];
  if (!hours) return false;

  var minutes = start.getHours() * 60 + start.getMinutes();
  var open = toMinutes_(hours.start);
  var close = toMinutes_(hours.end);

  if (minutes < open || minutes + CONFIG.slotMinutes > close) return false;
  if ((minutes - open) % CONFIG.slotMinutes !== 0) return false;

  var earliest = new Date(Date.now() + CONFIG.minNoticeHours * 3600000);
  var latest = addDays_(startOfToday_(), CONFIG.maxDaysAhead + 1);

  return start >= earliest && start < latest;
}

function pendingCountFor_(calendar, phone) {
  var now = new Date();
  var events = calendar.getEvents(now, addDays_(now, CONFIG.maxDaysAhead + 1), { search: phone });

  return events.filter(function (event) {
    return (
      event.getTitle().indexOf(PENDING_PREFIX) === 0 &&
      event.getDescription().indexOf('Phone: ' + phone + '\n') !== -1
    );
  }).length;
}

// "YYYY-MM-DD" -> midnight in the script's time zone
function parseDay_(value) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

// "YYYY-MM-DDTHH:mm" -> that time in the script's time zone
function parseSlot_(value) {
  var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
  if (!m) return null;

  var date = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return date.getDate() === +m[3] ? date : null;
}

function formatSlot_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "EEEE d MMMM 'at' HH:mm");
}

function toMinutes_(time) {
  var parts = time.split(':');
  return +parts[0] * 60 + +parts[1];
}

function startOfToday_() {
  var now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays_(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function clean_(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function json_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
