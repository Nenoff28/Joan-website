import { afterEach, describe, expect, it } from "vitest";
import {
  consumeCustomerAuthRateLimit,
  normalizeCustomerEmail,
  validateCustomerRegistrationInput,
} from "./customerAccounts";
import { assertCustomerSameOrigin } from "./customerAuthRouter";

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

describe("public customer registration", () => {
  it("normalizes the email and accepts the required registration fields", () => {
    expect(normalizeCustomerEmail("  Person@Example.COM ")).toBe("person@example.com");
    expect(validateCustomerRegistrationInput({
      firstName: " Ana ",
      lastName: " Customer ",
      email: " Ana.Customer@Example.COM ",
      phone: " 0888 000 000 ",
      password: "a sufficiently long password",
      acceptedTerms: true,
    })).toEqual({ firstName: "Ana", lastName: "Customer", email: "ana.customer@example.com", phone: "0888 000 000" });
  });

  it("rejects short passwords, missing terms and malformed identity fields", () => {
    expect(() => validateCustomerRegistrationInput({ firstName: "A", lastName: "B", email: "person@example.com", password: "short", acceptedTerms: true })).toThrow("поне 12");
    expect(() => validateCustomerRegistrationInput({ firstName: "A", lastName: "B", email: "person@example.com", password: "a sufficiently long password", acceptedTerms: false })).toThrow("условията");
    expect(() => validateCustomerRegistrationInput({ firstName: "", lastName: "B", email: "not-an-email", password: "a sufficiently long password", acceptedTerms: true })).toThrow();
  });

  it("uses bounded independent buckets and rejects a cross-site Origin", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    expect(consumeCustomerAuthRateLimit(key, 2, 60_000)).toBe(true);
    expect(consumeCustomerAuthRateLimit(key, 2, 60_000)).toBe(true);
    expect(consumeCustomerAuthRateLimit(key, 2, 60_000)).toBe(false);

    expect(() => assertCustomerSameOrigin({ protocol: "http", headers: { origin: "https://evil.example", host: "shop.example" } })).toThrow("Невалидна заявка");
    expect(() => assertCustomerSameOrigin({ protocol: "http", headers: { origin: "https://shop.example", host: "shop.example" } })).not.toThrow();
  });
});
