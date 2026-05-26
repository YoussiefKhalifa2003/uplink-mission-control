/// <reference types="vite/client" />

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SSE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
