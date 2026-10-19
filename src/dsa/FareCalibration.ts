import { CabFareObservation } from '../types';

export interface CalibrationResult {
  n: number;
  intercept: number;
  a: number; // per km coefficient
  b: number; // per min coefficient
  mae: number;
  mape: number;
}

/**
 * Solves a 3x3 linear system A * x = B using Gaussian elimination with partial pivoting.
 * @param A 3x3 matrix
 * @param B 3x1 vector
 * @returns 3x1 solution vector [x0, x1, x2]
 */
export function solve3x3Gaussian(A: number[][], B: number[]): number[] {
  // Clone to avoid mutating inputs
  const a = A.map((row) => [...row]);
  const b = [...B];
  const n = 3;

  for (let col = 0; col < n; col++) {
    // Partial pivoting: find maximum element in current column
    let maxRow = col;
    let maxVal = Math.abs(a[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > maxVal) {
        maxVal = Math.abs(a[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-12) {
      throw new Error('Singular matrix in Gaussian elimination: collinear features');
    }

    // Swap rows
    if (maxRow !== col) {
      const tempA = a[col];
      a[col] = a[maxRow];
      a[maxRow] = tempA;

      const tempB = b[col];
      b[col] = b[maxRow];
      b[maxRow] = tempB;
    }

    // Forward elimination
    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / a[col][col];
      for (let j = col; j < n; j++) {
        a[row][j] -= factor * a[col][j];
      }
      b[row] -= factor * b[col];
    }
  }

  // Back-substitution
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let j = row + 1; j < n; j++) {
      sum -= a[row][j] * x[j];
    }
    x[row] = sum / a[row][row];
  }

  return x;
}

/**
 * Fits linear model: Fare ≈ intercept + a * km + b * min
 * using Ordinary Least Squares (OLS) via normal equations:
 * (X^T * X) * beta = X^T * Y
 */
export function fitCabRatesOLS(observations: CabFareObservation[]): CalibrationResult {
  const n = observations.length;
  if (n < 5) {
    throw new Error(`Insufficient observations: minimum 5 required, got ${n}`);
  }

  let sum1 = n;
  let sumKm = 0;
  let sumMin = 0;
  let sumKm2 = 0;
  let sumMin2 = 0;
  let sumKmMin = 0;
  let sumY = 0;
  let sumKmY = 0;
  let sumMinY = 0;

  for (const obs of observations) {
    const km = obs.distanceKm;
    const min = obs.durationMin;
    const y = obs.quotedFare;

    sumKm += km;
    sumMin += min;
    sumKm2 += km * km;
    sumMin2 += min * min;
    sumKmMin += km * min;
    sumY += y;
    sumKmY += km * y;
    sumMinY += min * y;
  }

  const XTX = [
    [sum1, sumKm, sumMin],
    [sumKm, sumKm2, sumKmMin],
    [sumMin, sumKmMin, sumMin2],
  ];

  const XTY = [sumY, sumKmY, sumMinY];

  const [intercept, a, b] = solve3x3Gaussian(XTX, XTY);

  // Compute error metrics MAE and MAPE
  let sumAbsErr = 0;
  let sumPctErr = 0;

  for (const obs of observations) {
    const predicted = intercept + a * obs.distanceKm + b * obs.durationMin;
    const absErr = Math.abs(obs.quotedFare - predicted);
    sumAbsErr += absErr;
    if (obs.quotedFare > 0) {
      sumPctErr += (absErr / obs.quotedFare) * 100;
    }
  }

  const mae = sumAbsErr / n;
  const mape = sumPctErr / n;

  return {
    n,
    intercept,
    a,
    b,
    mae,
    mape,
  };
}
