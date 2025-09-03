const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { calculateBreed, updateDescendantBreeds, getPossibleBreeds, getPedigree, renderPedigree } = require('../utils/horseUtils');
const { recordExists, checkIfUsed, getRecordById } = require('../utils/dbUtils');

// Pobieranie wszystkich koni
router.get('/', async (req, res) => {
  const { gender } = req.query;
  try {
    let query = db('horses').select('*');
    if (gender) {
      query = query.where({ gender });
    }
    const horses = await query;
    res.json(horses);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas pobierania koni' });
  }
});

// Pobieranie konia po ID
router.get('/:id', async (req, res) => {
  try {
    const horse = await getRecordById('horses', req.params.id);
    if (!horse) {
      return res.status(404).json({ error: 'Koń nie znaleziony' });
    }
    res.json(horse);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas pobierania konia' });
  }
});

// Dodawanie konia
router.post('/', async (req, res) => {
  const { name, breed, birth_year, birth_date, gender, mother_id, father_id, breeder_id, color } = req.body;

  if (!name || !gender || !color) {
    return res.status(400).json({ error: 'Nazwa, płeć i kolor są wymagane' });
  }
  if (birth_date && isNaN(Date.parse(birth_date))) {
    return res.status(400).json({ error: 'Niepoprawny format daty urodzenia' });
  }
  const validGenders = ['mare', 'stallion', 'gelding'];
  if (!validGenders.includes(gender)) {
    return res.status(400).json({ error: 'Płeć musi być jedną z: mare, stallion, gelding' });
  }

  try {
    if (mother_id) {
      const mother = await getRecordById('horses', mother_id);
      if (!mother || mother.gender !== 'mare') return res.status(400).json({ error: 'Matka musi być klaczą (mare)' });
    }
    if (father_id) {
      const father = await getRecordById('horses', father_id);
      if (!father || father.gender !== 'stallion') return res.status(400).json({ error: 'Ojciec musi być ogierem (stallion)' });
    }
    if (breeder_id && !await recordExists('breeders', breeder_id)) {
      return res.status(400).json({ error: 'Hodowca nie istnieje' });
    }

    //Walidacja wieku rodziców
    if (birth_year || birth_date) {
      const horseBirthYear = birth_year ? parseInt(birth_year) : new Date(birth_date).getFullYear();

      if (mother_id) {
        const mother = await getRecordById('horses', mother_id);
        const motherBirthYear = mother.birth_year ? parseInt(mother.birth_year) : new Date(mother.birth_date).getFullYear();
        if (horseBirthYear - motherBirthYear < 2) {
          return res.status(400).json({ error: 'Matka musi być starsza o co najmniej 2 lata.' });
        }
      }

      if (father_id) {
        const father = await getRecordById('horses', father_id);
        const fatherBirthYear = father.birth_year ? parseInt(father.birth_year) : new Date(father.birth_date).getFullYear();
        if (horseBirthYear - fatherBirthYear < 2) {
          return res.status(400).json({ error: 'Ojciec musi być starszy o co najmniej 2 lata.' });
        }
      }
    }

    let finalBreed = breed;

    const newMotherId = mother_id;
    const newFatherId = father_id;

    if (newMotherId && newFatherId) {
      // Obaj rodzice znani -> rasa zawsze liczona automatycznie
      const parents = await db('horses')
        .whereIn('id', [newMotherId, newFatherId])
        .select('id', 'breed');

      const motherBreed = parents.find(p => p.id === newMotherId)?.breed;
      const fatherBreed = parents.find(p => p.id === newFatherId)?.breed;

      finalBreed = calculateBreed(motherBreed, fatherBreed);
    }
    else if (newMotherId || newFatherId) {
      const parentIds = [newMotherId, newFatherId].filter(Boolean).map(id => parseInt(id, 10)); // Konwersja na liczbę
      console.log('ID rodziców:', parentIds);

      const parents = await db('horses')
        .whereIn('id', parentIds)
        .select('id', 'breed');
      console.log('Rodzice pobrani z bazy:', JSON.stringify(parents, null, 2));

      const motherBreed = parents.find(p => p.id === parseInt(newMotherId, 10))?.breed || null;
      const fatherBreed = parents.find(p => p.id === parseInt(newFatherId, 10))?.breed || null;
      console.log('Rasy:', { motherBreed, fatherBreed, requested: breed });

      const allowedBreeds = getPossibleBreeds(motherBreed, fatherBreed);
      console.log('Dozwolone rasy:', allowedBreeds);

      if (breed && !allowedBreeds.includes(breed)) {
        return res.status(400).json({
          error: `Nie można ustawić tej rasy. Dozwolone: ${allowedBreeds.join(', ')}`
        });
      }
      finalBreed = breed || allowedBreeds[0] || 'xo';
    } else {
      // Brak rodziców
      finalBreed = breed || 'xo';
    }

    const [newHorse] = await db('horses')
      .insert({ name, breed: finalBreed, birth_year, birth_date, gender, mother_id, father_id, breeder_id, color })
      .returning('*');

    res.status(201).json(newHorse);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas dodawania konia: ' + error.message });
  }
});

