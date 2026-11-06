import { describe, expect, it } from "vitest";
import { PARSER_VERSION, parseSave } from "../../src/importer/savelens/index.ts";

describe("pinned SaveLens parser", () => {
  it("exposes the pinned parser", () => {
    expect(PARSER_VERSION).toBe("fm24-7");
    expect(typeof parseSave).toBe("function");
  });
});
