# Date Night Menu

A tiny Cloudflare Pages app for keeping a shared menu and seeing the latest order.

## Run locally

```bash
npm install
npm run dev
```

The local preview works even before KV is configured, using an in-memory fallback.

## Deploy to Cloudflare Pages

1. Create a KV namespace and preview namespace:

```bash
npx wrangler kv namespace create MENU_STORE
npx wrangler kv namespace create MENU_STORE --preview
```

2. Add a KV binding named `MENU_STORE` in your Cloudflare Pages project settings.
3. Deploy:

```bash
npm run deploy
```

If deploying through the Cloudflare dashboard instead, set the Pages build output directory to `public` and add a KV binding named `MENU_STORE`.