// Edycja konia
router.put('/:id', async (req, res) => {
  const updates = req.body;
  const { id } = req.params;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Brak danych do aktualizacji' });
  }

  try {
    const currentHorse = await getRecordById('horses', id);
    if (!currentHorse) {
      return res.status(404).json({ error: 'Koń nie znaleziony' });
    }

    // Płeć
    if (updates.gender && updates.gender !== currentHorse.gender && updates.gender !== 'gelding' && await checkIfUsed('horses', 'mother_id', id) || await checkIfUsed('horses', 'father_id', id)) {
      return res.status(400).json({ error: 'Koń z potomstwem może mieć zmienioną płeć tylko na wałacha (gelding)' });
    }

    // Rodzice
    if (updates.mother_id) {
      const mother = await getRecordById('horses', updates.mother_id);
      if (!mother || mother.gender !== 'mare') return res.status(400).json({ error: 'Matka musi być klaczą (mare)' });
    }
    if (updates.father_id) {
      const father = await getRecordById('horses', updates.father_id);
      if (!father || father.gender !== 'stallion') return res.status(400).json({ error: 'Ojciec musi być ogierem (stallion)' });
    }
    if (updates.breeder_id && !await recordExists('breeders', updates.breeder_id)) {
      return res.status(400).json({ error: 'Hodowca nie istnieje' });
    }

    const finalData = { ...currentHorse, ...updates };

    // Walidacja dat urodzenia
    // Zaktualizowana walidacja wieku rodziców: muszą być starsi o co najmniej 2 lata
    if (finalData.birth_year || finalData.birth_date) {
      const horseBirthYear = finalData.birth_year ? parseInt(finalData.birth_year) : new Date(finalData.birth_date).getFullYear();

      if (finalData.mother_id) {
        const mother = await getRecordById('horses', finalData.mother_id);
        const motherBirthYear = mother.birth_year ? parseInt(mother.birth_year) : new Date(mother.birth_date).getFullYear();
        if (horseBirthYear - motherBirthYear < 2) {
          return res.status(400).json({ error: 'Matka musi być starsza o co najmniej 2 lata.' });
        }
      }

      if (finalData.father_id) {
        const father = await getRecordById('horses', finalData.father_id);
        const fatherBirthYear = father.birth_year ? parseInt(father.birth_year) : new Date(father.birth_date).getFullYear();
        if (horseBirthYear - fatherBirthYear < 2) {
          return res.status(400).json({ error: 'Ojciec musi być starszy o co najmniej 2 lata.' });
        }
      }
    }

    // Walidacja rasy względem rodziców
    const newMotherId = updates.mother_id || currentHorse.mother_id;
    const newFatherId = updates.father_id || currentHorse.father_id;

    if (updates.breed) {
      // Użytkownik chce zmienić rasę ręcznie
      if (newMotherId || newFatherId) {
        const parents = await db('horses')
          .whereIn('id', [newMotherId, newFatherId])
          .select('id', 'breed');

        const motherBreed = parents.find(p => p.id === newMotherId)?.breed;
        const fatherBreed = parents.find(p => p.id === newFatherId)?.breed;

        const allowedBreeds = getPossibleBreeds(motherBreed, fatherBreed);

        if (!allowedBreeds.includes(updates.breed)) {
          return res.status(400).json({
            error: `Nie można ustawić tej rasy. Dozwolone: ${allowedBreeds.join(', ')}`
          });
        }
      }
    }

    // Jeśli podano obu rodziców -> rasa zawsze liczona automatycznie
    if (newMotherId && newFatherId) {
      const parents = await db('horses').whereIn('id', [newMotherId, newFatherId]).select('id', 'breed');
      const motherBreed = parents.find(p => p.id === newMotherId)?.breed;
      const fatherBreed = parents.find(p => p.id === newFatherId)?.breed;
      updates.breed = calculateBreed(motherBreed, fatherBreed);
    }

    const [updatedHorse] = await db('horses').where({ id }).update(updates).returning('*');

    if (currentHorse.breed !== updatedHorse.breed) {
      await updateDescendantBreeds(id);
    }

    res.json(updatedHorse);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas edycji konia: ' + error.message });
  }
});

// Usuwanie konia
router.delete('/:id', async (req, res) => {
  try {
    if (await checkIfUsed('horses', 'mother_id', req.params.id) || await checkIfUsed('horses', 'father_id', req.params.id)) {
      return res.status(400).json({ error: 'Nie można usunąć konia, który ma potomstwo.' });
    }

    const deleted = await db('horses').where({ id: req.params.id }).del();
    if (deleted === 0) {
      return res.status(404).json({ error: 'Koń nie znaleziony' });
    }

    res.status(200).json({ message: `Usunięto konia ${req.params.id}` });
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas usuwania konia' });
  }
});

// Pobieranie rodowodu (JSON)
router.get('/:id/pedigree', async (req, res) => {
  const { depth = 2 } = req.query;
  try {
    const horse = await getRecordById('horses', req.params.id);
    if (!horse) return res.status(404).json({ error: 'Koń nie znaleziony' });
    const pedigree = await getPedigree(horse.id, parseInt(depth));
    res.json(pedigree);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas pobierania rodowodu: ' + error.message });
  }
});

// Pobieranie potomstwa
router.get('/:id/offspring', async (req, res) => {
  const { gender, breeder_id } = req.query;
  try {
    const horse = await getRecordById('horses', req.params.id);
    if (!horse) return res.status(404).json({ error: 'Koń nie znaleziony' });

    let query = db('horses').where(function () {
      this.where({ mother_id: req.params.id }).orWhere({ father_id: req.params.id });
    });

    if (gender) query = query.andWhere({ gender });
    if (breeder_id) query = query.andWhere({ breeder_id });

    const offspring = await query.select('*');
    res.json(offspring);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas pobierania potomstwa: ' + error.message });
  }
});

// Pobieranie rodowodu w HTML
router.get('/:id/pedigree/html', async (req, res) => {
  const { depth = 2 } = req.query;
  try {
    const horse = await getRecordById('horses', req.params.id);
    if (!horse) return res.status(404).json({ error: 'Koń nie znaleziony' });
    const pedigree = await getPedigree(horse.id, parseInt(depth));
    const html = renderPedigree(pedigree);
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas generowania wizualizacji: ' + error.message });
  }
});

module.exports = router;