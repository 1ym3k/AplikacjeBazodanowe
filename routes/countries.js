const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// Pobieranie wszystkich krajów
router.get('/', async (req, res) => {
  try {
    const countries = await db('countries').select('*');
    res.json(countries);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas pobierania krajów' });
  }
});

// Pobieranie kraju po kodzie ISO
router.get('/:code', async (req, res) => {
  try {
    const country = await db('countries').where({ code: req.params.code }).first();
    if (!country) {
      return res.status(404).json({ error: 'Kraj nie znaleziony' });
    }
    res.json(country);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas pobierania kraju' });
  }
});

// Dodawanie kraju z walidacją
router.post('/', async (req, res) => {
  const { code, name } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: 'Kod ISO i nazwa kraju są wymagane' });
  }
  if (!/^[A-Z]{2}$/.test(code)) {
    return res.status(400).json({ error: 'Kod ISO musi być dwuliterowym kodem (np. PL)' });
  }

  try {
    const existingCountry = await db('countries').where({ code }).first();
    if (existingCountry) {
      return res.status(409).json({ error: 'Kraj o podanym kodzie już istnieje' });
    }

    const [newCountry] = await db('countries')
      .insert({ code, name })
      .returning('*');
    res.status(201).json(newCountry);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas dodawania kraju' });
  }
});

// Edycja kraju
router.put('/:code', async (req, res) => {
  const updates = req.body;
  const { code } = req.params;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Brak danych do aktualizacji' });
  }

  try {
    const updated = await db('countries')
      .where({ code })
      .update(updates)
      .returning('*');

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Kraj nie znaleziony' });
    }

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas edycji kraju' });
  }
});

// Usuwanie kraju
router.delete('/:code', async (req, res) => {
  try {
    const usedByBreeders = await db('breeders').where({ country_code: req.params.code }).first();
    if (usedByBreeders) {
      return res.status(400).json({ error: 'Nie można usunąć kraju, który jest używany przez hodowców' });
    }

    const deleted = await db('countries').where({ code: req.params.code }).del();
    if (deleted === 0) {
      return res.status(404).json({ error: 'Kraj nie znaleziony' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas usuwania kraju' });
  }
});

module.exports = router;