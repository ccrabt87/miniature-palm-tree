# Putting HaulMath on an Android phone

There are two ways, and they are not equally good. Start with the first.

---

## 1. Install it from the browser (works right now, no store)

The app is a PWA. On the phone:

1. Open the site in **Chrome**.
2. Menu (⋮) → **Add to Home screen** / **Install app**.
3. It gets the truck icon, opens fullscreen with no browser bar, and appears in
   the app drawer and recents like any other app.

This is the whole install. No Play Store account, no review, no waiting, and
updates ship the moment you deploy — he never has to update anything.

**It works without signal.** The rate check runs on the phone, not the server:

- Opening the app with no bars gets him a working rate check.
- Loads and expenses saved offline are held on the phone and sync when signal
  returns. Each carries a key the server dedupes on, so a flaky connection
  cannot create the same load twice.
- Pages he has already visited stay readable offline. Invoices and billing
  deliberately do not — a stale invoice is worse than an honest error.

For a one-truck operation this is almost certainly where to stop.

---

## 2. Ship it to the Play Store (a real .aab)

Only worth it if he wants it *findable in the Play Store*, or you plan to sell
to other drivers and want the credibility of a store listing.

Use **Bubblewrap**, Google's own tool for wrapping a PWA in a Trusted Web
Activity. A TWA is a real Android app that runs the site fullscreen with no
browser chrome.

### Requirements

- Node 18+, **JDK 17**, and the **Android SDK** (easiest via Android Studio).
- The app must be served over **HTTPS on a real domain**.
- A Play Console account ($25 one-off).

None of this can be done from this repo's container — it has no Android SDK.
Run it on a machine with Android Studio installed.

### Steps

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://YOUR-DOMAIN/manifest.webmanifest
```

Edit `android/twa-manifest.json` first and replace every `haulmath.example.com`
with the real domain, and `com.prairiefreight.haulmath` with a package id you
control. Then:

```bash
bubblewrap build          # produces app-release-bundle.aab and app-release-signed.apk
```

Sideload the APK to test on his phone:

```bash
adb install app-release-signed.apk
```

Upload the `.aab` in the Play Console.

### The step everyone forgets

A TWA shows a **browser URL bar across the top** unless the domain proves it
owns the app. Fix it with Digital Asset Links.

Get the signing key fingerprint:

```bash
keytool -list -v -keystore android/haulmath-release.keystore -alias haulmath \
  | grep 'SHA256:'
```

Then set these on the server and redeploy:

```
ANDROID_PACKAGE_NAME=com.prairiefreight.haulmath
ANDROID_CERT_FINGERPRINT=AA:BB:CC:...   # comma-separate to add Play's key too
```

The server then serves `/.well-known/assetlinks.json`. Verify:

```bash
curl https://YOUR-DOMAIN/.well-known/assetlinks.json
```

**Once you enable Play App Signing, Google re-signs the app with its own key.**
The fingerprint in the Play Console under *Setup → App signing* must ALSO be in
`ANDROID_CERT_FINGERPRINT`, or the URL bar comes back for everyone who installs
from the store while it stays hidden on your test device. Put both in, comma
separated.

### One warning about Play review

Google rejects apps that are "just a website in a wrapper" under its minimum
functionality policy. A TWA built with Bubblewrap from a real, installable PWA
normally passes, because it is the path Google itself documents. A generic
WebView wrapper often does not. Use Bubblewrap, not a hand-rolled WebView.

---

## 3. If you later want native features

Things the web cannot do well, that this app would genuinely benefit from:

| Feature | Why it needs native |
|---|---|
| Automatic state-line mileage for IFTA | Continuous background GPS |
| Photograph a BOL or fuel receipt onto a load | Reliable camera + file handling |
| Reminders that survive a force-quit | Native notifications and alarms |

At that point move from Bubblewrap to **Capacitor**, which wraps the same
server-rendered app but exposes native plugins:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init HaulMath com.prairiefreight.haulmath
npx cap add android
```

Point Capacitor at the live server rather than bundling static files, since
this app renders on the server:

```json
{ "server": { "url": "https://YOUR-DOMAIN", "cleartext": false } }
```

Automatic state-line mileage is the one worth building. It turns IFTA from a
quarterly evening of paperwork into something that just happens, and that is a
feature drivers will pay for on its own.
