# stuck together 🎀

Flippable scrapbooks you make with your friends. Sign in, start a scrapbook, send the
invite link to the group chat, and everyone adds photos, letters, lists and stickers.
Changes show up live for everyone.

Live at **https://stuck-together.vercel.app**

- **Any kind of book:** for a person (a birthday, a goodbye), a trip, a year or season,
  or an ongoing book for the group. Each starts with its own set of pages.
- **Your shelf:** every scrapbook you're in, on one page
- **11 page layouts:** letter, one photo, two photos + clipping, collage, list, blank,
  film strip, photo grid, ticket stub, notes wall, quote
- **5 papers:** kraft, blush, noir, sky, sage
- **Stickers:** your photos cut into hearts, stars and scallops, 27 doodles, washi tape,
  and word stickers in typewriter, tape or cut-out letters
- **Friends:** invite links, a member list, and a new link whenever you want to turn off
  the old one

Plain HTML, CSS and JavaScript on Firebase (Auth + Firestore). No build step.

## How access works

- Everyone signs in with Google or an emailed sign-in link. No passwords.
- A scrapbook can only be opened by its members. The invite link adds whoever signs in
  with it; making a new link turns the old one off.
- Every member can edit everything. Anyone can leave. Only the person who made a
  scrapbook can remove members or delete it.
- Photos are shrunk on the device (about 1400px) and stored in Firestore, so no paid
  Firebase plan is needed.

The rules that enforce this are in [`firestore.rules`](firestore.rules).

## Set up your own copy

1. **Create a Firebase project** at https://console.firebase.google.com (the free Spark
   plan is fine).
2. **Sign-in:** Build → Authentication → Get started. Enable **Google**, and enable
   **Email/Password** with **Email link (passwordless sign-in)** turned on.
3. **Database:** Build → Firestore Database → Create database (production mode).
4. **Web app config:** Project settings → Your apps → Web (`</>`). Copy the config values
   into [`public/js/firebase-config.js`](public/js/firebase-config.js), replacing the ones
   there (they point at the live site's project), and put your project ID in `.firebaserc`.
5. **Rules:** publish `firestore.rules` and `firestore.indexes.json`:

   ```bash
   npx firebase-tools login
   npx firebase-tools use --add
   npm run rules
   ```

   (Or paste `firestore.rules` into Firestore → Rules in the console.)
6. **Run it locally:**

   ```bash
   npm run dev
   ```

   Open http://localhost:5180.
7. **Deploy** to [Vercel](https://vercel.com):

   ```bash
   npx vercel --prod
   ```

   Then add your site's domain (e.g. `your-site.vercel.app`) under Firebase →
   Authentication → Settings → **Authorized domains**, or sign-in won't work there.

## Limits

- Firestore's free tier includes about 1 GB of storage and 50,000 reads a day. That's a
  lot of scrapbooks for friend groups, but books full of photos use it up faster.
- Up to 50 people per scrapbook.
- Anyone can sign up and start scrapbooks. If spam ever becomes a problem, turn on
  Firebase App Check.

## Credits

Page turning by [StPageFlip](https://github.com/Nodlik/StPageFlip) (MIT, see
`public/vendor/page-flip-LICENSE`).
