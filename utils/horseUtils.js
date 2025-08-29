const db = require('../db/connection');

/**
 * 
 * @param {string} motherBreed 
 * @param {string} fatherBreed 
 * @returns {string}
 */
function calculateBreed(motherBreed, fatherBreed) {
  if (!motherBreed || !fatherBreed) return 'xo';
  const rules = {
    'oo,oo': 'oo',
    'oo,xo': 'xo',
    'oo,xx': 'xxoo',
    'xx,xx': 'xx',
    'xx,xo': 'xo',
    'xx,xxoo': 'xxoo',
    'xo,oo': 'xo',
    'xxoo,xx': 'xxoo',
    'oo,xxoo': 'xxoo'
  };
  const key1 = `${motherBreed},${fatherBreed}`;
  const key2 = `${fatherBreed},${motherBreed}`;
  return rules[key1] || rules[key2] || 'xo';
} 
//jesli rasa tylko jednego rodzica jest znana to zwraca ta rase, 
// jesli znana rasa tylko jednego rodzica to dodac mozliwosc ustawienia rasy na kazda kompatybilna kombinacja z ta rodzica

/**
 * 
 * @param {number} horseId 
 */
async function updateDescendantBreeds(horseId) {
  const children = await db('horses')
    .where({ mother_id: horseId })
    .orWhere({ father_id: horseId })
    .select('id', 'mother_id', 'father_id');

  for (const child of children) {
    if (child.mother_id && child.father_id) {
      const parents = await db('horses')
        .whereIn('id', [child.mother_id, child.father_id])
        .select('id', 'breed');
      const motherBreed = parents.find(p => p.id === child.mother_id)?.breed;
      const fatherBreed = parents.find(p => p.id === child.father_id)?.breed;
      const newBreed = calculateBreed(motherBreed, fatherBreed);
      if (newBreed) {
        await db('horses').where({ id: child.id }).update({ breed: newBreed });
        await updateDescendantBreeds(child.id);
      }
    }
  }
}

module.exports = {
  calculateBreed,
  updateDescendantBreeds
};