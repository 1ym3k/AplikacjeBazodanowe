const express = require('express');
const router = express.Router();
const db = require('../db/connection');

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
    const breeder = await db('breeders').where({ id: req.params.id }).first();
    if (!breeder) return res.status(404).json({ error: 'Hodowca nie znaleziony' });
    res.json(breeder);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas pobierania hodowcy' });
  }
});

// Dodawanie hodowcy
router.post('/', async (req, res) => {
  const { name, country_code } = req.body;

  // Walidacja danych
  if (!name || !country_code) {
    return res.status(400).json({ error: 'Nazwa hodowcy i kod kraju są wymagane' });
  }

  try {
    // Sprawdzanie, czy kraj istnieje
    const country = await db('countries').where({ code: country_code }).first();
    if (!country) {
      return res.status(400).json({ error: 'Podany kraj nie istnieje' });
    }

    const [newBreeder] = await db('breeders').insert({ name, country_code }).returning('*');
    res.status(201).json(newBreeder);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas dodawania hodowcy' });
  }
});
 
// Edycja hodowcy
router.put('/:id', async (req, res) => {
  const { name, country_code } = req.body;

  // Walidacja danych
  if (!name || !country_code) {
    return res.status(400).json({ error: 'Nazwa hodowcy i kod kraju są wymagane' });
  }

  try {
    // Sprawdzanie, czy kraj istnieje
    const country = await db('countries').where({ code: country_code }).first();
    if (!country) {
      return res.status(400).json({ error: 'Podany kraj nie istnieje' });
    }

    const updated = await db('breeders')
      .where({ id: req.params.id })
      .update({ name, country_code })
      .returning('*');

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Hodowca nie znaleziony' });
    }

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas edycji hodowcy' });
  }
});

// Usuwanie hodowcy
router.delete('/:id', async (req, res) => {
  try {
    console.log(`Próba usunięcia hodowcy o ID: ${req.params.id}`); // Log rozpoczęcia operacji
    
    // Sprawdzanie, czy hodowca jest używany przez konie
    const usedByHorses = await db('horses').where({ breeder_id: req.params.id }).first();
    if (usedByHorses) {
      console.log(`Nie można usunąć hodowcy ID: ${req.params.id} - jest przypisany do koni`);
      return res.status(400).json({ error: 'Nie można usunąć hodowcy, który jest przypisany do koni' });
    }

    const deleted = await db('breeders').where({ id: req.params.id }).del();
    if (deleted === 0) {
      console.log(`Hodowca ID: ${req.params.id} nie znaleziony`);
      return res.status(404).json({ error: 'Hodowca nie znaleziony' });
    }

    console.log(`Pomyślnie usunięto hodowcę ID: ${req.params.id}`);
    res.status(204).send();
  } catch (error) {
    console.error(`Błąd podczas usuwania hodowcy ID: ${req.params.id}:`, error.message);
    res.status(500).json({ error: 'Błąd podczas usuwania hodowcy' });
  }
});
module.exports = router;