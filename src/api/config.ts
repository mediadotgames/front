if (!import.meta.env.VITE_API_URL) {
  throw new Error(
    "VITE_API_URL is not set. Add it to .env.production or the Cloudflare Pages environment variables.",
  );
}

export const API_BASE_URL: string = import.meta.env.VITE_API_URL;
