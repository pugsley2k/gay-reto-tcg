export type PostalOrder = {id:string;paid_at:string;customer_email:string;shipping:{subtotal:number;price:number;total:number;label:string;compensation:number};delivery_address:{name?:{full_name?:string};address?:{address_line_1?:string;address_line_2?:string;admin_area_2?:string;admin_area_1?:string;postal_code?:string;country_code?:string}}};
export function royalMailPayload(order:PostalOrder,weight:number,business=false) {
 const address=order.delivery_address?.address;
 if(!order.paid_at||!address?.address_line_1||!address.admin_area_2||!address.postal_code||address.country_code!=='GB')throw new Error('A paid UK order with its full delivery address is required.');
 if(!Number.isInteger(weight)||weight<1||weight>2000)throw new Error('Enter the measured packed weight, from 1 to 2000 grams.');
 return {items:[{orderReference:order.id,orderDate:order.paid_at,subtotal:order.shipping.subtotal/100,shippingCostCharged:order.shipping.price/100,total:order.shipping.total/100,isRecipientABusiness:business,recipient:{emailAddress:order.customer_email,address:{fullName:order.delivery_address.name?.full_name,addressLine1:address.address_line_1,addressLine2:address.address_line_2,city:address.admin_area_2,county:address.admin_area_1,postcode:address.postal_code,countryCode:'GB'}},packages:[{weightInGrams:weight,packageFormatIdentifier:'smallParcel'}],specialInstructions:`Customer selected ${order.shipping.label}. Required compensation £${(order.shipping.compensation/100).toFixed(0)}. Check service and cover before buying postage.`}]};
}
export function postedTracking(order:{shippedOn?:string;trackingNumber?:string}) {
 return order.shippedOn&&Number.isFinite(Date.parse(order.shippedOn))&&/^[A-Z0-9]{8,30}$/i.test(order.trackingNumber||'')?order.trackingNumber!.toUpperCase():null;
}
