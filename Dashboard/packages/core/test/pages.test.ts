import { describe, expect, it } from "vitest";
import { dashboardPages, DEFAULT_PAGE, widgetPageId } from "../src/widgets";

describe("sidor", () => {
  it("en dashboard utan sidor har en sida", () => {
    expect(dashboardPages({})).toEqual([DEFAULT_PAGE]);
    expect(dashboardPages(null)).toEqual([DEFAULT_PAGE]);
  });

  it("widgets utan eller med okänd sida hamnar på första sidan", () => {
    const pages = [{ id: "a", name: "Översikt" }, { id: "b", name: "Meta" }];
    expect(widgetPageId({}, pages)).toBe("a");
    expect(widgetPageId({ pageId: "borttagen" }, pages)).toBe("a");
    expect(widgetPageId({ pageId: "b" }, pages)).toBe("b");
  });
});

import { videoEmbed } from "../src/widgets";

describe("video", () => {
  it("känner igen YouTube och Vimeo", () => {
    expect(videoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.embed).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbed("https://youtu.be/dQw4w9WgXcQ")?.thumbnail).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(videoEmbed("https://youtube.com/shorts/abcDEF12345")?.provider).toBe("youtube");
    expect(videoEmbed("https://vimeo.com/123456789")?.embed).toBe("https://player.vimeo.com/video/123456789");
  });

  it("avvisar andra adresser", () => {
    expect(videoEmbed("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(videoEmbed("javascript:alert(1)")).toBeNull();
    expect(videoEmbed("inte en länk")).toBeNull();
  });
});
