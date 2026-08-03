/**
 * Management data layer — advisors, overlays, inspectors (tasks 9.6, 11.2,
 * 11.3, 11.4). These produce the real-data datasets the Phaser views render,
 * reading from the sim systems (ratings, finance, economy, services, water,
 * safety, trade). Self-contained and unit-testable.
 */
import { computeServiceCoverage } from './services';
import { type CityStats, computeTargets } from './ratings';

export interface SimSnapshot {
  population: number;
  treasury: number;
  taxRate: number;
  wageRate: number;
  hasReligion: boolean;
  hasEntertainment: boolean;
  hasEducation: boolean;
  hasHealth: boolean;
  hasWater: boolean;
  hasFood: boolean;
  jobs: number;
  employed: number;
  welfare: Record<string, number>;
  godWorship: Record<string, number>;
  doctorCoverage: number;
  educationCoverage: number;
  entertainmentCoverage: number;
}

export interface AdvisorDataset {
  name: string;
  data: Record<string, number>;
}

export function toCityStats(s: SimSnapshot): CityStats {
  return {
    population: s.population, treasury: s.treasury, taxRate: s.taxRate,
    hasReligion: s.hasReligion, hasEntertainment: s.hasEntertainment, hasEducation: s.hasEducation,
    hasHealth: s.hasHealth, hasWater: s.hasWater, hasFood: s.hasFood,
  };
}

/** Produce the deliverable advisor datasets from a live sim snapshot. */
export function advisorsFrom(s: SimSnapshot): AdvisorDataset[] {
  const targets = computeTargets(toCityStats(s));
  const services = computeServiceCoverage({
    doctorCoverage: s.doctorCoverage, educationCoverage: s.educationCoverage,
    entertainmentCoverage: s.entertainmentCoverage, godWorship: s.godWorship,
  });
  return [
    { name: 'population', data: { population: s.population } },
    { name: 'labor', data: { employed: s.employed, jobs: s.jobs, unemployment: Math.max(0, s.jobs - s.employed) } },
    { name: 'finance', data: { treasury: s.treasury, taxRate: s.taxRate, wageRate: s.wageRate } },
    { name: 'ratings', data: { culture: targets.culture, prosperity: targets.prosperity, stability: targets.stability, favor: targets.favor } },
    { name: 'religion', data: { ...s.godWorship } },
    { name: 'health', data: { wellness: Math.round(services.health * 100) } },
    { name: 'education', data: { literacy: Math.round(services.literacy * 100) } },
    { name: 'entertainment', data: { coverage: Math.round(services.entertainment * 100) } },
  ];
}

/** Per-tile overlay values keyed by name (task 11.4). */
export function overlaysFrom(
  width: number,
  height: number,
  perTile: (x: number, y: number) => Partial<Record<string, number>>,
): Record<string, number[][]> {
  const acc: Record<string, number[][]> = {};
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = perTile(x, y);
      for (const [k, val] of Object.entries(v)) {
        if (!acc[k]) acc[k] = Array.from({ length: height }, () => new Array(width).fill(0));
        acc[k][y][x] = val ?? 0;
      }
    }
  }
  return acc;
}

/** Residence/production/storage/market walker inspector datasets (task 11.2). */
export function residenceInspection(
  population: number, capacity: number, residentClass: string, services: string[], goods: Record<string, number>,
): Record<string, unknown> {
  return { population, capacity, residentClass, services, goods };
}

export function productionInspection(
  inputs: Record<string, number>, output: Record<string, number>, status: string,
): Record<string, unknown> {
  return { inputs, output, status };
}

export function storageInspection(stock: Record<string, number>, usedSlots: number, capacity: number): Record<string, unknown> {
  return { stock, usedSlots, capacity };
}

export function marketInspection(inventory: Record<string, number>, buyerRadius: number): Record<string, unknown> {
  return { inventory, buyerRadius };
}

export function walkerInspection(id: number, x: number, y: number, status: string, stepsUsed: number, maxSteps: number): Record<string, unknown> {
  return { id, x, y, status, stepsUsed, maxSteps };
}
