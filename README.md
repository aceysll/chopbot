# Chopbot

A video reshuffler tool. Cut your video into segments, rearrange them, preview the new order, and export via ffmpeg.

## Deploy to Vercel (from Termux)

```bash
# 1. Create a GitHub repo called "chopbot" and push these files
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/YOUR_USERNAME/chopbot.git
git push -u origin main

# 2. Go to vercel.com, import the repo
# Framework: Vite
# Build command: npm run build
# Output directory: dist
# That's it. Vercel gives you a public URL.
```

## Local dev

```bash
npm install
npm run dev
```
