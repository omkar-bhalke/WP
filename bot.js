// WhatsApp Group Timetable Bot
// Commands:
//   /time         -> today's full timetable (date + day shown)
//   /time next    -> details of the NEXT lecture from right now
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

// Nearest date (today or upcoming) that falls on the given weekday name
function getDateForDayName(targetDayName, fromDate = new Date()) {
  const targetIdx = DAYS.indexOf(targetDayName);
  const d = new Date(fromDate);
  const diff = (targetIdx - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

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

// /time -> full timetable for today, with correct date + day
function buildTodayTimetableText() {
  const today = new Date();
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

// /time next -> details of the next lecture from right now
function buildNextLectureText() {
  const now = new Date();
  const dayName = getTodayName(now);
  const dateStr = formatDate(now);
  const slots = timetable.schedule[dayName] || [];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const upcoming = slots.find((s) => toMinutes(s.start) > nowMin);
  if (upcoming) {
    return `➡️ *Next Lecture* — ${dayName}, ${dateStr}\n\n` + formatSlot(1, upcoming).trim();
  }

  // No more lectures left today -> find the next day that has classes
  let idx = DAYS.indexOf(dayName);
  for (let i = 1; i <= 7; i++) {
    const nextDay = DAYS[(idx + i) % 7];
    const nextSlots = timetable.schedule[nextDay] || [];
    if (nextSlots.length > 0) {
      const nextDate = getDateForDayName(nextDay, now);
      return `✅ No more lectures today (${dayName}, ${dateStr}).\n\n➡️ *Next Lecture* — ${nextDay}, ${formatDate(nextDate)}\n\n` + formatSlot(1, nextSlots[0]).trim();
    }
  }
  return `✅ No upcoming lecture found.`;
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
