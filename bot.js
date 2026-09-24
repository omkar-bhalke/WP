// WhatsApp Group Timetable Bot
// Commands:
//   /time              -> aaj ka pura timetable
//   /time current      -> abhi ke time se AGLA (next) lecture, same format me
//   /time monday..sunday (bonus) -> us din ka timetable
//
// Login: agar Railway env var PHONE_NUMBER set hai (e.g. 919876543210 — country
// code ke saath, + ya 0 nahi lagana), to QR ki jagah ek 8-digit PAIRING CODE
// milega jo WhatsApp app me "Link with phone number" option me daalna hai.
// (QR terminal me scan karna mushkil hota hai, pairing code OTP jaisa aasan hai.)
//
// Setup: README.md dekho

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const timetable = JSON.parse(fs.readFileSync(path.join(__dirname, 'timetable.json'), 'utf8'));

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
    // Pairing-code (OTP-jaisa) login — QR ignore karo
    if (!pairingCodeRequested) {
      pairingCodeRequested = true;
      try {
        const code = await client.requestPairingCode(PHONE_NUMBER);
        console.log('================================');
        console.log('  WhatsApp PAIRING CODE:', code);
        console.log('  WhatsApp app kholo -> Settings -> Linked Devices ->');
        console.log('  Link a Device -> "Link with phone number instead" ->');
        console.log('  yeh code daalo.');
        console.log('================================');
      } catch (err) {
        console.error('Pairing code error:', err.message);
        console.log('Fallback: neeche wala QR scan karo.');
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

function getTodayName(date = new Date()) {
  return DAYS[date.getDay()];
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

function buildDayTimetableText(dayName) {
  const slots = timetable.schedule[dayName] || [];
  if (slots.length === 0) {
    return `📅 *${dayName}*\nAaj koi lecture nahi hai (holiday/weekend). 🎉`;
  }
  let out = `📅 *Timetable - ${dayName}* (Div ${timetable.division}, Sem ${timetable.semester})\n\n`;
  slots.forEach((s, i) => {
    out += formatSlot(i + 1, s);
  });
  out += `_Short Break: 11:00-11:10 | Lunch Break: 12:50-1:40_`;
  return out.trim();
}

// Finds the NEXT upcoming lecture from "now" (today; if today is over, rolls to next day with classes)
function buildNextLectureText(now = new Date()) {
  const dayName = getTodayName(now);
  const slots = timetable.schedule[dayName] || [];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const upcoming = slots.find((s) => toMinutes(s.start) > nowMin);
  if (upcoming) {
    return `➡️ *Next Lecture*\n\n` + formatSlot(1, upcoming).trim();
  }

  // No more today -> find next day with a lecture
  let idx = DAYS.indexOf(dayName);
  for (let i = 1; i <= 7; i++) {
    const nextDay = DAYS[(idx + i) % 7];
    const nextSlots = timetable.schedule[nextDay] || [];
    if (nextSlots.length > 0) {
      return `✅ Aaj ke saare lectures khatam ho gaye.\n\n➡️ *Next Lecture (${nextDay})*\n\n` + formatSlot(1, nextSlots[0]).trim();
    }
  }
  return `✅ Koi upcoming lecture nahi mila.`;
}

// ---------- message handler ----------

client.on('message', async (msg) => {
  const body = msg.body.trim();
  const lower = body.toLowerCase();

  if (lower === '/time') {
    const dayName = getTodayName();
    await msg.reply(buildDayTimetableText(dayName));
    return;
  }

  if (lower === '/time current') {
    await msg.reply(buildNextLectureText());
    return;
  }

  // Bonus: /time monday, /time tuesday, etc.
  if (lower.startsWith('/time ')) {
    const arg = lower.replace('/time ', '').trim();
    const match = DAYS.find((d) => d.toLowerCase() === arg);
    if (match) {
      await msg.reply(buildDayTimetableText(match));
      return;
    }
  }
});

client.initialize();
