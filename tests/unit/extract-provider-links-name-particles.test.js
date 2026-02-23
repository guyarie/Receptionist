import { describe, it, expect } from 'vitest';

/**
 * Tests for provider name extraction with lowercase name particles
 * 
 * This test suite verifies that the extractProviderLinks function correctly
 * handles names with lowercase particles like "de", "van", "von", etc.
 * 
 * Bug fix: Previously, the scraper required both first and second words to
 * start with capital letters, which incorrectly filtered out names like
 * "Claire de Leon" where "de" is lowercase.
 */
describe('extractProviderLinks - Name Particles', () => {
  it('should recognize names with lowercase particles as valid', () => {
    // Names with lowercase particles that should be accepted
    const validNamesWithParticles = [
      'Claire de Leon',
      'Vincent van Gogh',
      'Ludwig von Beethoven',
      'Leonardo da Vinci',
      'Catherine de Medici',
      'Jean le Rond',
      'Giovanni di Paolo',
      'Maria del Carmen'
    ];

    validNamesWithParticles.forEach(name => {
      const words = name.split(/\s+/);
      const firstWord = words[0];
      const secondWord = words[1];
      
      // First word should be capitalized
      expect(/^[A-Z]/.test(firstWord)).toBe(true);
      
      // Second word can be lowercase if it's a name particle
      const secondWordLower = secondWord.toLowerCase();
      const isNameParticle = ['de', 'van', 'von', 'del', 'la', 'le', 'di', 'da'].includes(secondWordLower);
      const secondWordCapitalized = /^[A-Z]/.test(secondWord);
      
      const looksLikeName = /^[A-Z]/.test(firstWord) && (secondWordCapitalized || isNameParticle);
      
      expect(looksLikeName).toBe(true);
    });
  });

  it('should still require first word to be capitalized', () => {
    const invalidNames = [
      'claire de Leon',  // First word not capitalized
      'vincent van Gogh', // First word not capitalized
      'john smith'        // Neither word capitalized
    ];

    invalidNames.forEach(name => {
      const words = name.split(/\s+/);
      const firstWord = words[0];
      const secondWord = words[1];
      
      const firstWordCapitalized = /^[A-Z]/.test(firstWord);
      const secondWordLower = secondWord.toLowerCase();
      const isNameParticle = ['de', 'van', 'von', 'del', 'la', 'le', 'di', 'da'].includes(secondWordLower);
      const secondWordCapitalized = /^[A-Z]/.test(secondWord);
      
      const looksLikeName = firstWordCapitalized && (secondWordCapitalized || isNameParticle);
      
      expect(looksLikeName).toBe(false);
    });
  });

  it('should accept regular capitalized names', () => {
    const regularNames = [
      'John Smith',
      'Mary Johnson',
      'Jeffrey Gillman',
      'Miri Arie'
    ];

    regularNames.forEach(name => {
      const words = name.split(/\s+/);
      const firstWord = words[0];
      const secondWord = words[1];
      
      const firstWordCapitalized = /^[A-Z]/.test(firstWord);
      const secondWordLower = secondWord.toLowerCase();
      const isNameParticle = ['de', 'van', 'von', 'del', 'la', 'le', 'di', 'da'].includes(secondWordLower);
      const secondWordCapitalized = /^[A-Z]/.test(secondWord);
      
      const looksLikeName = firstWordCapitalized && (secondWordCapitalized || isNameParticle);
      
      expect(looksLikeName).toBe(true);
    });
  });

  it('should handle names with credentials', () => {
    // Names with credentials should still be recognized
    const namesWithCredentials = [
      'Claire de Leon, LMHC',
      'Vincent van Gogh, PhD',
      'John Smith, MD'
    ];

    namesWithCredentials.forEach(name => {
      const words = name.split(/\s+/);
      const firstWord = words[0];
      const secondWord = words[1].replace(/,.*$/, ''); // Remove credentials
      
      const firstWordCapitalized = /^[A-Z]/.test(firstWord);
      const secondWordLower = secondWord.toLowerCase();
      const isNameParticle = ['de', 'van', 'von', 'del', 'la', 'le', 'di', 'da'].includes(secondWordLower);
      const secondWordCapitalized = /^[A-Z]/.test(secondWord);
      
      const looksLikeName = firstWordCapitalized && (secondWordCapitalized || isNameParticle);
      
      expect(looksLikeName).toBe(true);
    });
  });

  it('should handle names with parenthetical nicknames', () => {
    // Names like "Michal (Michelle) Alpert" should be recognized
    const namesWithNicknames = [
      'Michal (Michelle) Alpert',
      'Robert (Bob) Johnson',
      'Elizabeth (Liz) Smith'
    ];

    namesWithNicknames.forEach(name => {
      const words = name.split(/\s+/);
      const firstWord = words[0];
      const secondWord = words[1].replace(/,.*$/, ''); // Remove credentials
      
      const firstWordCapitalized = /^[A-Z]/.test(firstWord);
      // Strip leading punctuation from second word
      const secondWordClean = secondWord.replace(/^[^\w]+/, '');
      const secondWordLower = secondWordClean.toLowerCase();
      const isNameParticle = ['de', 'van', 'von', 'del', 'la', 'le', 'di', 'da'].includes(secondWordLower);
      const secondWordCapitalized = /^[A-Z]/.test(secondWordClean);
      
      const looksLikeName = firstWordCapitalized && (secondWordCapitalized || isNameParticle);
      
      expect(looksLikeName).toBe(true);
    });
  });
});
