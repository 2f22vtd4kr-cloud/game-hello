/// <reference types="vite/client" />

/**
 * Allow importing image assets (.png, .jpg, .svg, .webp, .gif) as URL strings.
 * Vite resolves these to their bundled asset paths at build time.
 */
declare module "*.png" {
  const src: string;
  export default src;
}
declare module "*.jpg" {
  const src: string;
  export default src;
}
declare module "*.jpeg" {
  const src: string;
  export default src;
}
declare module "*.webp" {
  const src: string;
  export default src;
}
declare module "*.gif" {
  const src: string;
  export default src;
}
declare module "*.svg" {
  const src: string;
  export default src;
}
