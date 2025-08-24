const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// Pobieranie wszystkich koni
router.get('/', async (req, res) => {
  const { gender } = req.query;
  let query = db('horses').select('*');
  if (gender) query = query.where({ gender });
  const horses = await query;
  res.json(horses);
});

// Pobieranie konia po ID
router.get('/:id', async (req, res) => {
  try {
    const horse = await db('horses').where({ id: req.params.id }).first();
    if (!horse) return res.status(404).json({ error: 'Koń nie znaleziony' });
    res.json(horse);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas pobierania konia' });
  }
});

// Dodawanie konia
router.post('/', async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ error: 'Brak danych w treści żądania' });
  }

  const { name, breed, birth_year, birth_date, gender, mother_id, father_id, breeder_id, color } = req.body;

  // Walidacja danych
  if (!name || !gender || !color) {
    return res.status(400).json({ error: 'Nazwa, płeć i kolor są wymagane' });
  }
  // Rasa jest wymagana tylko, jeśli nie podano obu rodziców
  if (!mother_id || !father_id) {
    if (!breed) {
      return res.status(400).json({ error: 'Rasa jest wymagana, jeśli nie podano obu rodziców' });
    }
    if (!['oo', 'xx', 'xo', 'xxoo'].includes(breed)) {
      return res.status(400).json({ error: 'Niepoprawna rasa (dozwolone: oo, xx, xo, xxoo)' });
    }
  }
  if (birth_date && isNaN(Date.parse(birth_date))) {
    return res.status(400).json({ error: 'Niepoprawny format daty urodzenia' });
  }

  try {
    // Walidacja rodziców
    if (mother_id) {
      const mother = await db('horses').where({ id: mother_id, gender: 'mare' }).first();
      if (!mother) return res.status(400).json({ error: 'Matka musi być klaczą (mare)' });
    }
    if (father_id) {
      const father = await db('horses').where({ id: father_id, gender: 'stallion' }).first();
      if (!father) return res.status(400).json({ error: 'Ojciec musi być ogierem (stallion)' });
    }

    // Walidacja hodowcy
    if (breeder_id) {
      const breeder = await db('breeders').where({ id: breeder_id }).first();
      if (!breeder) return res.status(400).json({ error: 'Hodowca nie istnieje' });
    }

    // Wyliczanie rasy na podstawie rodziców (jeśli podano obu)
    let finalBreed = breed;
    if (mother_id && father_id) {
      const parents = await db('horses').whereIn('id', [mother_id, father_id]).select('id', 'breed');
      const motherBreed = parents.find(p => p.id === mother_id)?.breed;
      const fatherBreed = parents.find(p => p.id === father_id)?.breed;
      finalBreed = calculateBreed(motherBreed, fatherBreed) || breed || 'xo';
    }

    const [newHorse] = await db('horses')
      .insert({
        name,
        breed: finalBreed,
        birth_year,
        birth_date,
        gender,
        mother_id,
        father_id,
        breeder_id,
        color
      })
      .returning('*');

    res.status(201).json(newHorse);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas dodawania konia: ' + error.message });
  }
});

// Edycja konia
router.put('/:id', async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ error: 'Brak danych w treści żądania' });
  }

  const { name, breed, birth_year, birth_date, gender, mother_id, father_id, breeder_id, color } = req.body;

  // Walidacja danych
  if (!name || !breed || !gender || !color) {
    return res.status(400).json({ error: 'Nazwa, rasa, płeć i kolor są wymagane' });
  }
  if (!['oo', 'xx', 'xo', 'xxoo'].includes(breed)) {
    return res.status(400).json({ error: 'Niepoprawna rasa (dozwolone: oo, xx, xo, xxoo)' });
  }
  if (!['mare', 'stallion', 'gelding'].includes(gender)) {
    return res.status(400).json({ error: 'Niepoprawna płeć (dozwolone: mare, stallion, gelding)' });
  }
  if (birth_date && isNaN(Date.parse(birth_date))) {
    return res.status(400).json({ error: 'Niepoprawny format daty urodzenia' });
  }

  //walidacja zgodności roku i daty urodzenia
  if (birth_date && birth_year) {
    const dateYear = new Date(birth_date).getFullYear();
    if (dateYear != birth_year) {
      return res.status(400).json({ 
        error: 'Rok urodzenia w dacie musi być zgodny z podanym rokiem urodzenia',
        details: {
          birth_year_provided: birth_year,
          birth_year_in_date: dateYear
        }
      });
    }
  }

  try {
    // Pobierz aktualnego konia
    const currentHorse = await db('horses').where({ id: req.params.id }).first();
    if (!currentHorse) return res.status(404).json({ error: 'Koń nie znaleziony' });

    // Walidacja zmiany płci
    const hasOffspring = await db('horses')
      .where({ mother_id: req.params.id })
      .orWhere({ father_id: req.params.id })
      .first();
    if (hasOffspring && gender !== currentHorse.gender && gender !== 'gelding') {
      return res.status(400).json({ error: 'Koń z potomstwem może mieć zmienioną płeć tylko na wałacha (gelding)' });
    }

    // Walidacja rodziców
    if (mother_id) {
      const mother = await db('horses').where({ id: mother_id, gender: 'mare' }).first();
      if (!mother) return res.status(400).json({ error: 'Matka musi być klaczą (mare)' });
    }
    if (father_id) {
      const father = await db('horses').where({ id: father_id, gender: 'stallion' }).first();
      if (!father) return res.status(400).json({ error: 'Ojciec musi być ogierem (stallion)' });
    }

    // Walidacja hodowcy
    if (breeder_id) {
      const breeder = await db('breeders').where({ id: breeder_id }).first();
      if (!breeder) return res.status(400).json({ error: 'Hodowca nie istnieje' });
    }

    //Sprawdzenie czy rodzice są starsi od konia
    if (mother_id || father_id) {
      const parents = await db('horses').whereIn('id', [mother_id, father_id]).select('id', 'birth_year', 'birth_date');
      const motherBirthYear = parents.find(p => p.id === mother_id)?.birth_year;
      const motherBirthDate = parents.find(p => p.id === mother_id)?.birth_date;
      const fatherBirthYear = parents.find(p => p.id === father_id)?.birth_year;
      const fatherBirthDate = parents.find(p => p.id === father_id)?.birth_date;

      if (motherBirthYear && (birth_year < motherBirthYear || (birth_year === motherBirthYear && birth_date < motherBirthDate))) {
        return res.status(400).json({ error: 'Matka musi być starsza od konia' });
      }
      if (fatherBirthYear && (birth_year < fatherBirthYear || (birth_year === fatherBirthYear && birth_date < fatherBirthDate))) {
        return res.status(400).json({ error: 'Ojciec musi być starszy od konia' });
      }
    }

    // Wyliczanie rasy na podstawie rodziców (jeśli podano obu)
    let finalBreed = breed;
    if (mother_id && father_id) {
      const parents = await db('horses').whereIn('id', [mother_id, father_id]).select('id', 'breed');
      const motherBreed = parents.find(p => p.id === mother_id)?.breed;
      const fatherBreed = parents.find(p => p.id === father_id)?.breed;
      finalBreed = calculateBreed(motherBreed, fatherBreed) || breed;
    }

    // Aktualizacja konia
    const [updatedHorse] = await db('horses')
      .where({ id: req.params.id })
      .update({
        name,
        breed: finalBreed,
        birth_year,
        birth_date,
        gender,
        mother_id,
        father_id,
        breeder_id,
        color
      })
      .returning('*');

    if (!updatedHorse) {
      return res.status(404).json({ error: 'Koń nie znaleziony' });
    }

    // Aktualizacja ras potomków, jeśli rasa się zmieniła
    if (currentHorse.breed !== finalBreed) {
      await updateDescendantBreeds(req.params.id);
    }

    res.json(updatedHorse);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas edycji konia: ' + error.message });
  }
});

