const { faker } = require('@faker-js/faker');

exports.seed = async function (knex) {
  await knex('horses').del();
  const breeders = await knex('breeders').select('id');
  const breeds = ['oo', 'xx', 'xo', 'xxoo'];
  const genders = ['mare', 'stallion', 'gelding'];
  const colors = ['Gniady', 'Siwa', 'Kasztanowaty', 'Kara'];

  // Funkcja do generowania daty w konkretnym roku
  const getRandomDateInYear = (year) => {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    return faker.date.between({ from: start, to: end });
  };

  // Funkcja do obliczania rasy
  const calculateBreed = (motherBreed, fatherBreed) => {
    if (!motherBreed || !fatherBreed) return faker.helpers.arrayElement(breeds);
    const rules = {
      'oo,oo': 'oo', 'oo,xx': 'xxoo', 'xx,xx': 'xx',
      'oo,xo': 'xo', 'xx,xo': 'xo', 'xo,oo': 'xo',
      'xx,xxoo': 'xxoo', 'xxoo,xx': 'xxoo', 'oo,xxoo': 'xxoo'
    };
    const key = `${motherBreed},${fatherBreed}`;
    return rules[key] || 'xo';
  };

  // Generacja 1 (dziadkowie) - 50 koni
  const gen1 = Array(50).fill().map(() => {
    const birthYear = faker.number.int({ min: 1990, max: 2005 });
    return {
      name: faker.person.firstName(),
      breed: faker.helpers.arrayElement(breeds),
      birth_year: birthYear,
      birth_date: getRandomDateInYear(birthYear).toISOString().split('T')[0],
      gender: faker.helpers.arrayElement(genders.filter(g => g !== 'gelding')), // Dziadkowie nie mogą być wałachami
      mother_id: null,
      father_id: null,
      breeder_id: faker.helpers.arrayElement(breeders).id,
      color: faker.helpers.arrayElement(colors)
    };
  });
  await knex('horses').insert(gen1);
  const gen1Horses = await knex('horses').select('id', 'gender', 'breed', 'birth_year');

  // Generacja 2 (rodzice) - 70 koni (każdy musi mieć rodziców z gen1)
  const gen2 = Array(70).fill().map(() => {
    const mother = faker.helpers.arrayElement(gen1Horses.filter(h => h.gender === 'mare'));
    const father = faker.helpers.arrayElement(gen1Horses.filter(h => h.gender === 'stallion'));
    
    if (!mother || !father) return null;

    const minYear = Math.max(mother.birth_year, father.birth_year) + 3;
    const maxYear = new Date().getFullYear() - 5; // Co najmniej 5 lat temu
    if (minYear > maxYear) return null;

    const birthYear = faker.number.int({ min: minYear, max: maxYear });
    const breed = calculateBreed(mother.breed, father.breed);

    return {
      name: faker.person.firstName(),
      breed,
      birth_year: birthYear,
      birth_date: getRandomDateInYear(birthYear).toISOString().split('T')[0],
      gender: faker.helpers.arrayElement(genders),
      mother_id: mother.id,
      father_id: father.id,
      breeder_id: faker.helpers.arrayElement(breeders).id,
      color: faker.helpers.arrayElement(colors)
    };
  }).filter(Boolean);
  await knex('horses').insert(gen2);
  const gen2Horses = await knex('horses').select('id', 'gender', 'breed', 'birth_year');

  // Generacja 3 (dzieci) - 100 koni (każdy musi mieć rodziców z gen2)
  const gen3 = Array(100).fill().map(() => {
    const mother = faker.helpers.arrayElement(gen2Horses.filter(h => h.gender === 'mare'));
    const father = faker.helpers.arrayElement(gen2Horses.filter(h => h.gender === 'stallion'));
    
    if (!mother || !father) return null;

    const minYear = Math.max(mother.birth_year, father.birth_year) + 3;
    const maxYear = new Date().getFullYear() - 1; // Co najmniej 1 rok temu
    if (minYear > maxYear) return null;

    const birthYear = faker.number.int({ min: minYear, max: maxYear });
    const breed = calculateBreed(mother.breed, father.breed);

    return {
      name: faker.person.firstName(),
      breed,
      birth_year: birthYear,
      birth_date: getRandomDateInYear(birthYear).toISOString().split('T')[0],
      gender: faker.helpers.arrayElement(genders),
      mother_id: mother.id,
      father_id: father.id,
      breeder_id: faker.helpers.arrayElement(breeders).id,
      color: faker.helpers.arrayElement(colors)
    };
  }).filter(Boolean);
  await knex('horses').insert(gen3);

  console.log(`Wygenerowano:
  - Generacja 1 (dziadkowie): ${gen1.length} koni
  - Generacja 2 (rodzice): ${gen2.length} koni
  - Generacja 3 (dzieci): ${gen3.length} koni`);
};