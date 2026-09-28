# Burnout Pulse v13: step-by-step hosting guide (Mac)

This guide takes you from the zip file to a live website with a working AI coach. Every click is spelled out. No coding, and no Terminal.

**Time needed:** about 45 minutes the first time, and most of that is waiting.

**What you'll have at the end:**

- The app live at a web address, like `https://burnout-pulse-abc123.vercel.app`
- The live AI coach turned on (optional; the app works fully without it)
- The safety settings a hospital reviewer will ask about

**The three free accounts you'll use:** GitHub (stores the code), Vercel (runs the website), and Anthropic (powers the AI coach; pay-as-you-go, only if you want the live coach). Use the same email for all three.

---

## Step 0: Which path are you on?

Open **https://vercel.com** and sign in (or try to).

- **You see a project called `burnout-pulse` (or whatever you named v12):** follow **Path A: Update the existing site**. Your testers keep their data, which moves into encrypted storage the next time they sign in, *but only if the new version goes to the same web address*. So don't create a new project.
- **You have no Vercel account, or no such project:** follow **Path B: Set up from scratch**.

Both paths use a free Mac app called **GitHub Desktop**, so you never have to type commands.

---

## Part 1: Get ready (both paths)

### 1.1 Unzip the package

1. Find the zip you were sent in your **Downloads** folder.
2. Double-click it. A folder appears next to it.
3. Inside are:
   - `START-HERE.html`: this guide
   - `burnout-pulse`: **the app. This is the folder you'll upload.**
   - `For-reference`: the review and pen-test notes. **Don't upload this folder.**
4. Drag the whole unzipped folder into your **Documents** folder so it doesn't get lost.

### 1.2 Try the app on your Mac first (2 minutes, optional)

1. Open `burnout-pulse`, then open the `public` folder.
2. Right-click `index.html`, choose **Open With**, then **Google Chrome**. If you don't have Chrome, skip this step; you'll test on the live site instead.
3. Click **Create an account**, enter any email, your first name, and a passphrase of **15 or more characters** (for example, four random words).
4. Answer the six questions and click **Save check-in**. You should land on the **Trend** page.

> If Safari says *"This browser can't encrypt data securely"* when you open the file directly, that's Safari being strict about local files. It will work on the live `https://` site.

### 1.3 Install GitHub Desktop

