// Matrix operations for OLS regression
// All matrices are 2D arrays: matrix[row][col]

export function zeros(rows, cols) {
  const m = new Array(rows);
  for (let i = 0; i < rows; i++) {
    m[i] = new Float64Array(cols);
  }
  return m;
}

export function transpose(A) {
  const rows = A.length, cols = A[0].length;
  const T = zeros(cols, rows);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      T[j][i] = A[i][j];
    }
  }
  return T;
}

export function multiply(A, B) {
  const aRows = A.length, aCols = A[0].length;
  const bCols = B[0].length;
  const C = zeros(aRows, bCols);
  for (let i = 0; i < aRows; i++) {
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += A[i][k] * B[k][j];
      }
      C[i][j] = sum;
    }
  }
  return C;
}

export function multiplyVec(A, v) {
  const rows = A.length, cols = A[0].length;
  const result = new Float64Array(rows);
  for (let i = 0; i < rows; i++) {
    let sum = 0;
    for (let j = 0; j < cols; j++) {
      sum += A[i][j] * v[j];
    }
    result[i] = sum;
  }
  return result;
}

// Gauss-Jordan elimination with partial pivoting
export function invert(A) {
  const n = A.length;
  const aug = zeros(n, 2 * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) aug[i][j] = A[i][j];
    aug[i][n + i] = 1;
  }

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(aug[row][col]);
      if (val > maxVal) { maxVal = val; maxRow = row; }
    }
    if (maxVal < 1e-14) {
      throw new Error('Singular matrix: cannot invert');
    }
    if (maxRow !== col) {
      const tmp = aug[col]; aug[col] = aug[maxRow]; aug[maxRow] = tmp;
    }

    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  const inv = zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      inv[i][j] = aug[i][n + j];
    }
  }
  return inv;
}

// Frobenius norm
export function norm(A) {
  let sum = 0;
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < A[0].length; j++) {
      sum += A[i][j] * A[i][j];
    }
  }
  return Math.sqrt(sum);
}

// Condition number estimate: ||A|| * ||A^{-1}||
export function conditionNumber(A) {
  try {
    const Ainv = invert(A);
    return norm(A) * norm(Ainv);
  } catch {
    return Infinity;
  }
}
