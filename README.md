# Eat Where

Mobile-friendly food spot suggester powered by your `food_spots.xlsx` list.

**Live app:** [https://dlimtx.github.io/food-spot-selector/](https://dlimtx.github.io/food-spot-selector/)

Pick a **day**, **time**, **location**, and **cuisine**, then get one matching suggestion based on opening hours and closing days.

## Run on your computer

From this project folder:

```bash
python -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173).

If you update the Excel sheet, refresh the app data first:

```bash
python scripts/convert_excel.py
```

## Use it on your phone

1. Put your phone on the **same Wi‑Fi** as your computer.
2. Start the app with `python -m http.server 4173`.
3. Find your computer’s local IP address:
   - **Windows:** run `ipconfig` and look for `IPv4 Address` (e.g. `192.168.0.10`)
4. On your phone’s browser, open:
   - `http://YOUR_IP:4173`  
     Example: `http://192.168.0.10:4173`

Keep the terminal open while you use the app.

### Optional: keep it online

Deploy this folder (static files) to [Netlify](https://www.netlify.com/), [Vercel](https://vercel.com/), or GitHub Pages so you can open it anywhere without your computer running.

## How matching works

- **Day:** skips spots closed on the selected day (defaults to today)
- **Time:** only spots open at the selected hour (including overnight hours like 5pm–3am)
- **Location:** matches spots listed for that area (`West, Central` counts for either)
- **Cuisine:** exact cuisine match, or `Any cuisine`
