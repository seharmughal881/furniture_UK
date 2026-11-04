/**
 * The one place that turns an order row into an Oman delivery address.
 *
 * The column names actively mislead, because checkout reuses the old UK schema
 * (src/app/api/checkout/route.ts:27-33 is the mapping):
 *   address  = area / street or way number      address2 = building / house and flat
 *   city     = WILAYA                           county   = GOVERNORATE
 *   country  = always "Oman"                    postcode = always "" -- never render it
 * Anyone reading `city` as a city would mislabel every delivery note in the system, so
 * all address rendering goes through here.
 *
 * dir="auto" because Omani customers often write the area or landmark in Arabic.
 */
export function OrderAddress({
  order,
}: {
  order: { address: string; address2: string; city: string; county: string; landmark: string };
}) {
  return (
    <span dir="auto" style={{ display: "block" }}>
      {order.address2 && (
        <>
          {order.address2}
          <br />
        </>
      )}
      {order.address}
      <br />
      {order.city}
      {order.city && order.county ? ", " : ""}
      {order.county}
      {order.landmark && (
        <>
          <br />
          <em>Near {order.landmark}</em>
        </>
      )}
    </span>
  );
}
