const express = require('express');
const path = require('path');


const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Pliki statyczne
app.use(express.static(path.join(__dirname, 'frontend')));

// Routes 
const countryRoutes = require('./routes/countries');
const breederRoutes = require('./routes/breeders');
const horseRoutes = require('./routes/horses');


app.use('/breeders', require('./routes/breeders'));
app.use('/countries', require('./routes/countries'));
app.use('/horses', require('./routes/horses'));

// Ścieżka do frontendu
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Coś poszło nie tak!' }); 
});

// Start serwera
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});