# WhatsApp Timetable Bot (Division A, Sem-1)

Group me:
- `/time` → **aaj ka pura timetable**: har lecture ka Subject → Time → Teacher → Location → Batch (isi order me).
- `/time current` → abhi ke time se **jo agla (next) lecture hoga**, wahi ek format me.
- Bonus: `/time monday`, `/time friday` etc. — kisi bhi din ka poora schedule.

---

## 1. GitHub pe upload karna

```bash
cd wa-timetable-bot
git init
git add .
git commit -m "WhatsApp timetable bot"
git branch -M main
git remote add origin https://github.com/<tumhara-username>/<repo-name>.git
git push -u origin main
```

(`.wwebjs_auth` aur `node_modules` `.gitignore` me hai, wo GitHub pe nahi jayenge — sahi hai.)

---

## 2. Railway pe deploy karna

1. https://railway.app pe login karo (GitHub se login sabse aasan).
2. **New Project → Deploy from GitHub repo** → apna `wa-timetable-bot` repo select karo.
3. Railway `Dockerfile` ko automatically detect kar lega (Chromium install karne ke liye yeh zaroori hai) — kuch extra config nahi chahiye.
4. Deploy hone do. Build ke baad **Deployments → View Logs** kholo — wahan terminal jaisa QR code print hoga.

## 3. Login karna — Pairing Code (OTP jaisa, RECOMMENDED)

Railway logs me QR ASCII-art hota hai, camera se scan karna almost impossible hai. Isliye **pairing code** (8-digit, OTP jaisa) use karo:

1. Railway dashboard → apna service → **Variables** tab → naya variable add karo:
   - Key: `PHONE_NUMBER`
   - Value: jis number se bot banana hai, **country code ke saath, बिना `+` aur बिना leading `0`** — e.g. India ka `9876543210` number ho to likho `919876543210`.
2. Save karte hi Railway apne aap redeploy karega.
3. **Deploy Logs** kholo — kuch second me ek box dikhega:
   ```
   WhatsApp PAIRING CODE: XXXX-XXXX
   ```
4. Us number ke WhatsApp app me jao → **Settings → Linked Devices → Link a Device → "Link with phone number instead"** → yeh code daal do. Bas, connect ho jayega — QR scan karne ki zarurat hi nahi.
5. Login hote hi session save ho jata hai, dobara code nahi maangega (jab tak logout na karo ya Railway restart pe volume na ho — neeche point 4 dekho).
6. Jis number se link kiya, usi ko apne 50-member group me add kar do — bas wahi bot ka number hai.

*(Agar `PHONE_NUMBER` variable set nahi karoge, to purana QR wala tarika hi chalega.)*

---

## 4. Domain se link karna (agar chaho)

Yeh bot koi website/webpage nahi hai (sirf background process hai jo WhatsApp se connect rehta hai), isliye **domain ki zarurat nahi hai** — domain sirf tab chahiye jab koi web dashboard/API banana ho. Bas Railway pe process chalte rehna chahiye, WhatsApp khud group me messages ka reply karega.

---

## 5. Session persist karna (zaroori — warna baar-baar code maangega)

Railway pe agar app restart/redeploy hoti hai (auto ho sakta hai), to filesystem reset ho jata hai aur login session (`.wwebjs_auth` folder) delete ho jayega — matlab dobara pairing code maangega. Isse bachne ke liye:

1. Railway dashboard → apna service → **Settings → Volumes → New Volume**.
2. Mount path: `/app/.wwebjs_auth`
3. Ek baar pairing code se login ho jaye, uske baad restart pe bhi session wahi rahega, dobara login nahi maangega.

---

## 6. Timetable update karna

`timetable.json` file kholo — har din ke slots me `subject`, `faculty`, `location`, `batch` diya hai, jo bhi change karna ho seedha yahi edit karo. `bot.js` ko chhedne ki zarurat nahi.

---

## Files
- `bot.js` — main bot logic
- `timetable.json` — timetable data (yahi edit karte rehna)
- `Dockerfile` — Railway ke liye build instructions (Chromium install karta hai)
- `package.json` — dependencies
- `.gitignore` — session/node_modules GitHub pe na jaye isliye
