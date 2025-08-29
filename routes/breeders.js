const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { getRecordById, recordExistsByCode, checkIfUsed } = require('../utils/dbUtils');

// Pobieranie wszystkich hodowców
router.get('/', async (req, res) => {
  try {
    const breeders = await db('breeders').select('*');
    res.json(breeders);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas pobierania hodowców' });
  }
});

// Pobieranie hodowcy po ID
router.get('/:id', async (req, res) => {
  try {
    const breeder = await getRecordById('breeders', req.params.id);
    if (!breeder) {
      return res.status(404).json({ error: 'Hodowca nie znaleziony' });
    }
    res.json(breeder);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas pobierania hodowcy' });
  }
});

// Dodawanie hodowcy
router.post('/', async (req, res) => {
  const { name, country_code } = req.body;

  if (!name || !country_code) {
    return res.status(400).json({ error: 'Nazwa hodowcy i kod kraju są wymagane' });
  }

  try {
    if (!await recordExistsByCode('countries', country_code)) {
      return res.status(400).json({ error: 'Kraj o podanym kodzie nie istnieje' });
    }
    const [newBreeder] = await db('breeders')
      .insert({ name, country_code })
      .returning('*');

    res.status(201).json(newBreeder);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas dodawania hodowcy' });
  }
});

// Edycja hodowcy
router.put('/:id', async (req, res) => {
  const updates = req.body;
  const { id } = req.params;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Brak danych do aktualizacji' });
  }

  try {
    const existingBreeder = await getRecordById('breeders', id);
    if (!existingBreeder) {
      return res.status(404).json({ error: 'Hodowca nie znaleziony' });
    }

    if (updates.country_code && !await recordExistsByCode('countries', updates.country_code)) {
      return res.status(400).json({ error: 'Kraj o podanym kodzie nie istnieje' });
    }

    const [updatedBreeder] = await db('breeders')
      .where({ id })
      .update(updates)
      .returning('*');

    res.json(updatedBreeder);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas edycji hodowcy' });
  }
});

// Usuwanie hodowcy
router.delete('/:id', async (req, res) => {
  try {
    if (await checkIfUsed('horses', 'breeder_id', req.params.id)) {
      return res.status(400).json({ error: 'Nie można usunąć hodowcy, który jest przypisany do koni' });
    }

    const deleted = await db('breeders').where({ id: req.params.id }).del();
    if (deleted === 0) {
      return res.status(404).json({ error: 'Hodowca nie znaleziony' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas usuwania hodowcy' });
  }
});

module.exports = router;