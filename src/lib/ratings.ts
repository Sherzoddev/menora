export type RatingRow = {
  id: string;
  rating: number;
  created_at: string;
};

// Shared by the admin and cabinet reviews pages (see plan: no URL-param
// period-filter convention exists anywhere else in the app yet, so this
// just computes all four windows at once instead of introducing one).
export function computeRatingStats<T extends RatingRow>(ratings: T[]) {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const today = ratings.filter((r) => new Date(r.created_at).getTime() >= startOfToday.getTime());
  const last7 = ratings.filter((r) => now - new Date(r.created_at).getTime() <= 7 * DAY);
  const last30 = ratings.filter((r) => now - new Date(r.created_at).getTime() <= 30 * DAY);

  const avg = (arr: T[]) => (arr.length ? arr.reduce((s, r) => s + r.rating, 0) / arr.length : 0);

  return {
    all: { count: ratings.length, avg: avg(ratings) },
    today: { count: today.length, avg: avg(today) },
    last7: { count: last7.length, avg: avg(last7) },
    last30: { count: last30.length, avg: avg(last30) },
    distribution: [5, 4, 3, 2, 1].map((n) => ({ n, count: ratings.filter((r) => r.rating === n).length })),
  };
}