// Usuwanie konia
router.delete('/:id', async (req, res) => {
  try {
    console.log(`Rozpoczęto usuwanie konia ID: ${req.params.id}`);

    // Sprawdzanie czy koń jest rodzicem innych koni
    const children = await db('horses')
      .where({ mother_id: req.params.id })
      .orWhere({ father_id: req.params.id })
      .select('id', 'name');
    
    if (children.length > 0) {
      const childList = children.map(c => `ID: ${c.id} (${c.name})`).join(', ');
      console.warn(`Nie można usunąć konia ID: ${req.params.id} - posiada potomstwo: ${childList}`);
      return res.status(400).json({ 
        error: 'Nie można usunąć konia, który ma potomstwo. Najpierw usuń jego dzieci.',
        children: children.map(c => ({ id: c.id, name: c.name }))
      });
    }

    // Pobierz dane konia przed usunięciem (do logów)
    const horseToDelete = await db('horses')
      .where({ id: req.params.id })
      .select('name', 'breed', 'gender')
      .first();

    const deleted = await db('horses').where({ id: req.params.id }).del();
    
    if (deleted === 0) {
      console.warn(`Koń ID: ${req.params.id} nie znaleziony`);
      return res.status(404).json({ error: 'Koń nie znaleziony' });
    }

    console.log(`Pomyślnie usunięto konia: ${horseToDelete.name} (ID: ${req.params.id}, Rasa: ${horseToDelete.breed}, Płeć: ${horseToDelete.gender})`);
    res.status(204).send();

  } catch (error) {
    console.error(`BŁĄD podczas usuwania konia ID: ${req.params.id}:`, error.message);
    res.status(500).json({ 
      error: 'Błąd podczas usuwania konia',
      details: error.message
    });
  }
});

// Pobieranie rodowodu (JSON)
router.get('/:id/pedigree', async (req, res) => {
  const { depth = 2 } = req.query;
  try {
    const horse = await db('horses').where({ id: req.params.id }).first();
    if (!horse) return res.status(404).json({ error: 'Koń nie znaleziony' });

    const pedigree = await getPedigree(horse.id, parseInt(depth));
    res.json(pedigree);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas pobierania rodowodu: ' + error.message });
  }
});

// Pobieranie rodowodu (HTML)
router.get('/:id/pedigree/html', async (req, res) => {
  const { depth = 2 } = req.query;
  try {
    const horse = await db('horses').where({ id: req.params.id }).first();
    if (!horse) return res.status(404).json({ error: 'Koń nie znaleziony' });

    const pedigree = await getPedigree(horse.id, parseInt(depth));
    const html = renderPedigree(pedigree);
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas generowania wizualizacji: ' + error.message });
  }
});

// Pobieranie potomstwa
router.get('/:id/offspring', async (req, res) => {
  const { gender, breeder_id } = req.query;
  try {
    let query = db('horses').where({ mother_id: req.params.id }).orWhere({ father_id: req.params.id });

    if (gender) query = query.where({ gender });
    if (breeder_id) query = query.where({ breeder_id });

    const offspring = await query.select('*');
    res.json(offspring);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas pobierania potomstwa: ' + error.message });
  }
});

// Funkcja do wyliczania rasy
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

// Funkcja do rekurencyjnej aktualizacji ras potomków
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
        await updateDescendantBreeds(child.id); // Rekurencyjne wywołanie bez db
      }
    }
  }
}

// Funkcja do pobierania rodowodu
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

// Funkcja do renderowania rodowodu w HTML
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

module.exports = router;