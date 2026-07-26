// Statistical distributions and random number generation

// Seedable PRNG: xoshiro128** algorithm
export function seedableRNG(seed) {
  let s = [seed | 0, (seed * 1664525 + 1013904223) | 0,
           (seed * 214013 + 2531011) | 0, (seed * 16807 + 12345) | 0];
  // Ensure non-zero state
  if (s.every(v => v === 0)) s[0] = 1;

  function rotl(x, k) { return ((x << k) | (x >>> (32 - k))) | 0; }

  return function() {
    const result = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0;
    const t = (s[1] << 9) | 0;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= t; s[3] = rotl(s[3], 11);
    return result / 4294967296;
  };
}

// Box-Muller transform for standard normal draws
export function normalRandom(rng) {
  let u1, u2;
  do { u1 = rng(); } while (u1 === 0);
  u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Generate n normal draws
// AR(1) process: e_t = rho * e_{t-1} + v_t where v_t ~ N(0, sigma^2)
export function ar1Process(n, rho, sigma, rng) {
  const e = new Float64Array(n);
  e[0] = normalRandom(rng) * sigma / Math.sqrt(1 - rho * rho + 1e-10);
  for (let t = 1; t < n; t++) {
    e[t] = rho * e[t - 1] + normalRandom(rng) * sigma;
  }
  return e;
}

// Standard normal CDF (Abramowitz & Stegun rational approximation)
export function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

// Standard normal quantile (inverse CDF) via Beasley-Springer-Moro
export function normalQuantile(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a = [-3.969683028665376e+01, 2.209460984245205e+02,
             -2.759285104469687e+02, 1.383577518672690e+02,
             -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02,
             -1.556989798598866e+02, 6.680131188771972e+01,
             -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01,
             -2.400758277161838e+00, -2.549732539343734e+00,
              4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01,
             2.445134137142996e+00, 3.754408661907416e+00];

  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

// Student's t critical value (two-sided)
// Uses normal approximation for df > 30, exact values for small df
export function tCritical(alpha, df) {
  if (df > 300) return normalQuantile(1 - alpha / 2);

  // Cornish-Fisher expansion for moderate df
  const z = normalQuantile(1 - alpha / 2);
  const z2 = z * z;
  const g1 = (z2 + 1) / (4 * df);
  const g2 = (5 * z2 * z2 + 16 * z2 + 3) / (96 * df * df);
  const g3 = (3 * z2 * z2 * z2 + 19 * z2 * z2 - 17 * z2 - 15) / (384 * df * df * df);
  return z * (1 + g1 + g2 + g3);
}

// Two-sided p-value from t-statistic using normal approx for large df
export function tPValue(t, df) {
  if (df > 300) return 2 * (1 - normalCDF(Math.abs(t)));

  // Regularized incomplete beta function approximation
  const x = df / (df + t * t);
  return betaRegularized(df / 2, 0.5, x);
}

// Regularized incomplete beta (simple continued fraction)
function betaRegularized(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;

  // Lentz continued fraction
  const maxIter = 200;
  const eps = 1e-14;
  let f = 1, c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  f = d;

  for (let m = 1; m <= maxIter; m++) {
    let num = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    f *= d * c;

    num = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    const delta = d * c;
    f *= delta;
    if (Math.abs(delta - 1) < eps) break;
  }

  const result = front * f;
  return x < (a + 1) / (a + b + 2) ? result : 1 - result;
}

// Log-gamma function (Lanczos approximation)
function lnGamma(x) {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
             771.32342877765313, -176.61502916214059, 12.507343278686905,
             -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