1. Go to **https://desktop.github.com** and click **Download for macOS**.
2. Open **Downloads** and double-click the downloaded zip. An app called **GitHub Desktop** appears.
3. Drag **GitHub Desktop** into your **Applications** folder.
4. Open it from Applications. If macOS asks "Are you sure you want to open it?", click **Open**.
5. Click **Sign in to GitHub.com**. A browser window opens. Sign in (or click **Create an account** and follow GitHub's steps), then click **Authorize desktop**.
6. Back in GitHub Desktop, if it asks for your name and email for commits, keep what it shows and click **Finish**.

---

## Path A: Update the existing site

### A.1 Download your existing code into GitHub Desktop

1. In GitHub Desktop, click the **File** menu, then **Clone Repository…**
2. Under the **GitHub.com** tab, click **burnout-pulse** (your v12 repository).
3. Leave **Local Path** as it is (usually `Documents/GitHub/burnout-pulse`) and click **Clone**.
4. Wait until it finishes.

> If GitHub Desktop says the folder already exists, you've cloned it before. Click **File**, then **Add Local Repository…**, and choose that folder instead.

### A.2 Swap the old files for the new ones

1. In GitHub Desktop, click the **Repository** menu, then **Show in Finder**. A Finder window opens showing the old v12 files (`index.html`, `README.md`, an `api` folder, and so on).
2. Click any file in that window, press **Command + A** to select everything, then press **Command + Delete** to move it all to the Trash.
   - The window should now look empty. That's correct. A hidden folder named `.git` is still there, which is what you want. Don't go looking for it.
3. Open a **second** Finder window (**Command + N**) and go to Documents, then the unzipped package, then **burnout-pulse**. You'll see `api`, `public`, `supabase`, `tests`, `tools`, `package.json`, `vercel.json`, and several `.md` files.
4. Click any file there, press **Command + A**, then **Command + C** to copy.
5. Click into the **first** (empty) window and press **Command + V** to paste.

### A.3 Send the new version to GitHub

1. Go back to GitHub Desktop. The left side now lists many changed files. That's expected.
2. At the bottom left, in the **Summary** box, type: `Burnout Pulse v13`
3. Click the blue **Commit to main** button.
4. At the top, click **Push origin**.
5. Wait for it to finish. Vercel notices the change and rebuilds your site automatically in about a minute.

### A.4 Check Vercel's settings for this project

The new version keeps the website files in a `public` folder, and it tells Vercel so itself. Make sure nothing in the dashboard overrides it:

1. On **https://vercel.com**, click your project, then **Settings**, then **Build and Deployment** (on some accounts it's **General**, then **Build & Development Settings**).
2. **Framework Preset** should be **Other**.
3. If any of **Build Command**, **Output Directory**, or **Install Command** has its **Override** switch turned **on**, turn it **off**. Click **Save** if the button appears.
4. Click **Deployments** in the top menu. The top row should say **Ready** with a green dot. If it says **Error**, see *Troubleshooting* at the end.

Now skip to **Part 3: Turn on the AI coach**.

---

## Path B: Set up from scratch

### B.1 Put the app into GitHub Desktop

1. In GitHub Desktop, click the **File** menu, then **Add Local Repository…**
2. Click **Choose…**, go to Documents, then the unzipped package, then select the **burnout-pulse** folder (the one that contains `public` and `api`), and click **Add Repository**.
3. GitHub Desktop says *"This directory does not appear to be a Git repository."* Click the blue link **create a repository**.
4. In the window that opens:
   - **Name:** `burnout-pulse`
   - Leave everything else as it is.
   - Click **Create Repository**.
5. Click **Publish repository** at the top.
6. Keep **Keep this code private** checked. A hospital reviewer will expect a private repository. Then click **Publish Repository**.

### B.2 Create the website on Vercel

1. Go to **https://vercel.com** and click **Sign Up**.
2. If asked what you're using it for, choose **Hobby** (free).
3. Click **Continue with GitHub**, then click **Authorize Vercel** in the window that appears.
4. On the Vercel dashboard, click **Add New…**, then **Project**.
5. Find **burnout-pulse** in the list and click **Import**.
   - If it isn't listed, click **Configure GitHub App** (or **Adjust GitHub App Permissions**), give Vercel access to the `burnout-pulse` repository, then come back.
6. On the **Configure Project** screen:
   - **Framework Preset:** choose **Other**.
   - **Root Directory:** leave as `./`
   - Don't change any build settings, and leave **Environment Variables** empty for now.
7. Click **Deploy**. Wait one to two minutes until you see **Congratulations**.
8. Click **Continue to Dashboard**. Your web address is shown under **Domains**, for example `burnout-pulse-abc123.vercel.app`. **Write it down.**

---

## Part 2: Check the live site (both paths)

1. Open your web address in Safari or Chrome.
2. You should see **"A weekly check‑in, before the week checks in on you."**
3. Click **Create an account**. Use a passphrase of 15+ characters. **Write it down somewhere safe**, because it can't be recovered.
4. Answer all six questions and click **Save check-in**. The **Trend** page appears.
5. Click **Coach** and type `long week, pretty drained`. Without an API key, you get a reply labeled **Offline prompt**. That's correct for now.
6. Click **Lock** at the top right, then sign in again. Your check-in should still be there.

**Path A only:** if you had test accounts on the old version, sign in with one. The old data should appear, and a message says it moved to encrypted storage.

---

## Part 3: Turn on the AI coach (optional, but it's what makes the coach good)

### 3.1 Get an Anthropic API key

1. Go to **https://console.anthropic.com** and sign up or sign in.
2. Open **Billing** (the left menu, or under your account) and add a payment method. Add a **small** amount of credit, such as 5 or 10 dollars. Current per-message prices are at **https://www.anthropic.com/pricing**.
3. Set a spending cap. Find **Limits** (or **Spend limits**), set a **monthly limit** such as 20 dollars, and save.
4. Open **API Keys** and click **Create Key**. Name it `burnout-pulse`.
5. Copy the key. It starts with `sk-ant-`. **You can only see it once**, so paste it into a note for the next step. Never put it in any file, email, or chat.

### 3.2 Add the key and your web address to Vercel

1. On **https://vercel.com**, click your project, then **Settings**, then **Environment Variables**.
2. Add the first variable:
   - **Key:** `ANTHROPIC_API_KEY`
   - **Value:** paste your `sk-ant-…` key
   - Environments: leave all checked.
   - Click **Save**.
3. Add a second variable:
   - **Key:** `ALLOWED_ORIGINS`
   - **Value:** your full web address with `https://` and **no slash at the end**, for example `https://burnout-pulse-abc123.vercel.app`
   - Click **Save**.

### 3.3 Redeploy so the settings take effect

1. Click **Deployments** in the top menu.
2. On the top row, click the **⋯** (three dots) on the right, then **Redeploy**, then **Redeploy** again to confirm.
3. Wait until it says **Ready**.

### 3.4 Test the live coach

1. Open your site and sign in. Click **Coach**.
2. A card asks **"Turn on the live AI coach?"** Click **Turn on live coach**.
3. Type `long week, pretty drained` and press Return.
4. The reply should be labeled **Coach (AI)**, and the note under the box should say **"Live AI coach."**
5. **Safety test** (please do this once): type `I don't want to wake up tomorrow`. The coach should **stop** and show a gold box listing **988**, **911**, the **Crisis Text Line**, and the **Physician Support Line** with its hours. That message was never sent to the AI. This is the most important behavior in the app, so confirm it works on your deployment.

---

## Part 4: Lock it down (do this before anyone else uses it)

### 4.1 Rate-limit the coach (free, 3 minutes)

1. In your Vercel project, click **Firewall** in the sidebar.
2. Click **Configure** (top right), then **+ New Rule**.
3. **Name:** `coach rate limit`
4. Under **If**, set the dropdowns to **Request Path**, **Starts with**, and `/api/coach`
5. Under **Then**, choose **Rate Limit**. If a pricing notice appears, click **Continue**. (The free plan includes 1,000,000 checked requests.)
6. Set **Fixed Window**, **Time Window** `600` seconds (10 minutes), **Request Limit** `20`, key **IP**, and leave the action as **Default (429)**.
7. Click **Save Rule**, then **Review Changes** at the top right, then **Publish**.

### 4.2 While you're only testing, make the site visible only to you (free)

1. **Settings**, then **Deployment Protection**.
2. Turn on **Vercel Authentication** and choose **All Deployments**. Save.
3. Now only people signed into *your* Vercel account can open the site. **Turn this off** when you're ready for others to try it. For a hospital pilot, their IT department should put it behind their own sign-in instead. (Vercel's password protection costs extra, and the free plan doesn't include it.)

### 4.3 Things only you and a lawyer can do

- `burnout-pulse/PRIVACY.md` and `TERMS.md` (and their web copies, `public/privacy.html` and `public/terms.html`) contain **[bracketed] blanks**, such as the operator's legal name, contact email, and the AI provider agreement. A lawyer must fill these in before real users arrive.
- Optional: to show your institution's own support line in the app, open `public/config.js` in any text editor and add it under `resources`. The file has an example.

After editing any file: open GitHub Desktop, type a Summary, click **Commit to main**, then **Push origin**. The site updates in about a minute.

---

## Part 5: Tell your testers two things

1. **Their passphrase can't be recovered.** Nobody can reset it, not even you.
2. **On iPhone or iPad:** open the site in Safari, tap **Share**, then **Add to Home Screen**. Otherwise Safari may delete their data if they don't open it for about a week.

---

## Troubleshooting

**The deployment says Error, or the site shows `404: NOT_FOUND`**
- Check that `vercel.json` is in the top of your repository, next to `package.json` and not inside `public`. In GitHub Desktop, choose **Repository**, then **Show in Finder** to look.
- In **Settings**, then **Build and Deployment**, set Framework Preset to **Other** and turn every **Override** switch **off**. Then redeploy (step 3.3).
- If you see anything about function "memory": this version doesn't set it. Make sure the old `vercel.json` was replaced (step A.2).

**The coach replies are still labeled "Offline prompt"**
- Did you click **Turn on live coach**? Check **Settings**, then **Live AI coach**, in the app.
- The variable name must be exactly `ANTHROPIC_API_KEY`: all capitals, underscores, no spaces.
- `ALLOWED_ORIGINS` must match your address exactly: `https://`, and no slash at the end.
- You must **Redeploy** after changing variables (step 3.3).
- Your Anthropic account needs credit (step 3.1).

**A toast says "The live coach is busy"**
- That's the rate limit (20 messages per 10 minutes). Wait a few minutes.

**"This browser can't encrypt data securely"**
- Open the `https://` web address, not a file, in current Safari, Chrome, Edge, or Firefox.

**"That email and passphrase don't match an account on this device"**
- Each browser keeps its own encrypted data. An account made in Chrome doesn't exist in Safari, and one made on your Mac doesn't exist on your phone.
- A forgotten passphrase can't be recovered. To start over in that browser: in Safari, go to **Settings**, **Privacy**, **Manage Website Data…**, search your site, and click **Remove**.

**I see an old version**
- Wait a minute after pushing, then press **Command + Shift + R** to reload.

**I lost or leaked my API key**
- In the Anthropic console, delete the key and create a new one. Update it in Vercel (step 3.2) and redeploy (step 3.3).

---

## What's in the `burnout-pulse` folder

| Item | What it is |
|---|---|
| `public/` | The website itself. Everything visitors download lives here. |
| `public/config.js` | The one file you're expected to edit (institution name, support lines, lock timer) |
| `api/coach.js` | The live AI coach (runs on Vercel, never in the browser) |
| `vercel.json` | Tells Vercel how to run the site, plus the security headers |
| `README.md`, `CHANGELOG.md` | What the app does, and what changed from v12 |
| `SECURITY.md`, `SAFETY.md`, `ACCESSIBILITY.md` | What hospital reviewers will read |
| `PRIVACY.md`, `TERMS.md` | Legal templates (need a lawyer) |
| `tests/`, `tools/`, `supabase/` | For developers only. Never served to visitors. |
