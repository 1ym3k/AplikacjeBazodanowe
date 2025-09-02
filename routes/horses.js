const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { calculateBreed, updateDescendantBreeds } = require('../utils/horseUtils');
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
  if ((!mother_id || !father_id) && !breed) {
    return res.status(400).json({ error: 'Rasa jest wymagana, jeśli nie podano obu rodziców' });
  }
  if (birth_date && isNaN(Date.parse(birth_date))) {
    return res.status(400).json({ error: 'Niepoprawny format daty urodzenia' });
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

    let finalBreed = breed;
    if (mother_id && father_id) {
      const parents = await db('horses').whereIn('id', [mother_id, father_id]).select('id', 'breed');
      const motherBreed = parents.find(p => p.id === mother_id)?.breed;
      const fatherBreed = parents.find(p => p.id === father_id)?.breed;
      finalBreed = calculateBreed(motherBreed, fatherBreed) || breed || 'xo';
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

    if (updates.gender && updates.gender !== currentHorse.gender && updates.gender !== 'gelding' && await checkIfUsed('horses', 'mother_id', id) || await checkIfUsed('horses', 'father_id', id)) {
      return res.status(400).json({ error: 'Koń z potomstwem może mieć zmienioną płeć tylko na wałacha (gelding)' });
    }

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

    if ((updates.birth_year || updates.birth_date) && (finalData.mother_id || finalData.father_id)) {
      const parents = await db('horses').whereIn('id', [finalData.mother_id, finalData.father_id]).select('birth_year', 'birth_date');
      const mother = parents.find(p => p.id === finalData.mother_id) || {};
      const father = parents.find(p => p.id === finalData.father_id) || {};

      const horseBirthDate = new Date(finalData.birth_date);
      const motherBirthDate = new Date(mother.birth_date);
      const fatherBirthDate = new Date(father.birth_date);

      if (mother.birth_date && horseBirthDate <= motherBirthDate) {
        return res.status(400).json({ error: 'Matka musi być starsza od konia' });
      }
      if (father.birth_date && horseBirthDate <= fatherBirthDate) {
        return res.status(400).json({ error: 'Ojciec musi być starszy od konia' });
      }
    }

    let finalBreed = updates.breed;
    const newMotherId = updates.mother_id || currentHorse.mother_id;
    const newFatherId = updates.father_id || currentHorse.father_id;

    if (newMotherId && newFatherId) {
      const parents = await db('horses').whereIn('id', [newMotherId, newFatherId]).select('id', 'breed');
      const motherBreed = parents.find(p => p.id === newMotherId)?.breed;
      const fatherBreed = parents.find(p => p.id === newFatherId)?.breed;
      finalBreed = calculateBreed(motherBreed, fatherBreed);
    }
    if (finalBreed) {
      updates.breed = finalBreed;
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

    res.status(204).send();
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

    let query = db('horses').where({ mother_id: req.params.id }).orWhere({ father_id: req.params.id });

    if (gender) query = query.where({ gender });
    if (breeder_id) query = query.where({ breeder_id });

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