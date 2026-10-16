import { describe, expect, it } from "vitest";
import { imageSourceKey } from "../src/sync";

describe("imageSourceKey", () => {
  it("ignorerar Metas signatur så att samma bild inte laddas ner igen", () => {
    const a = imageSourceKey("https://scontent.xx.fbcdn.net/v/t51/123_n.jpg?_nc_cat=1&oh=abc&oe=111");
    const b = imageSourceKey("https://scontent.xx.fbcdn.net/v/t51/123_n.jpg?_nc_cat=1&oh=def&oe=222");
    expect(a).toBe(b);
  });

  it("skiljer på externa bilder via Metas proxy", () => {
    const a = imageSourceKey("https://external.xx.fbcdn.net/emg1/v/t13/1?url=https%3A%2F%2Fa.se%2F1.jpg&_nc_oc=x");
    const b = imageSourceKey("https://external.xx.fbcdn.net/emg1/v/t13/1?url=https%3A%2F%2Fa.se%2F2.jpg&_nc_oc=x");
    expect(a).not.toBe(b);
  });
});
