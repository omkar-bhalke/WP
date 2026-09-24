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

## 3. QR scan karna (Login)

Railway ke logs me QR sahi se scan karna mushkil hota hai (text/ASCII format), isliye best tarika:

1. **Pehle apne PC/laptop pe local test karo:**
   ```bash
   npm install
   npm start
   ```
   Terminal me QR aayega → WhatsApp kholo → **Settings → Linked Devices → Link a Device** → scan karo.
2. Login hote hi ek `.wwebjs_auth` folder ban jayega (session save ho jata hai).
3. Ab **Railway pe ek Volume mount karo** (Railway dashboard → apna service → **Settings → Volumes → New Volume**, mount path `/app/.wwebjs_auth` rakho), aur us folder ka content upload/copy kar do (Railway CLI se `railway up` ke through, ya volume ke andar file manager se) — isse Railway pe dobara QR scan nahi karna padega, seedha login state mil jayega.

   *(Agar Volume upload thoda technical lage, to alternative: Railway pe hi pehli baar deploy karo, logs me QR dikhte hi turant scan karlo — QR sirf ~20 sec valid hota hai to fast rehna padega. Volume wala tarika zyada reliable hai.)*

4. Jis number se scan karoge, wahi bot ban jayega — us number ko apne 50-member WhatsApp group me add kar do.

---

## 4. Domain se link karna (agar chaho)

Yeh bot koi website/webpage nahi hai (sirf background process hai jo WhatsApp se connect rehta hai), isliye **domain ki zarurat nahi hai** — domain/OTP sirf tab chahiye jab koi web dashboard/API banana ho. Bas Railway pe process chalte rehna chahiye, WhatsApp khud group me messages ka reply karega.

---

## 5. Timetable update karna

`timetable.json` file kholo — har din ke slots me `subject`, `faculty`, `location`, `batch` diya hai, jo bhi change karna ho seedha yahi edit karo. `bot.js` ko chhedne ki zarurat nahi.

---

## Files
- `bot.js` — main bot logic
- `timetable.json` — timetable data (yahi edit karte rehna)
- `Dockerfile` — Railway ke liye build instructions (Chromium install karta hai)
- `package.json` — dependencies
- `.gitignore` — session/node_modules GitHub pe na jaye isliye
