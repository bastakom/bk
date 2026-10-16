import { z } from "zod";

/** Loggor lagras som data-URL (max ~300 kB). Bara bildformat som inte kan köra kod i <img>. */
export const logoSchema = z
  .string()
  .max(420_000, "Loggan får vara högst 300 kB")
  .regex(/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/, "Loggan måste vara PNG, JPG, WEBP eller SVG")
  .nullable();
