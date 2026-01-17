/**
 * Tales of Tasern Visual Theme
 * Medieval D&D fantasy aesthetic - inherited from Tasern 3
 */

export const TASERN_COLORS = {
  // Primary Palette
  bronze: '#8B6914',
  gold: '#D4AF37',
  parchment: '#F4E4C1',
  leather: '#5C4033',
  stone: '#6B7280',
  void: '#0a0a0f',

  // D&D Official Colors
  dndRed: '#7A200D',
  dndParchment: '#FDF1DC',
  dndBronze: '#CD7F32',
  dndGold: '#FFD700',
  dndCrimson: '#DC143C',
  dndForest: '#228B22',
  dndMidnight: '#191970',
  dndArcane: '#9932CC',

  // Accent Colors
  red: '#8B0000',
  blue: '#1E3A8A',
  green: '#065F46',
  purple: '#5B21B6',
  white: '#F9FAFB',
  black: '#111827',

  // Cosmic (Tasern-specific)
  tear: '#ff4500',
  castle: '#ffd700',
  whiteMoon: '#e8f4f8',
  greenMoon: '#2d5016',
  blueMoon: '#1e3a5f',
} as const;

export const TASERN_GRADIENTS = {
  parchmentTexture: 'linear-gradient(45deg, #FDF1DC 25%, #F5E6CC 25%, #F5E6CC 50%, #FDF1DC 50%, #FDF1DC 75%, #F5E6CC 75%)',
  cardBackground: 'linear-gradient(135deg, #3a2a1a 0%, #1a1410 100%)',
  voidGradient: 'linear-gradient(135deg, #0a0a0f 0%, #1a1520 50%, #0a0a0f 100%)',
  goldShimmer: 'linear-gradient(45deg, transparent 30%, rgba(212, 175, 55, 0.1) 50%, transparent 70%)',
} as const;

export const TASERN_SHADOWS = {
  soft: '0 2px 8px rgba(0, 0, 0, 0.15)',
  medium: '0 4px 16px rgba(0, 0, 0, 0.25)',
  strong: '0 8px 32px rgba(0, 0, 0, 0.4)',
  glowGold: '0 0 20px rgba(212, 175, 55, 0.4)',
  glowTear: '0 0 30px rgba(255, 69, 0, 0.3)',
  glowArcane: '0 0 20px rgba(153, 50, 204, 0.6)',
  textGold: '0 0 10px rgba(212, 175, 55, 0.8)',
} as const;

export const TASERN_TYPOGRAPHY = {
  heading: "'Cinzel', serif",
  body: "'Crimson Text', serif",
  accent: "'Uncial Antiqua', cursive",
  monospace: "'JetBrains Mono', monospace",
} as const;

// Faction colors for character creation
export const FACTION_COLORS = {
  elves: { primary: '#065F46', secondary: '#10B981' },
  dwarves: { primary: '#78716C', secondary: '#A8A29E' },
  durgan: { primary: '#D4AF37', secondary: '#FCD34D' },
  pirates: { primary: '#1E3A8A', secondary: '#3B82F6' },
  igypt: { primary: '#92400E', secondary: '#F59E0B' },
  dragons: { primary: '#7A200D', secondary: '#DC2626' },
  orks: { primary: '#1F2937', secondary: '#6B7280' },
  druids: { primary: '#2d5016', secondary: '#84CC16' },
} as const;
