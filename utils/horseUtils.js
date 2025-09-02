const db = require('../db/connection');

/**
 * Oblicza rasę konia na podstawie ras rodziców
 * W przypadku braku danych o rodzicach przyjmuje arbitralnie 'xo'
 * @param {string} motherBreed 
 * @param {string} fatherBreed 
 * @returns {string}
 */
function calculateBreed(motherBreed, fatherBreed) {

  if (!motherBreed && !fatherBreed) {
    return 'xo'; //brak obojga -> arbitralnie xo
  }
  if (motherBreed && !fatherBreed) {
    return motherBreed;
  }
  if (!motherBreed && fatherBreed) {
    return fatherBreed;
  }

  const rules = {
    'oo,oo': 'oo',
    'oo,xo': 'xo',
    'oo,xx': 'xxoo',
    'oo,xxoo': 'xxoo',
    'xx,xx': 'xx',
    'xx,xo': 'xo',
    'xx,xxoo': 'xxoo',
    'xo,xo': 'xo',
    'xo,xxoo': 'xxoo',
    'xxoo,xxoo': 'xxoo'
  };
  const key1 = `${motherBreed},${fatherBreed}`;
  const key2 = `${fatherBreed},${motherBreed}`;
  return rules[key1] || rules[key2] || 'xo';
};

/**
 * Aktualizuje rasy wszystkich potomków konia o podanym ID
 * @param {number} horseId 
 */
async function updateDescendantBreeds(horseId) {
  const children = await db('horses')
    .where({ mother_id: horseId })
    .orWhere({ father_id: horseId })
    .select('id', 'mother_id', 'father_id', 'breed'); 

  for (const child of children) {
    const parentIds = [child.mother_id, child.father_id].filter(Boolean);
    const parents = await db('horses')
      .whereIn('id', parentIds)
      .select('id', 'breed');

    const motherBreed = parents.find(p => p.id === child.mother_id)?.breed || null;
    const fatherBreed = parents.find(p => p.id === child.father_id)?.breed || null;

    let newBreed = child.breed;  

    if (child.mother_id && child.father_id) {
      newBreed = calculateBreed(motherBreed, fatherBreed);
    } 
    else if (child.mother_id || child.father_id)
       {
      const allowedBreeds = getPossibleBreeds(motherBreed, fatherBreed);
      if (!allowedBreeds.includes(child.breed)) {
        newBreed = allowedBreeds[0] || 'xo';  
      }
    }


    if (newBreed && newBreed !== child.breed) {
      await db('horses').where({ id: child.id }).update({ breed: newBreed });
      await updateDescendantBreeds(child.id);
    } else {

      await updateDescendantBreeds(child.id);
    }
  }
}

/**
 * Pobiera rodowód konia do określonej głębokości
 * @param {number} horseId id konia
 * @param {number} depth głębokość rodowodu (0 = tylko koń, 1 = rodzice, 2 = dziadkowie)
 * @returns {Promise<object | null>} Obiekt reprezentujący rodowód konia lub null
 */
async function getPedigree(horseId, depth) {
  if (depth < 0) return null;
  const horse = await db('horses')
    .where({ id: horseId })
    .select('id', 'name', 'breed', 'gender', 'mother_id', 'father_id')
    .first();
  if (!horse) return null;

  const pedigree = { ...horse, mother: null, father: null };
  if (depth > 0) {
    if (horse.mother_id) {
      pedigree.mother = await getPedigree(horse.mother_id, depth - 1);
    }
    if (horse.father_id) {
      pedigree.father = await getPedigree(horse.father_id, depth - 1);
    }
  }
  return pedigree;
}


/**
 * Renderuje rodowód konia jako wizualizację HTML
 * @param {object | null} pedigree obiekt z danymi do rodowodu konia
 * @param {*} level aktualny poziom zagnieżdżenia w rodowodzie
 * @returns {string} String HTML reprezentujący wizualizację rodowodu
 */
function renderPedigree(pedigree, level = 0) {
  if (!pedigree) return '';
  const indent = '  '.repeat(level * 2);
  let html = `
    ${indent}<div style="border: 1px solid #ccc; padding: 10px; margin: 5px; margin-left: ${level * 20}px;">
      ${indent}  <strong>${pedigree.name}</strong> (${pedigree.gender})
      ${indent}  <p>Rasa: ${pedigree.breed}, Płeć: ${pedigree.gender}</p>
  `;
  if (pedigree.mother) {
    html += renderPedigree(pedigree.mother, level + 1);
  }
  if (pedigree.father) {
    html += renderPedigree(pedigree.father, level + 1);
  }
  html += `${indent}</div>`;
  if (level === 0) {
    return `
      <!DOCTYPE html>
      <html lang="pl">
      <head>
        <meta charset="UTF-8">
        <title>Rodowód konia: ${pedigree.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          div { border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>Rodowód konia: ${pedigree.name}</h1>
        ${html}
      </body>
      </html>
    `;
  }
  return html;
}
/**
 * Zwraca możliwe rasy dla potomstwa na podstawie ras rodziców
 * @param {string} motherBreed 
 * @param {string} fatherBreed 
 * @returns {string[]}
 */
function getPossibleBreeds(motherBreed, fatherBreed) {
  const breeds = new Set();

  if (motherBreed && fatherBreed) {
    breeds.add(calculateBreed(motherBreed, fatherBreed));
  } else if (motherBreed || fatherBreed) {
    const knownBreed = motherBreed || fatherBreed;
    const possibleBreeds = {
      'oo': ['oo', 'xo', 'xxoo'],
      'xx': ['xx', 'xo', 'xxoo'],
      'xo': ['xo', 'xxoo'],
      'xxoo': ['xxoo']
    };
    if (possibleBreeds[knownBreed]) {
      possibleBreeds[knownBreed].forEach(breed => breeds.add(breed));
    } else {
      breeds.add('xo');
    }
  } else {
    breeds.add('oo');
    breeds.add('xx');
    breeds.add('xo');
    breeds.add('xxoo');
  }
  return Array.from(breeds);
}

module.exports = {
  calculateBreed,
  updateDescendantBreeds,
  getPedigree,
  renderPedigree,
  getPossibleBreeds
};