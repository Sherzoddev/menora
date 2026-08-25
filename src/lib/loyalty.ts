// Простая программа лояльности: настраиваемый % от суммы каждого заказа
// (venues.loyalty_percent) начисляется баллами (1 балл = 1 сум — без
// округления до шага), баллы можно списать при следующем заказе.
export const POINT_VALUE = 1;
export const DEFAULT_LOYALTY_PERCENT = 2;

export function pointsEarnedFor(total: number, loyaltyPercent: number) {
  return Math.round(total * (loyaltyPercent / 100));
}
