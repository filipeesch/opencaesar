/**
 * Walker catalog — service walkers spawned by buildings and how they serve houses.
 */

export interface WalkerDef {
  id: string;
  name: string;
  /** The service this walker provides to houses (keyed into housing requires). */
  service: string;
  /** Buildings that spawn this walker type. */
  spawnedBy: string[];
}

export const WALKERS: Record<string, WalkerDef> = {
  well: { id: 'well', name: 'Water', service: 'well', spawnedBy: ['well'] },
  fountain: { id: 'fountain', name: 'Fountain', service: 'fountain', spawnedBy: ['fountain', 'reservoir'] },
  market: { id: 'market', name: 'Market', service: 'market', spawnedBy: ['market'] },
  engineer: { id: 'engineer', name: 'Engineer', service: 'engineer', spawnedBy: ['engineer_post'] },
  fireman: { id: 'fireman', name: 'Fireman', service: 'fireman', spawnedBy: ['fire_station'] },
  marshal: { id: 'marshal', name: 'Marshal', service: 'marshal', spawnedBy: ['prefecture'] },
  doctor: { id: 'doctor', name: 'Doctor', service: 'clinic', spawnedBy: ['clinic', 'hospital'] },
  teacher: { id: 'teacher', name: 'Teacher', service: 'school', spawnedBy: ['school'] },
  librarian: { id: 'librarian', name: 'Librarian', service: 'library', spawnedBy: ['library'] },
  entertainer: { id: 'entertainer', name: 'Entertainer', service: 'theatre', spawnedBy: ['theatre', 'amphitheatre', 'colosseum'] },
  priest: { id: 'priest', name: 'Priest', service: 'temple', spawnedBy: ['temple', 'grand_temple'] },
  official: { id: 'official', name: 'Official', service: 'forum', spawnedBy: ['forum'] },
  senator: { id: 'senator', name: 'Senator', service: 'senate', spawnedBy: ['senate'] },
};

export function serviceName(service: string): string {
  const found = Object.values(WALKERS).find((w) => w.service === service);
  return found ? found.name : service;
}
