// WhatsApp Group Timetable Bot
// Commands:
//   /time         -> today's full timetable (date + day shown)
//   /time next    -> details of the NEXT lecture from right now
//
// Time is always calculated in IST (UTC+5:30), hardcoded in code - this
// works correctly no matter what timezone the hosting server itself uses,
// so no TZ environment variable is needed.
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

// ---------- IST time helpers (timezone-server-independent) ----------

// Real "now", shifted so its UTC-* getters read as IST wall-clock time.
// This is correct regardless of what timezone the server/container is set to.
function getISTNow() {
  return new Date(Date.now() + 5.5 * 60 * 60000);
}

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
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function getTodayName(istDate) {
  return DAYS[istDate.getUTCDay()];
}

function getMinutesOfDay(istDate) {
  return istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
}

// Nearest IST date (today or upcoming) that falls on the given weekday name
function getDateForDayName(targetDayName, fromIstDate) {
  const targetIdx = DAYS.indexOf(targetDayName);
  const d = new Date(fromIstDate.getTime());
  const diff = (targetIdx - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

// ---------- formatting ----------

// Formats ONE slot (1 or 2 parallel batch entries) in order:
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

// /time -> full timetable for today, with correct IST date + day
function buildTodayTimetableText() {
  const today = getISTNow();
  const dayName = getTodayName(today);
  const dateStr = formatDate(today);
  const slots = timetable.schedule[dayName] || [];

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

// /time next -> details of the next lecture from right now (IST).
// If today's lectures are all done, just says so - does NOT jump ahead to
// tomorrow's lecture automatically.
function buildNextLectureText() {
  const now = getISTNow();
  const dayName = getTodayName(now);
  const dateStr = formatDate(now);
  const slots = timetable.schedule[dayName] || [];
  const nowMin = getMinutesOfDay(now);

  if (slots.length === 0) {
    return `📅 *${dayName}, ${dateStr}*\nNo lectures today (holiday/weekend). 🎉`;
  }

  const upcoming = slots.find((s) => toMinutes(s.start) > nowMin);
  if (upcoming) {
    return `➡️ *Next Lecture* — ${dayName}, ${dateStr}\n\n` + formatSlot(1, upcoming).trim();
  }

  return `✅ All lectures for today are done (${dayName}, ${dateStr}). Check back tomorrow. 👍`;
}

const USAGE_TEXT =
`❓ *How to use*

/time        -> today's full timetable
/time next   -> details of the next lecture`;

// ---------- message handler ----------

client.on('message', async (msg) => {
  const body = msg.body.trim();
  const lower = body.toLowerCase();

  if (lower === '/time') {
    await msg.reply(buildTodayTimetableText());
    return;
  }

  if (lower === '/time next') {
    await msg.reply(buildNextLectureText());
    return;
  }

  if (lower.startsWith('/time')) {
    await msg.reply(USAGE_TEXT);
    return;
  }
});

client.initialize();
