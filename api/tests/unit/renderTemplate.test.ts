import { renderTemplate } from "../../src/services/renderTemplate";

describe("renderTemplate", () => {
  it("replaces known variables with their values", () => {
    const result = renderTemplate("Hi {{GUEST_FIRST_NAME}}, this is {{HOST_FIRST_NAME}}.", {
      GUEST_FIRST_NAME: "Jermey",
      HOST_FIRST_NAME: "Alex",
    });
    expect(result).toBe("Hi Jermey, this is Alex.");
  });

  it("replaces the same variable used multiple times", () => {
    const result = renderTemplate("{{GUEST_FIRST_NAME}}, hi {{GUEST_FIRST_NAME}}!", {
      GUEST_FIRST_NAME: "Sam",
    });
    expect(result).toBe("Sam, hi Sam!");
  });

  it("renders a missing variable as blank rather than leaving the placeholder", () => {
    const result = renderTemplate("Call {{HOST_PHONE_NUMBER}} anytime.", {
      HOST_PHONE_NUMBER: undefined,
    });
    expect(result).toBe("Call  anytime.");
  });

  it("renders an unrecognized token as blank", () => {
    const result = renderTemplate("Value: {{NOT_A_REAL_TOKEN}}", {});
    expect(result).toBe("Value: ");
  });

  it("renders a null value as blank", () => {
    const result = renderTemplate("{{GUEST_LAST_NAME}}", { GUEST_LAST_NAME: null });
    expect(result).toBe("");
  });

  it("leaves plain text with no placeholders untouched", () => {
    const result = renderTemplate("No variables here.", {});
    expect(result).toBe("No variables here.");
  });
});
