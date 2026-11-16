import { describe, expect, it } from "vitest";
import { extractContactName, looksLikePersonName } from "@/lib/email-extractor";
import { sanitizeContactName } from "@/lib/campaign-generation";

describe("noms de contact", () => {
  it.each(["David Yersin", "Severin Skillman", "Martin Maier", "Marie-Claire Dupont", "Jan van der Berg", "Ana de la Cruz", "Zoë Müller"])("accepte %s", (name) => {
    expect(looksLikePersonName(name)).toBe(true);
  });

  it.each([
    "Swiss Franc", "United States", "Eastern Time", "Fullscreen Page", "Our Story", "Who We Are", "Order Now", "My Blog",
    "Standard Shipping", "Mailbox Rentals", "Fresh Food", "Info Swiss", "Schoko Laden", "Fabrikladen Lyss", "Makari Shop",
    "Pocna Dive Center", "La Bagel Delight", "Traders Express Caterers", "Kündig Gruppe", "Garçoa Chocolate", "Marie", "MARIE DURAND",
  ])("refuse %s", (name) => {
    expect(looksLikePersonName(name)).toBe(false);
  });

  it("refuse le nom de l'entreprise elle-même", () => {
    expect(looksLikePersonName("Barry Callebaut", "Barry Callebaut AG")).toBe(false);
  });

  it("la rédaction remplace un nom douteux par l'équipe de l'entreprise", () => {
    expect(sanitizeContactName("Swiss Franc", "Taucherli")).toBe("Taucherli team");
    expect(sanitizeContactName("David Yersin", "PRONATEC AG")).toBe("David Yersin");
  });

  it("ne lit dans les données structurées que les objets Personne", () => {
    const shop = '<script type="application/ld+json">{"@type":"Product","name":"Swiss Franc","offers":{"priceCurrency":"CHF"}}</script>';
    expect(extractContactName(shop)).toBeNull();
    const person = '<script type="application/ld+json">{"@type":"Person","name":"Marie Durand","jobTitle":"Gérante"}</script>';
    expect(extractContactName(person)).toBe("Marie Durand");
    expect(extractContactName("<p>Gérante : Marie Durand</p>")).toBe("Marie Durand");
    expect(extractContactName("<h2>Our Story</h2><p>Contact : Our Team</p>")).toBeNull();
  });
});
