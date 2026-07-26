// Ordinary Least Squares with HC1 heteroskedasticity-robust standard errors
//
// beta_hat = (X'X)^{-1} X'y
// HC1: V = (n/(n-k)) * (X'X)^{-1} * X' diag(e^2) X * (X'X)^{-1}

import { transpose, multiply, multiplyVec, invert, conditionNumber } from './matrix.js';
import { tCritical, tPValue } from './distributions.js';

export function ols(y, X, options = {}) {
  const {
    addIntercept = true,
    robust = true,
    alpha = 0.05,
    names = null
  } = options;

  const n = y.length;

  // Build design matrix (optionally prepend intercept column)
  let Xmat;
  if (addIntercept) {
    Xmat = new Array(n);
    for (let i = 0; i < n; i++) {
      Xmat[i] = new Float64Array([1, ...X[i]]);
    }
  } else {
    Xmat = X.map(row => new Float64Array(row));
  }

  const k = Xmat[0].length;
  const coeffNames = names || generateNames(k, addIntercept);

  // X'X
  const Xt = transpose(Xmat);
  const XtX = multiply(Xt, Xmat);

  // Check condition number
  const cond = conditionNumber(XtX);
  const condWarning = cond > 1e10;

  // (X'X)^{-1}
  const XtXinv = invert(XtX);

  // X'y
  const Xty = multiplyVec(Xt, y);

  // beta = (X'X)^{-1} X'y
  const beta = multiplyVec(XtXinv, Xty);

  // Fitted values and residuals
  const fitted = multiplyVec(Xmat, beta);
  const residuals = new Float64Array(n);
  let sse = 0;
  for (let i = 0; i < n; i++) {
    residuals[i] = y[i] - fitted[i];
    sse += residuals[i] * residuals[i];
  }

  // Total sum of squares
  let yMean = 0;
  for (let i = 0; i < n; i++) yMean += y[i];
  yMean /= n;
  let sst = 0;
  for (let i = 0; i < n; i++) sst += (y[i] - yMean) * (y[i] - yMean);

  const sigma2 = sse / (n - k);
  const sigma = Math.sqrt(sigma2);
  const rSquared = 1 - sse / sst;
  const adjRSquared = 1 - (1 - rSquared) * (n - 1) / (n - k - 1);

  // Classical standard errors: se_j = sigma * sqrt(diag((X'X)^{-1})_jj)
  const seClassical = new Float64Array(k);
  for (let j = 0; j < k; j++) {
    seClassical[j] = sigma * Math.sqrt(Math.abs(XtXinv[j][j]));
  }

  // HC1 robust standard errors (sandwich estimator)
  // meat = X' diag(e^2) X = sum_i e_i^2 * x_i x_i'
  const meat = new Array(k);
  for (let j = 0; j < k; j++) meat[j] = new Float64Array(k);
  for (let i = 0; i < n; i++) {
    const ei2 = residuals[i] * residuals[i];
    for (let j = 0; j < k; j++) {
      for (let l = j; l < k; l++) {
        const val = ei2 * Xmat[i][j] * Xmat[i][l];
        meat[j][l] += val;
        if (j !== l) meat[l][j] += val;
      }
    }
  }
  const sandwich = multiply(multiply(XtXinv, meat), XtXinv);
  const hc1Scale = n / (n - k);
  const seRobust = new Float64Array(k);
  for (let j = 0; j < k; j++) {
    seRobust[j] = Math.sqrt(hc1Scale * Math.abs(sandwich[j][j]));
  }

  const se = robust ? seRobust : seClassical;

  // t-statistics and p-values
  const tStats = new Float64Array(k);
  const pValues = new Float64Array(k);
  for (let j = 0; j < k; j++) {
    tStats[j] = beta[j] / se[j];
    pValues[j] = tPValue(tStats[j], n - k);
  }

  // Confidence intervals
  const tCrit = tCritical(alpha, n - k);
  const ci = new Array(k);
  for (let j = 0; j < k; j++) {
    ci[j] = [beta[j] - tCrit * se[j], beta[j] + tCrit * se[j]];
  }

  return {
    beta: Array.from(beta),
    se: Array.from(se),
    seClassical: Array.from(seClassical),
    seRobust: Array.from(seRobust),
    tStats: Array.from(tStats),
    pValues: Array.from(pValues),
    ci,
    residuals: Array.from(residuals),
    fitted: Array.from(fitted),
    rSquared,
    adjRSquared,
    sigma,
    n,
    k,
    names: coeffNames,
    conditionNumber: cond,
    condWarning
  };
}

function generateNames(k, hasIntercept) {
  const names = [];
  if (hasIntercept) names.push('intercept');
  for (let i = names.length; i < k; i++) {
    names.push(`x${i}`);
  }
  return names;
}

// Compute bias relative to a known true value
export function computeBias(estimated, truth) {
  const absolute = estimated - truth;
  const percentage = truth !== 0 ? (absolute / Math.abs(truth)) * 100 : (estimated !== 0 ? Infinity : 0);
  return { absolute, percentage };
}
