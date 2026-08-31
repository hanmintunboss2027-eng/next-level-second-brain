# AI Second Brain — Next Level by HMT

Your own private AI that knows your business and writes in your voice.
Upload the `Second-Brain` folder you built in Part 1, fill in your Brand Kit,
and ask it for content from any device.

No coding. Two accounts. About ten minutes.

---

## Deploy your own copy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhanmintunboss2027-eng%2Fnext-level-second-brain&project-name=second-brain&repository-name=second-brain&env=OPENAI_API_KEY&envDescription=Your%20OpenAI%20key%20-%20paste%20it%20on%20its%20own%2C%20no%20quotes&envLink=https%3A%2F%2Fplatform.openai.com%2Fapi-keys&stores=%5B%7B%22type%22%3A%22blob%22%7D%5D)

The button does four things in order:

1. **Clones this repo into your GitHub** — keep the repository **Private**.
2. **Attaches a Blob Store** — one click, no settings. This is where your uploaded
   vault and brand kit live. *Do not skip it.*
3. **Asks for `OPENAI_API_KEY`** — paste your key on its own. No quotes, no label,
   no spaces before or after.
4. **Builds and deploys** — about three minutes. Yellow `npm warn` lines are normal;
   only a red error stops a deploy.

When it finishes, open the link under **Domains** (not the one under Deployment)
and bookmark it. That is your brain's home on the web.

---

## What you need first

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

Add or change any of these under **Project ▸ Settings ▸ Environment Variables**,
then **Redeploy** — variables only take effect on a new deployment.

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
