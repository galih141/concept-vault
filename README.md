# Concept Vault — Google Drive edition

Same gallery, but the images live in Google Drive instead of the GitHub repo — so you can upload straight from your phone and never worry about repo size.

```
Category (left tab)  →  Model type (folder)  →  Images
   cars                    super-car               *.jpg / *.png
                            offroad
   guns                    fantasy
                            realistic
                            stylized
```

## 1. Set up your Drive folder

1. In Google Drive, create a folder — this will be your "root" (e.g. name it `concept-vault`).
2. Inside it, create one folder per **category** (e.g. `cars`, `guns`) — these become the tabs.
3. Inside each category, create one folder per **model type** (e.g. `super-car`, `offroad`) — these become the folders on the main page.
4. Drop your images into the model-type folders, from your phone or desktop — regular Drive upload/sync.
5. Right-click the **root folder** → **Share** → under "General access" choose **Anyone with the link** → role **Viewer**. This makes everything inside it viewable via link, which is what lets the site read it.
6. Open the root folder in Drive and copy its ID from the address bar:
   ```
   https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
                                            └──────────── this part ────────────┘
   ```

## 2. Get a Google API key

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a new project (top-left project picker → New Project). Any name is fine.
2. Go to **APIs & Services → Library**, search for **Google Drive API**, and click **Enable**.
3. Go to **APIs & Services → Credentials → Create Credentials → API key**. Copy the key it gives you.
4. Click into that key's settings and restrict it (important — this key will be visible in your site's public source code):
   - **Application restrictions** → `HTTP referrers (web sites)` → add your GitHub Pages URL, e.g. `https://your-username.github.io/*`
   - **API restrictions** → `Restrict key` → select only **Google Drive API**
   - Save.

With both restrictions in place, the key only works when called from your site and only for reading Drive metadata — safe to commit.

## 3. Configure the site

Open `js/config.js`:

```js
const CONFIG = {
  apiKey: "paste your API key here",
  rootFolderId: "paste your folder ID here",
  ...
};
```

Commit and push.

## 4. Publish with GitHub Pages

1. Repo → **Settings → Pages**.
2. Source: `Deploy from a branch` → branch `main`, folder `/ (root)`.
3. Save. Your gallery is live at `https://your-username.github.io/your-repo-name/`.

## Day-to-day use

Just upload new images into the right Drive folder (from the Drive mobile app works great). Reload the site — no push, no manifest, nothing else to do. New categories/model-types show up automatically the same way.

## Good to know

- **Image quality:** the site requests images through Drive's thumbnail pipeline rather than the raw file, which is actually *more* reliable for embedding (Drive's direct-download links can show a "can't scan for viruses" interstitial for larger files, so this avoids that). It's requested at 1800px for the zoomed-in view — plenty for browsing/reviewing concept art, though it's not the literal original pixel-for-pixel file. If you ever need the true original, it's still sitting in Drive.
- **Rate limits:** Google's free API quota is generous for personal use (tens of thousands of requests/day) — you won't hit it browsing casually.
- **Sharing scope:** "Anyone with the link" means anyone who has (or guesses) your folder ID could view it — it isn't indexed/searchable, but it's not private either. Don't put anything sensitive in there.
- **Folder must stay shared:** if you ever change the root folder's sharing back to private, the site stops working until it's public-by-link again.

## Customizing

- `js/config.js` — site title, tab colors, thumbnail sizes.
- `css/style.css` — palette, fonts, tab/folder shapes (`:root` at the top).
