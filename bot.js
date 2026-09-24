// WhatsApp Group Timetable Bot
// Commands:
//   /time                -> today's full timetable (with date & day)
//   /time current        -> next lecture from the ACTUAL current time
//   /time 3:20 PM         -> next lecture from a TIME YOU GIVE (today)
//   /time monday..sunday -> that day's full timetable (with correct date)
//
// Login: if Railway env var PHONE_NUMBER is set (e.g. 919876543210 - country
// code, no + and no leading 0), you'll get an 8-digit PAIRING CODE instead of
// a QR code - enter it in WhatsApp under "Link with phone number instead".
//
// Setup: see README.md

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const timetable = JSON.parse(fs.readFileSync(path.join(__dirname, 'timetable.json'), 'utf8'));

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PHONE_NUMBER = process.env.PHONE_NUMBER; // e.g. "919876543210", no + no leading 0
let pairingCodeRequested = false;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', async (qr) => {
  if (PHONE_NUMBER) {
    if (!pairingCodeRequested) {
      pairingCodeRequested = true;
      try {
        const code = await client.requestPairingCode(PHONE_NUMBER);
        console.log('================================');
        console.log('  WhatsApp PAIRING CODE:', code);
        console.log('  Open WhatsApp -> Settings -> Linked Devices ->');
        console.log('  Link a Device -> "Link with phone number instead" ->');
        console.log('  enter this code.');
        console.log('================================');
      } catch (err) {
        console.error('Pairing code error:', err.message);
        console.log('Falling back to QR code below.');
        qrcode.generate(qr, { small: true });
      }
    }
  } else {
    console.log('Scan this QR code with WhatsApp (Linked Devices):');
    qrcode.generate(qr, { small: true });
  }
});

client.on('ready', () => {
  console.log('Bot is ready and listening!');
});

// ---------- helpers ----------

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fmt12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

function formatDate(d) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function getTodayName(date = new Date()) {
  return DAYS[date.getDay()];
}

// Finds the nearest date (today or upcoming) that falls on the given weekday name
function getDateForDayName(targetDayName, fromDate = new Date()) {
  const targetIdx = DAYS.indexOf(targetDayName);
  const d = new Date(fromDate);
  const diff = (targetIdx - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

// Formats ONE slot (can have 1 or 2 parallel batch entries) in the required order:
// Subject -> Time -> Teacher -> Location -> Batch
function formatSlot(num, slot) {
  const timeStr = `${fmt12(slot.start)} - ${fmt12(slot.end)}`;
  let out = '';
  slot.entries.forEach((e) => {
    out += `${num}. 📘 ${e.subject}\n`;
    out += `   ⏰ ${timeStr}\n`;
    out += `   👨‍🏫 ${e.faculty}\n`;
    out += `   📍 ${e.location}\n`;
    out += `   🧑‍🎓 Batch: ${e.batch}\n\n`;
  });
  return out;
}

// Full day's timetable, with the correct date shown in the header
function buildDayTimetableText(dayName, dateObj) {
  const slots = timetable.schedule[dayName] || [];
  const dateStr = formatDate(dateObj);
  if (slots.length === 0) {
    return `📅 *${dayName}, ${dateStr}*\nNo lectures today (holiday/weekend). 🎉`;
  }
  let out = `📅 *Timetable - ${dayName}, ${dateStr}* (Div ${timetable.division}, Sem ${timetable.semester})\n\n`;
  slots.forEach((s, i) => {
    out += formatSlot(i + 1, s);
  });
  out += `_Short Break: 11:00-11:10 | Lunch Break: 12:50-1:40_`;
  return out.trim();
}

// Parses a time string like "3:20 PM", "3:20pm", "15:20" into minutes-since-midnight.
// Returns null if it doesn't look like a valid time.
function parseTimeArgToMinutes(raw) {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toLowerCase() : null;

  if (minute < 0 || minute > 59) return null;

  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
  } else {
    if (hour < 0 || hour > 23) return null; // treated as 24-hour time
  }

  return hour * 60 + minute;
}

// Builds a Date object for TODAY but with the given hour/minute (used for /time <time>)
function dateWithMinutes(minutesSinceMidnight) {
  const d = new Date();
  d.setHours(Math.floor(minutesSinceMidnight / 60), minutesSinceMidnight % 60, 0, 0);
  return d;
}

// Finds the NEXT upcoming lecture from "refDate" (rolls to the next day with
// classes if there's nothing left on that day). Header always shows the
// correct day + date, plus an optional label describing the reference time.
function buildNextLectureText(refDate, label) {
  const dayName = getTodayName(refDate);
  const dateStr = formatDate(refDate);
  const slots = timetable.schedule[dayName] || [];
  const refMin = refDate.getHours() * 60 + refDate.getMinutes();
  const header = `➡️ *Next Lecture* — from ${label} on ${dayName}, ${dateStr}`;

  const upcoming = slots.find((s) => toMinutes(s.start) > refMin);
  if (upcoming) {
    return `${header}\n\n` + formatSlot(1, upcoming).trim();
  }

  // No more that day -> find next day with a lecture
  let idx = DAYS.indexOf(dayName);
  for (let i = 1; i <= 7; i++) {
    const nextDay = DAYS[(idx + i) % 7];
    const nextSlots = timetable.schedule[nextDay] || [];
    if (nextSlots.length > 0) {
      const nextDate = getDateForDayName(nextDay, refDate);
      return `✅ No more lectures after that on ${dayName}, ${dateStr}.\n\n➡️ *Next Lecture* — ${nextDay}, ${formatDate(nextDate)}\n\n` + formatSlot(1, nextSlots[0]).trim();
    }
  }
  return `✅ No upcoming lecture found.`;
}

const USAGE_TEXT =
`❓ *How to use*

/time            -> today's full timetable
/time current    -> next lecture from right now
/time 3:20 PM    -> next lecture from a time you choose
/time monday     -> that day's full timetable (mon/tue/wed/thu/fri)`;

// ---------- message handler ----------

client.on('message', async (msg) => {
  const body = msg.body.trim();
  const lower = body.toLowerCase();

  if (lower === '/time') {
    const today = new Date();
    await msg.reply(buildDayTimetableText(getTodayName(today), today));
    return;
  }

  if (lower === '/time current') {
    await msg.reply(buildNextLectureText(new Date(), 'now'));
    return;
  }

  if (lower.startsWith('/time ')) {
    const arg = body.slice(6).trim(); // keep original case for AM/PM
    const lowerArg = arg.toLowerCase();

    // /time monday, /time tuesday, etc.
    const dayMatch = DAYS.find((d) => d.toLowerCase() === lowerArg);
    if (dayMatch) {
      const dateObj = getDateForDayName(dayMatch);
      await msg.reply(buildDayTimetableText(dayMatch, dateObj));
      return;
    }

    // /time 3:20 PM, /time 15:20, etc.
    const minutes = parseTimeArgToMinutes(arg);
    if (minutes !== null) {
      const refDate = dateWithMinutes(minutes);
      await msg.reply(buildNextLectureText(refDate, fmt12(`${Math.floor(minutes / 60)}:${(minutes % 60).toString().padStart(2, '0')}`)));
      return;
    }

    // Nothing matched -> show usage
    await msg.reply(USAGE_TEXT);
    return;
  }
});

client.initialize();
