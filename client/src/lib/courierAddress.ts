import type { CourierOffice } from "../../../server/couriers/types";

const courierNames = { econt: "Еконт", speedy: "Спиди" } as const;

// No delivery-method column: a courier-office request records the office in the address fields, like a store pickup.
export function courierOfficeAddress(office: CourierOffice, priceEur: number | null) {
  const kind = `${office.isLocker ? "Автомат" : "Офис"} ${courierNames[office.courier]}`;
  const price = priceEur === null ? "цена за доставка: потвърждава се от оператор" : `ориентировъчна доставка ${priceEur.toFixed(2).replace(".", ",")} €`;
  return {
    address: `${kind}: ${office.name} (${office.code}) — ${office.address}; ${price}`,
    region: office.city,
    city: office.city,
    // The request needs a 4-digit postcode; the office code above is what the operator uses.
    postcode: /^\d{4}$/.test(office.postcode) ? office.postcode : "0000",
  };
}
