# AI Second Brain — Next Level by HMT

သင့်စီးပွားရေးကို သိပြီး သင့်လေသံနဲ့ ရေးပေးတဲ့ ကိုယ်ပိုင် AI။
Part 1 မှာ ဆောက်ခဲ့တဲ့ `Second-Brain` folder ကို တင်၊ Brand Kit ဖြည့်၊ ပြီးရင်
ဖုန်းကဖြစ်စေ ကွန်ပျူတာကဖြစ်စေ အလုပ်ခိုင်းလို့ ရပါပြီ။

Code မရေးရပါ။ Account ၂ ခုပဲ လိုပါတယ်။ ၁၀ မိနစ်လောက် ကြာပါတယ်။

---

## ⚠️ မနှိပ်ခင် အရင်လုပ်ရမယ့် ၂ ခု

Deploy ခလုတ်က **OpenAI key ကို ချက်ချင်း တောင်းပါတယ်**။ key မရှိဘဲ နှိပ်လိုက်ရင်
အလယ်မှာ ရပ်သွားပါလိမ့်မယ်။ ဒါကြောင့် အောက်က ၂ ခုကို **အရင်** ပြီးအောင်လုပ်ပါ:

1. **GitHub account** — [github.com/signup](https://github.com/signup)
   အီးမေးလ် အတည်ပြုစာကို **နှိပ်ဖို့ မမေ့ပါနဲ့** (မနှိပ်ရင် repo မဆောက်ရပါဘူး)
2. **OpenAI API key + ၅ ဒေါ်လာ credit** — [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   key ဆောက်ပြီးရင် **Settings ▸ Billing** မှာ ကတ်ထည့်ပြီး ၅ ဒေါ်လာ ဖြည့်ပါ

> **အများဆုံး မှားတဲ့ အချက်:** key ဆောက်ပေမဲ့ credit မဖြည့်တာ။
> Site က ကောင်းကောင်း တက်လာပေမဲ့ စာရေးခိုင်းရင် တိတ်တိတ်ကလေး မအောင်မြင်ပါဘူး။

---

## Deploy — ကိုယ်ပိုင် တစ်ခု ဆောက်မယ်

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhanmintunboss2027-eng%2Fnext-level-second-brain&project-name=second-brain&repository-name=second-brain&env=OPENAI_API_KEY&envDescription=Your%20OpenAI%20key%20-%20paste%20it%20on%20its%20own%2C%20no%20quotes&envLink=https%3A%2F%2Fplatform.openai.com%2Fapi-keys&stores=%5B%7B%22type%22%3A%22blob%22%7D%5D)

ဒီခလုတ် တစ်ချက်တည်းက အဆင့် ၄ ဆင့် အလိုအလျောက် လုပ်ပေးပါတယ်:

| | ဘာလုပ်လဲ | သင်လုပ်ရမှာ |
|---|---|---|
| 1 | ဒီ repo ကို သင့် GitHub ထဲ ကူးယူတယ် | **Private** ထားပါ |
| 2 | **Blob Store** တပ်ပေးတယ် | **Create** နှိပ်ရုံပါပဲ — *ဒါကို ကျော်မသွားပါနဲ့*၊ ဒီထဲမှာ သင့် vault နဲ့ brand kit တွေ သိမ်းမှာပါ |
| 3 | `OPENAI_API_KEY` တောင်းတယ် | key ကို သီးသန့် paste လုပ်ပါ — quote မထည့်၊ space မထည့်၊ ရှေ့မှာ နာမည် မတပ်ပါနဲ့ |
| 4 | ဆောက်ပြီး တင်ပေးတယ် | ၃ မိနစ်လောက် စောင့်ပါ။ အဝါရောင် `npm warn` စာကြောင်းတွေက ပုံမှန်ပါ၊ အနီရောင် error မှသာ ပြဿနာပါ |

ပြီးသွားရင် **Domains** အောက်က link ကို ဖွင့်ပြီး bookmark လုပ်ထားပါ
(Deployment အောက်က link ကို မဟုတ်ပါဘူး)။ အဲ့ဒါ သင့် ဦးနှောက်ရဲ့ လိပ်စာပါ။

---

## What you need first / လိုအပ်တာများ

| | What it is | Where |
|---|---|---|
| GitHub account | Holds your own copy of this app | [github.com/signup](https://github.com/signup) — free, **click the verification email** |
| OpenAI API key | The fuel that lets it think and write | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| $5 of OpenAI credit | A key with no credit behind it does nothing | Settings ▸ Billing ▸ Add payment details |

> **The single most common mistake:** creating the key and forgetting the credit.
> The site deploys fine, the chat just silently fails. Add at least $5.

---

## Environment variables

| Name | Required | What it does |
|---|---|---|
| `OPENAI_API_KEY` | **yes** | Your key from platform.openai.com |
| `BLOB_READ_WRITE_TOKEN` | added for you | Appears when you attach the Blob Store |
| `OPENAI_MODEL` | no | Defaults to `gpt-4o-mini`. Change it if your account has something else |
| `SITE_PASSWORD` | no | Set it and the site asks for a code before it opens. Leave it out and anyone with the link can use it |

Vercel မှာ ခုနောက်ပိုင်း **Environment Variables** က Settings menu ထဲ မဟုတ်တော့ဘဲ
**ဘယ်ဘက် sidebar မှာ တိုက်ရိုက်** ရှိပါတယ် (Overview / Deployments / … / Environment
Variables / Domains / … / **Storage**)။ ပြင်ပြီးတိုင်း **Redeploy** နှိပ်မှ အလုပ်လုပ်ပါတယ် —
deployment အသစ် တစ်ခု မဖြစ်မချင်း variable အသစ်က မသက်ရောက်ပါဘူး။

---

## Using it

1. **Settings ▸ Second brain ▸ Upload vault** — drop in `Second-Brain.zip`.
   Folder paths and `[[wiki links]]` are preserved, so your graph comes across intact.
2. **Settings ▸ Brand kit** — copy the hex codes, fonts and tone straight out of
   `Brand/look.md` from Part 1. Say **Burmese** in the language field or everything
   comes out in English.
3. **Ask for something** on the dashboard. Pick a format or leave it on Auto.

The site holds a *copy* of your knowledge, not a live link to your laptop.
When your local brain has grown, zip the folder and upload it again — two minutes,
about once a week.

---

## How it decides what to say

- Every request pulls the most relevant notes out of your vault by keyword,
  and always pins `Raw/voice-print.md`, `Raw/business-facts.md` and everything in
  `Brand/` so the voice and the strategy are in front of it every time.
- The system prompt forbids inventing client results, numbers, prices and
  testimonials. If a fact is missing it writes `[ADD: …]` rather than making one up.
- Every reply ends with the note paths it actually read, so you can check it.

---

## Running it on your own machine

```bash
npm install
cp .env.example .env.local     # add your OPENAI_API_KEY
npm run dev
```

Without a Blob token, uploads are kept in memory and disappear when the server
restarts. That is fine for trying it out; attach the Blob Store for real use.

---

## Privacy

Your notes live in your own Blob Store, on your own Vercel account, reachable only
from your own deployment. Your API key is an environment variable — it is never
sent to the browser and never appears in the page. Keep contracts, invoices, ID
numbers and passwords out of the vault.

---

Built for the **Build Your Second Brain** workshop — Next Level by HMT.
AI Education · Life Skills · Business Growth
