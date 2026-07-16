import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://democraft.dev",
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
